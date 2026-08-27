import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** 운용 시작일 — 7/30 첫 집행 직전 종가를 기준선으로 삼는다 */
const BASE_DATE = "2026-07-30";

const BENCH = [
  { symbol: "^KS11", label: "코스피" },
  { symbol: "^GSPC", label: "S&P 500" },
] as const;

interface BenchRow {
  label: string;
  base: number;
  last: number;
  pct: number;
  /** 원화 지수를 달러로 환산한 수익률 — 우리 수익률(달러 기준)과 통화를 맞추기 위함 */
  pctUsd?: number;
}

let cache: { t: number; rows: BenchRow[] } | null = null;
const TTL_MS = 10 * 60_000;

/** 일봉에서 기준일 직전 종가와 최신 종가를 뽑는다 */
async function fetchBench(symbol: string, label: string): Promise<BenchRow | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const ts: number[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const offset: number = meta?.gmtoffset ?? 0;

  // 거래소 현지 날짜가 BASE_DATE 이전인 마지막 종가 = 운용 시작 직전 수준
  let base: number | null = null;
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (typeof c !== "number" || !Number.isFinite(c)) continue;
    const day = new Date((ts[i] + offset) * 1000).toISOString().slice(0, 10);
    if (day < BASE_DATE) base = c;
  }
  const last = typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null;
  if (base == null || last == null) return null;

  return { label, base, last, pct: (last - base) / base };
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) {
    return NextResponse.json({ baseDate: BASE_DATE, rows: cache.rows });
  }
  const settled = await Promise.allSettled([
    ...BENCH.map((b) => fetchBench(b.symbol, b.label)),
    fetchBench("KRW=X", "환율"),
  ]);
  const rows = settled
    .slice(0, BENCH.length)
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((r): r is BenchRow => r != null);
  // 코스피는 원화 지수 — 같은 구간의 원/달러 변화를 얹어 달러 기준 수익률도 준다.
  // (1 + 지수수익률) × (기준일환율 / 현재환율) − 1
  const fxRow = settled[BENCH.length];
  const fx = fxRow?.status === "fulfilled" ? fxRow.value : null;
  const kospi = rows.find((r) => r.label === "코스피");
  if (kospi && fx) kospi.pctUsd = (1 + kospi.pct) * (fx.base / fx.last) - 1;
  if (rows.length) cache = { t: Date.now(), rows };

  return NextResponse.json(
    { baseDate: BASE_DATE, rows },
    { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" } }
  );
}
