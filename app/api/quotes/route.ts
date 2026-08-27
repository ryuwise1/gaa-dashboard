import { NextRequest, NextResponse } from "next/server";
import { HOLDINGS, FX_SYMBOLS, type Quote } from "@/lib/portfolio";
import { MACRO_SYMBOLS } from "@/lib/macro";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const ALLOWED = new Set<string>([
  ...HOLDINGS.positions.map((p) => p.yahoo),
  ...FX_SYMBOLS,
  ...MACRO_SYMBOLS,
]);

const TTL_MS = 30_000;
const cache = new Map<string, { t: number; q: Quote }>();

/** 005930.KS / 000660.KQ 처럼 국내 종목이면 6자리 코드를 돌려준다. */
function krCode(symbol: string): string | null {
  const m = /^(\d{6})\.(KS|KQ)$/.exec(symbol);
  return m ? m[1] : null;
}

const toNum = (s: unknown): number | null => {
  if (typeof s !== "string") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

/**
 * 국내 종목: 네이버 (delayTime 0 = 실시간).
 * 야후는 KRX를 약 20분 지연으로 주기 때문에 장 초반에 전일 종가가 그대로 나온다.
 */
async function fetchNaver(symbol: string, code: string): Promise<Quote | null> {
  const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const j = await res.json();
  const price = toNum(j?.closePrice);
  if (price == null) return null;

  // compareToPreviousPrice.code — 1:상한 2:상승 3:보합 4:하한 5:하락
  const dirCode = String(j?.compareToPreviousPrice?.code ?? "3");
  const sign = dirCode === "4" || dirCode === "5" ? -1 : dirCode === "3" ? 0 : 1;
  const diff = toNum(j?.compareToPreviousClosePrice) ?? 0;
  const prevClose = price - sign * Math.abs(diff);

  const traded = j?.localTradedAt ? Date.parse(j.localTradedAt) : NaN;

  const q: Quote = {
    symbol,
    price,
    prevClose: Number.isFinite(prevClose) && prevClose > 0 ? prevClose : null,
    currency: "KRW",
    time: Number.isFinite(traded) ? Math.floor(traded / 1000) : null,
  };

  // 시간외 세션(넥스트레이드 프리·애프터마켓)이 열려 있으면 같이 싣는다.
  // 정규장 숫자는 건드리지 않고 보조 정보로만 — pct는 정규장 종가 대비.
  const o = j?.overMarketPriceInfo;
  const overPrice = toNum(o?.overPrice);
  if (o?.overMarketStatus === "OPEN" && overPrice != null && price > 0) {
    q.over = {
      price: overPrice,
      pct: (overPrice - price) / price,
      label: o.tradingSessionType === "PRE_MARKET" ? "프리장" : "시간외",
    };
  }

  return q;
}

/** 스파크라인용으로 균등 간격 n개만 남긴다 — 페이로드를 작게 유지한다 */
function downsample(xs: number[], n: number): number[] {
  if (xs.length <= n) return xs;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(xs[Math.round((i * (xs.length - 1)) / (n - 1))]);
  return out;
}

/**
 * 해외 종목·지표·환율: 야후.
 *
 * range=1d로 부르면 장이 끝난 뒤 어떤 심볼(대표적으로 ^VIX)은 당일 봉이 통째로 비고
 * previousClose가 현재가와 같은 값으로 내려온다. 그러면 등락이 0%가 되어
 * 화면에서 빨강·파랑이 회색으로 풀려버린다.
 *
 * 그래서 5일치를 받아 거래일별로 묶고, previousClose가 현재가와 같을 때는
 * 직전 거래일의 마지막 종가로 되짚는다. 선물처럼 24시간 도는 종목은
 * 공식 정산가인 previousClose가 더 정확하므로 그쪽을 먼저 쓴다.
 */
async function fetchYahoo(symbol: string): Promise<Quote | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=5d&includePrePost=true`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const price = meta?.regularMarketPrice;
  if (typeof price !== "number") return null;

  // 거래일별로 종가를 모은다 (거래소 현지시각 기준)
  const ts: number[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const offset: number = meta?.gmtoffset ?? 0;
  const byDay = new Map<number, number[]>();
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    const day = Math.floor((ts[i] + offset) / 86400);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(c);
    else byDay.set(day, [c]);
  }
  const days = [...byDay.keys()].sort((x, y) => x - y);

  const official = typeof meta?.previousClose === "number" ? meta.previousClose : null;
  const priorDay = days.length >= 2 ? byDay.get(days[days.length - 2]) : undefined;
  const fromSeries = priorDay?.[priorDay.length - 1] ?? null;
  // 공식값이 현재가와 같으면 굳은 값이다 — 시계열로 되짚는다
  const prevClose = official != null && official !== price ? official : fromSeries ?? official;

  const q: Quote = {
    symbol,
    price,
    prevClose,
    currency: meta?.currency ?? null,
    time: meta?.regularMarketTime ?? null,
  };

  if (days.length) {
    // 당일 봉이 비었으면 마지막으로 거래된 날의 흐름을 보여준다
    let session = byDay.get(days[days.length - 1]) ?? [];
    if (session.length < 2 && days.length >= 2) session = byDay.get(days[days.length - 2]) ?? [];
    if (session.length >= 2) q.spark = downsample(session, 40).map((n) => +n.toFixed(4));
  }

  // 프리장·애프터: 정규장 마감 이후(또는 개장 전) 체결이 있으면 보조로 싣는다.
  // 마지막 유효 봉이 정규장 종료 시각보다 뒤면 시간외 체결이다.
  const period = meta?.currentTradingPeriod;
  const regEnd: number | undefined = period?.regular?.end;
  const regStart: number | undefined = period?.regular?.start;
  if (regEnd && regStart) {
    let lastT = 0;
    let lastC: number | null = null;
    for (let i = ts.length - 1; i >= 0; i--) {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c)) { lastT = ts[i]; lastC = c; break; }
    }
    const inRegular = Date.now() / 1000 >= regStart && Date.now() / 1000 < regEnd;
    if (!inRegular && lastC != null && (lastT >= regEnd || lastT < regStart) && price > 0 && lastC !== price) {
      q.over = {
        price: +lastC.toFixed(4),
        pct: (lastC - price) / price,
        label: lastT < regStart ? "프리장" : "애프터",
      };
    }
  }

  return q;
}

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.q;

  const code = krCode(symbol);
  let q: Quote | null = null;
  if (code) {
    // 가격·등락은 네이버(실시간), 당일 흐름 선은 야후(약 20분 지연)를 병렬로 받아 합친다.
    // 야후 지연은 그래프 모양에만 영향이 있고 숫자에는 닿지 않는다.
    const [naver, yahoo] = await Promise.allSettled([fetchNaver(symbol, code), fetchYahoo(symbol)]);
    const n = naver.status === "fulfilled" ? naver.value : null;
    const y = yahoo.status === "fulfilled" ? yahoo.value : null;
    q = n ?? y; // 네이버가 죽으면 야후 값으로라도
    if (q && y?.spark) q.spark = y.spark;
  } else {
    try {
      q = await fetchYahoo(symbol);
    } catch {
      q = null;
    }
  }
  if (!q) return hit?.q ?? null; // 실패 시 만료된 캐시라도 반환

  cache.set(symbol, { t: Date.now(), q });
  return q;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").map((s) => s.trim()).filter((s) => ALLOWED.has(s));
  if (symbols.length === 0) {
    return NextResponse.json({ error: "no valid symbols" }, { status: 400 });
  }

  const results = await Promise.allSettled(symbols.map(fetchQuote));
  const quotes: Record<string, Quote> = {};
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value) quotes[symbols[i]] = r.value;
  });

  return NextResponse.json(
    { quotes, fetchedAt: Date.now() },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=120" } }
  );
}
