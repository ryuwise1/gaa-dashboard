import { NextRequest, NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** 종목 행을 펼쳤을 때 보여주는 기간 차트용 시계열. 보유 종목만 허용한다. */
const ALLOWED = new Set(HOLDINGS.positions.map((p) => p.yahoo));

/**
 * 일봉 구간(1m·3m)은 기술적 지표(MA20·MA60·RSI14)를 함께 계산한다.
 * 지표 워밍업(60일 이동평균)을 위해 표시 구간보다 길게 받아서 계산 후 잘라 보낸다.
 */
const RANGES: Record<string, { range: string; interval: string; show: number; ta: boolean }> = {
  "1w": { range: "5d", interval: "30m", show: 9999, ta: false },
  "1m": { range: "6mo", interval: "1d", show: 22, ta: true },
  "3m": { range: "9mo", interval: "1d", show: 64, ta: true },
};

/** 단순이동평균 — 앞쪽 워밍업 구간은 null */
function sma(xs: number[], n: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < xs.length; i++) {
    sum += xs[i];
    if (i >= n) sum -= xs[i - n];
    out.push(i >= n - 1 ? +(sum / n).toFixed(4) : null);
  }
  return out;
}

/** RSI(14) — Wilder 평활. 마지막 값 하나만 쓴다 */
function rsi14(xs: number[]): number | null {
  const n = 14;
  if (xs.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgG = gain / n, avgL = loss / n;
  for (let i = n + 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    avgG = (avgG * (n - 1) + Math.max(d, 0)) / n;
    avgL = (avgL * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (avgL === 0) return 100;
  return +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
}

const cache = new Map<string, { t: number; body: unknown }>();
const TTL_MS = 10 * 60_000;

/** 값과 시각을 같은 인덱스로 다운샘플 — 호버에서 날짜를 보여주기 위함 */
function downsamplePair(xs: number[], ts: number[], n: number): { v: number[]; t: number[] } {
  if (xs.length <= n) return { v: xs, t: ts };
  const v: number[] = [];
  const t: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = Math.round((i * (xs.length - 1)) / (n - 1));
    v.push(xs[j]);
    t.push(ts[j]);
  }
  return { v, t };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? "";
  const rangeKey = req.nextUrl.searchParams.get("range") ?? "1m";
  const spec = RANGES[rangeKey];
  if (!ALLOWED.has(symbol) || !spec) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const key = `${symbol}:${rangeKey}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return NextResponse.json(hit.body);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${spec.interval}&range=${spec.range}`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return NextResponse.json({ error: "upstream" }, { status: 502 });

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const stamps: number[] = result?.timestamp ?? [];
  const cleanV: number[] = [];
  const cleanT: number[] = [];
  closes.forEach((c, i) => {
    if (typeof c === "number" && Number.isFinite(c)) { cleanV.push(c); cleanT.push(stamps[i] ?? 0); }
  });
  if (cleanV.length < 2) return NextResponse.json({ error: "no data" }, { status: 502 });

  // 기술적 지표는 전체 시계열로 계산한 뒤, 표시 구간만 잘라 보낸다
  let ma20: (number | null)[] | undefined;
  let ma60: (number | null)[] | undefined;
  let rsi: number | null | undefined;
  let showV = cleanV;
  let showT = cleanT;
  if (spec.ta) {
    const m20 = sma(cleanV, 20);
    const m60 = sma(cleanV, 60);
    rsi = rsi14(cleanV);
    const cut = Math.max(0, cleanV.length - spec.show);
    showV = cleanV.slice(cut);
    showT = cleanT.slice(cut);
    ma20 = m20.slice(cut);
    ma60 = m60.slice(cut);
  }

  const { v, t } = downsamplePair(showV, showT, 80);
  const body = {
    symbol,
    range: rangeKey,
    spark: v.map((n) => +n.toFixed(4)),
    times: t,
    ma20,
    ma60,
    rsi,
    first: +showV[0].toFixed(4),
    last: +showV[showV.length - 1].toFixed(4),
  };
  cache.set(key, { t: Date.now(), body });
  return NextResponse.json(body, {
    headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=1800" },
  });
}
