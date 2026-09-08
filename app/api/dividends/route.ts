import { NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";
import { OPENING_POSITIONS, TRADES } from "@/lib/trades";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 배당 수익 — 운용 개시(7/29) 이후 배당락일 기준으로 우리가 받은(받을) 배당을 집계한다.
 * 야후 차트 API의 배당 이벤트(주당 배당금·배당락일)에 원장 리플레이로 구한
 * "그날의 보유 수량"을 곱한다. 원화 배당은 현재 환율로 환산해 표시한다.
 * 참고: 야후는 배당락일만 제공한다 — 실제 입금(지급일)은 통상 2주~1개월 뒤다.
 */

const SINCE = "2026-07-29"; // 개시 포트폴리오 편입일

interface DivEvent {
  exDate: string;
  perShare: number;   // 주당 배당금 (상장 통화)
  qty: number;        // 배당락일 시점 보유 수량
  amountNative: number;
  amountUsd: number;
}
interface DivRow {
  ticker: string; name: string; currency: string;
  yieldPct: number | null;   // 최근 12개월 배당 ÷ 현재가
  perYear: number;           // 최근 12개월 지급 횟수 (지급 주기 가늠)
  subtotalUsd: number;
  events: DivEvent[];
}

let cache: { t: number; body: unknown } | null = null;
const TTL_MS = 6 * 60 * 60_000;

/** 원장 리플레이 — 그 날짜 종료 시점의 보유 수량 */
function qtyAt(ticker: string, date: string): number {
  let q = OPENING_POSITIONS.find((p) => p.ticker === ticker)?.qty ?? 0;
  for (const t of TRADES) {
    if (t.ticker !== ticker || t.date > date) continue;
    q += t.side === "매수" ? t.qty : -t.qty;
  }
  return Math.max(q, 0);
}

interface ChartDiv { amount: number; date: number }

async function fetchDivs(symbol: string): Promise<{ price: number | null; divs: { exDate: string; amount: number }[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1mo&events=div`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return { price: null, divs: [] };
  const json = await res.json();
  const r = json?.chart?.result?.[0];
  const evs = (Object.values(r?.events?.dividends ?? {}) as ChartDiv[])
    .filter((d) => Number.isFinite(d?.amount) && Number.isFinite(d?.date))
    .map((d) => ({
      exDate: new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(d.date * 1000)),
      amount: d.amount,
    }))
    .sort((a, b) => a.exDate.localeCompare(b.exDate));
  return { price: r?.meta?.regularMarketPrice ?? null, divs: evs };
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) return NextResponse.json(cache.body);

  // 환율 — 원화 배당(삼성전자·SK하이닉스) 환산용
  let krwPerUsd = 1340;
  try {
    const fx = await fetchDivs("KRW=X");
    if (fx.price) krwPerUsd = fx.price;
  } catch {}

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  // 보유했던 적이 있는 종목 전부 (미매수 제외)
  const tickers = HOLDINGS.positions.filter(
    (p) => qtyAt(p.ticker, today) > 0 || OPENING_POSITIONS.some((o) => o.ticker === p.ticker)
  );

  const rows: DivRow[] = [];
  await Promise.all(tickers.map(async (p) => {
    try {
      const { price, divs } = await fetchDivs(p.yahoo);
      if (!divs.length) return;
      const toUsd = (v: number) => (p.currency === "KRW" ? v / krwPerUsd : v);
      const events: DivEvent[] = divs
        .filter((d) => d.exDate >= SINCE && d.exDate <= today)
        .map((d) => {
          const q = qtyAt(p.ticker, d.exDate);
          return {
            exDate: d.exDate, perShare: d.amount, qty: q,
            amountNative: +(d.amount * q).toFixed(p.currency === "KRW" ? 0 : 2),
            amountUsd: +toUsd(d.amount * q).toFixed(2),
          };
        })
        .filter((e) => e.qty > 0);
      // 최근 12개월 주당 배당 합 ÷ 현재가 = 트레일링 배당수익률
      const trailing = divs.reduce((s, d) => s + d.amount, 0);
      const yieldPct = price ? +((trailing / price) * 100).toFixed(2) : null;
      if (!events.length && !trailing) return;
      rows.push({
        ticker: p.ticker, name: p.name, currency: p.currency,
        yieldPct, perYear: divs.length,
        subtotalUsd: +events.reduce((s, e) => s + e.amountUsd, 0).toFixed(2),
        events: events.reverse(),
      });
    } catch { /* 개별 종목 실패는 조용히 생략 */ }
  }));

  rows.sort((a, b) => b.subtotalUsd - a.subtotalUsd);
  const body = {
    asOf: new Date().toISOString(),
    since: SINCE,
    krwPerUsd,
    totalUsd: +rows.reduce((s, r) => s + r.subtotalUsd, 0).toFixed(2),
    rows,
  };
  cache = { t: Date.now(), body };
  return NextResponse.json(body, { headers: { "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400" } });
}
