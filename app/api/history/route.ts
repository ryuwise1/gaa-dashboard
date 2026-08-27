import { NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";
import { AUM_USD, LEDGER } from "@/lib/trades";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 총자산 추이 — 별도 저장소 없이 만든다.
 * 체결 원장에 모든 매매가 날짜별로 있으므로, 야후 일봉을 받아
 * "그날 보유 수량 × 그날 종가 (÷ 그날 환율)"로 매일의 총자산을 역산한다.
 * KRX 일봉은 야후가 지연 없이 주므로 (지연은 장중 분봉 얘기) 종가 기준엔 문제없다.
 */

const START = "2026-07-30";

interface DayPoint {
  date: string;
  totalUsd: number;
  /** 우리와 같은 날·같은 금액으로 S&P 500을 분할 매수했다면 (동일 현금흐름 PME 벤치마크) */
  benchUsd: number | null;
  /** 지수 자체의 누적 등락률 (개시 직전 종가 대비) — 일시투입 관점 비교용 */
  spxPct: number | null;
}

let cache: { t: number; points: DayPoint[] } | null = null;
const TTL_MS = 60 * 60_000; // 일봉이라 1시간이면 충분

/** 야후 일봉 → { "2026-07-30": close, ... } (거래소 현지 날짜) */
async function dailyCloses(symbol: string): Promise<Map<string, number>> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  const out = new Map<string, number>();
  if (!res.ok) return out;
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

/** day 이하에서 가장 가까운 종가 (휴장일은 직전 거래일로 채움) */
function closeOn(m: Map<string, number>, day: string): number | null {
  if (m.has(day)) return m.get(day)!;
  let best: string | null = null;
  for (const k of m.keys()) if (k <= day && (!best || k > best)) best = k;
  return best ? m.get(best)! : null;
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) {
    return NextResponse.json({ start: START, aumUsd: AUM_USD, points: cache.points });
  }

  // 원장에 등장하는 모든 티커 → 야후 심볼·통화
  const meta = new Map(HOLDINGS.positions.map((p) => [p.ticker, { yahoo: p.yahoo, currency: p.currency }]));
  const tickers = new Set<string>();
  for (const p of LEDGER.openingPositions.positions) tickers.add(p.ticker);
  for (const t of LEDGER.trades) tickers.add(t.ticker);

  const symbols = [...tickers].map((t) => meta.get(t)?.yahoo).filter((s): s is string => !!s);
  const priceMaps = new Map<string, Map<string, number>>();
  const fetchList = [...symbols, "KRW=X", "^GSPC"];
  const settled = await Promise.allSettled(fetchList.map(dailyCloses));
  fetchList.forEach((s, i) => {
    const r = settled[i];
    if (r.status === "fulfilled") priceMaps.set(s, r.value);
  });
  const krw = priceMaps.get("KRW=X") ?? new Map();
  /**
   * S&P 벤치마크 — 공정 비교를 위해 "일시 투입"이 아니라
   * 우리와 같은 날, 같은 금액으로 지수를 분할 매수했다고 가정한다.
   * (우리는 현금을 깔고 분할 집행 중이라, 전액 일시 투입 가정과 비교하면
   * 상승장에서 구조적으로 불리하게 보인다 — 그 왜곡을 제거)
   * 매수 = 그날 종가로 지수 유닛 매입, 매도 = 같은 금액만큼 유닛 매도, 현금은 동일.
   */
  const gspc = priceMaps.get("^GSPC") ?? new Map();
  let gspcBaseDay = "";
  for (const [d] of gspc) if (d < START && d > gspcBaseDay) gspcBaseDay = d;
  const gspcBase: number | null = gspcBaseDay ? gspc.get(gspcBaseDay)! : null;

  // 체결을 날짜순으로 재생하며 하루씩 평가
  const sorted = [...LEDGER.trades].sort((a, b) => a.date.localeCompare(b.date));
  const qty = new Map<string, number>();
  let cash = AUM_USD;
  let benchUnits = 0;
  for (const p of LEDGER.openingPositions.positions) {
    qty.set(p.ticker, p.qty);
    cash -= p.qty * p.avgPrice * (p.fxToUsd ?? 1);
  }
  // 개시 편입액은 개시 직전 종가로 지수 매입한 것으로
  if (gspcBase) benchUnits += (AUM_USD - cash) / gspcBase;

  const points: DayPoint[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let ti = 0;
  for (let d = new Date(START + "T00:00:00Z"); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    if (day > today) break;

    // 이날까지의 체결 반영 (벤치마크도 같은 현금 흐름으로 지수를 사고판다)
    while (ti < sorted.length && sorted[ti].date <= day) {
      const t = sorted[ti++];
      qty.set(t.ticker, (qty.get(t.ticker) ?? 0) + (t.side === "매수" ? t.qty : -t.qty));
      cash += t.side === "매수" ? -t.usd : t.usd;
      const spx = closeOn(gspc, t.date);
      if (spx) benchUnits += (t.side === "매수" ? t.usd : -t.usd) / spx;
    }

    // 주말은 건너뛴다 (환율·미장 다 서므로 선이 평평하게 눌어붙기만 함)
    const wd = d.getUTCDay();
    if (wd === 0 || wd === 6) continue;

    let value = 0;
    let complete = true;
    for (const [ticker, q] of qty) {
      if (q <= 0) continue;
      const m = meta.get(ticker);
      const prices = m ? priceMaps.get(m.yahoo) : undefined;
      const px = prices ? closeOn(prices, day) : null;
      if (px == null) { complete = false; break; }
      if (m!.currency === "KRW") {
        const fx = closeOn(krw, day);
        if (!fx) { complete = false; break; }
        value += (q * px) / fx;
      } else {
        value += q * px;
      }
    }
    if (complete) {
      const g = closeOn(gspc, day);
      points.push({
        date: day,
        totalUsd: Math.round((value + cash) * 100) / 100,
        // 벤치 총자산 = 동일 현금 + 지수 유닛 평가액
        benchUsd: g != null ? Math.round(cash + benchUnits * g) : null,
        spxPct: g != null && gspcBase ? +(g / gspcBase - 1).toFixed(5) : null,
      });
    }
  }

  if (points.length) cache = { t: Date.now(), points };
  return NextResponse.json(
    { start: START, aumUsd: AUM_USD, points },
    { headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=7200" } }
  );
}
