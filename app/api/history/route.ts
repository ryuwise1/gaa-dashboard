import { NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";
import { AUM_USD, LEDGER } from "@/lib/trades";
import divLedger from "@/data/dividend-ledger.json";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 총자산 추이 — 별도 저장소 없이 만든다.
 * 체결 원장에 모든 매매가 날짜별로 있으므로, 야후 일봉을 받아
 * "그날 보유 수량 × 그날 종가 (÷ 그날 환율)"로 매일의 총자산을 역산한다.
 * KRX 일봉은 야후가 지연 없이 주므로 (지연은 장중 분봉 얘기) 종가 기준엔 문제없다.
 *
 * 배당: 첫 화면 총자산(lib/trades cashUsd)과 같게, dividend-ledger의 수령분을 배당락일부터 현금에 더한다.
 * 벤치마크: 우리 쪽에 배당이 들어가므로 S&P도 배당 재투자 지수(^SP500TR)로 비교한다 —
 * 가격지수(^GSPC)와 비교하면 배당만큼 우리에게 유리하게 기운다.
 *
 * 시세 결측: 한 종목이라도 종가가 없으면 그날을 통째로 버리던 방식은, 야후가 한 종목만 실패해도
 * 차트 전체가 비었다. 이제 ① 실패한 조회는 한 번 더 시도하고 ② 그래도 없으면 그 종목의 마지막 체결가로
 * 평가해 점을 살리되 est 표시를 붙이고 ③ 그런 응답은 서버 캐시에 넣지 않고 짧게만 캐시한다.
 */

/** S&P 비교 지수 — 배당 재투자(총수익) 지수 */
const SPX = "^SP500TR";

const START = "2026-07-30";
/** 일봉 조회 시작 — 개시 직전 종가가 들어오도록 START보다 열흘 앞. range=3mo로 두면 10월 말부터 개시 구간이 잘린다 */
const PERIOD1 = Math.floor(Date.UTC(2026, 6, 20) / 1000);

interface DayPoint {
  date: string;
  totalUsd: number;
  /** 우리와 같은 날·같은 금액으로 S&P 500을 분할 매수했다면 (동일 현금흐름 PME 벤치마크) */
  benchUsd: number | null;
  /** 지수 자체의 누적 등락률 (개시 직전 종가 대비) — 일시투입 관점 비교용 */
  spxPct: number | null;
  /** 시세를 못 받은 종목을 체결가로 대신 평가한 날 */
  est?: true;
}

let cache: { t: number; points: DayPoint[] } | null = null;
const DIVS = (divLedger as { items: { date: string; usd: number }[] }).items;
const TTL_MS = 60 * 60_000; // 일봉이라 1시간이면 충분

/** 야후 일봉 → { "2026-07-30": close, ... } (거래소 현지 날짜) */
async function dailyCloses(symbol: string): Promise<Map<string, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&period1=${PERIOD1}&period2=${Math.floor(Date.now() / 1000)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  const out = new Map<string, number>();
  if (!res.ok) throw new Error(`${symbol} ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const ts: number[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const offset: number = result?.meta?.gmtoffset ?? 0;
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    out.set(new Date((ts[i] + offset) * 1000).toISOString().slice(0, 10), c);
  }
  // 오늘 진행 중인 값도 하나의 점으로
  const live = result?.meta?.regularMarketPrice;
  const liveT = result?.meta?.regularMarketTime;
  if (typeof live === "number" && typeof liveT === "number") {
    out.set(new Date((liveT + offset) * 1000).toISOString().slice(0, 10), live);
  }
  return out;
}

/** 실패하거나 빈 응답이면 한 번 더 — 야후는 가끔 한 종목만 일시적으로 비운다 */
async function dailyClosesRetry(symbol: string): Promise<Map<string, number>> {
  try {
    const m = await dailyCloses(symbol);
    if (m.size) return m;
  } catch {}
  await new Promise((r) => setTimeout(r, 400));
  return dailyCloses(symbol);
}

/** day 이하에서 가장 가까운 종가 (휴장일은 직전 거래일로 채움) */
function closeOn(m: Map<string, number>, day: string): number | null {
  if (m.has(day)) return m.get(day)!;
  let best: string | null = null;
  for (const k of m.keys()) if (k <= day && (!best || k > best)) best = k;
  return best ? m.get(best)! : null;
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) {
    return NextResponse.json({ start: START, aumUsd: AUM_USD, points: cache.points, missing: [] });
  }

  // 원장에 등장하는 모든 티커 → 야후 심볼·통화
  const meta = new Map(HOLDINGS.positions.map((p) => [p.ticker, { yahoo: p.yahoo, currency: p.currency }]));
  const tickers = new Set<string>();
  for (const p of LEDGER.openingPositions.positions) tickers.add(p.ticker);
  for (const t of LEDGER.trades) tickers.add(t.ticker);

  const symbols = [...tickers].map((t) => meta.get(t)?.yahoo).filter((s): s is string => !!s);
  const priceMaps = new Map<string, Map<string, number>>();
  const fetchList = [...symbols, "KRW=X", SPX];
  const settled = await Promise.allSettled(fetchList.map(dailyClosesRetry));
  const missing: string[] = [];
  fetchList.forEach((s, i) => {
    const r = settled[i];
    if (r.status === "fulfilled" && r.value.size) priceMaps.set(s, r.value);
    else missing.push(s);
  });
  const krw = priceMaps.get("KRW=X") ?? new Map();
  /**
   * S&P 벤치마크 — 공정 비교를 위해 "일시 투입"이 아니라
   * 우리와 같은 날, 같은 금액으로 지수를 분할 매수했다고 가정한다.
   * (우리는 현금을 깔고 분할 집행 중이라, 전액 일시 투입 가정과 비교하면
   * 상승장에서 구조적으로 불리하게 보인다 — 그 왜곡을 제거)
   * 매수 = 그날 종가로 지수 유닛 매입, 매도 = 같은 금액만큼 유닛 매도, 현금은 동일.
   */
  const gspc = priceMaps.get(SPX) ?? new Map();
  let gspcBaseDay = "";
  for (const [d] of gspc) if (d < START && d > gspcBaseDay) gspcBaseDay = d;
  const gspcBase: number | null = gspcBaseDay ? gspc.get(gspcBaseDay)! : null;

  // 체결을 날짜순으로 재생하며 하루씩 평가
  const sorted = [...LEDGER.trades].sort((a, b) => a.date.localeCompare(b.date));
  const qty = new Map<string, number>();
  let cash = AUM_USD;
  let benchUnits = 0;
  /** 종목별 마지막 체결가(달러) — 시세 결측 때 대신 쓰는 값 */
  const lastUsdPx = new Map<string, number>();
  for (const p of LEDGER.openingPositions.positions) {
    qty.set(p.ticker, p.qty);
    cash -= p.qty * p.avgPrice * (p.fxToUsd ?? 1);
    lastUsdPx.set(p.ticker, p.avgPrice * (p.fxToUsd ?? 1));
  }
  // 개시 편입액은 개시 직전 종가로 지수 매입한 것으로
  if (gspcBase) benchUnits += (AUM_USD - cash) / gspcBase;

  const points: DayPoint[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let ti = 0;
  let divCash = 0; // 배당 수령분 — 우리 총자산에만 더한다 (벤치 현금흐름이 아니다)
  let di = 0;
  const divs = [...DIVS].sort((a, b) => a.date.localeCompare(b.date));
  for (let d = new Date(START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day > today) break;

    // 이날까지의 체결 반영 (벤치마크도 같은 현금 흐름으로 지수를 사고판다)
    while (ti < sorted.length && sorted[ti].date <= day) {
      const t = sorted[ti++];
      qty.set(t.ticker, (qty.get(t.ticker) ?? 0) + (t.side === "매수" ? t.qty : -t.qty));
      cash += t.side === "매수" ? -t.usd : t.usd;
      if (t.qty > 0) lastUsdPx.set(t.ticker, t.usd / t.qty);
      const spx = closeOn(gspc, t.date);
      if (spx) benchUnits += (t.side === "매수" ? t.usd : -t.usd) / spx;
    }

    while (di < divs.length && divs[di].date <= day) divCash += divs[di++].usd;

    // 주말은 건너뛴다 (환율·미장 다 서므로 선이 평평하게 눌어붙기만 함)
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;

    let value = 0;
    let complete = true;
    let est = false;
    for (const [ticker, q] of qty) {
      if (q <= 0) continue;
      const m = meta.get(ticker);
      const prices = m ? priceMaps.get(m.yahoo) : undefined;
      const px = prices ? closeOn(prices, day) : null;
      const fx = m?.currency === "KRW" ? closeOn(krw, day) : 1;
      if (px != null && fx) {
        value += m!.currency === "KRW" ? (q * px) / fx : q * px;
        continue;
      }
      // 종가나 환율이 없으면 마지막 체결가로 대신한다 — 점 하나 때문에 차트 전체를 버리지 않는다
      const fb = lastUsdPx.get(ticker);
      if (fb == null) { complete = false; break; }
      value += q * fb;
      est = true;
    }
    if (complete) {
      const g = closeOn(gspc, day);
      const pt: DayPoint = {
        date: day,
        totalUsd: Math.round((value + cash + divCash) * 100) / 100,
        // 벤치 총자산 = 동일 현금 + 지수 유닛 평가액
        benchUsd: g != null ? Math.round(cash + benchUnits * g) : null,
        spxPct: g != null && gspcBase ? +(g / gspcBase - 1).toFixed(5) : null,
      };
      if (est) pt.est = true;
      points.push(pt);
    }
  }

  // 결측이 있던 응답은 서버 캐시에 넣지 않고 CDN에도 짧게만 — 다음 요청에서 바로 다시 받아 보게
  if (points.length && !missing.length) cache = { t: Date.now(), points };
  return NextResponse.json(
    { start: START, aumUsd: AUM_USD, points, missing },
    { headers: { "Cache-Control": missing.length ? "s-maxage=120" : "s-maxage=3600, stale-while-revalidate=7200" } }
  );
}
