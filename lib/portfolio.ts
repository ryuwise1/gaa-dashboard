import holdingsJson from "@/data/holdings.json";

export type Currency = "USD" | "KRW" | "EUR" | "GBp" | "TWD";

export interface Position {
  ticker: string;
  name: string;
  sector: string;
  targetWeight: number;
  targetUsd: number;
  currency: Currency;
  yahoo: string;
  status: "미매수" | "매수중" | "매수완료" | "매도";
  qty?: number;
  avgPrice?: number;
}

export interface Quote {
  symbol: string;
  price: number;
  prevClose: number | null;
  currency: string | null;
  time: number | null;
}

export type QuoteMap = Record<string, Quote | undefined>;

export const HOLDINGS = holdingsJson as {
  meta: { team: string; targetTotalUsd: number; updatedAt: string; notionUrl: string };
  positions: Position[];
};

export const FX_SYMBOLS = ["KRW=X", "EURUSD=X", "GBPUSD=X", "TWD=X"] as const;

export function heldPositions(): Position[] {
  return HOLDINGS.positions.filter((p) => (p.qty ?? 0) > 0);
}

export function symbolsToFetch(): string[] {
  return [...heldPositions().map((p) => p.yahoo), ...FX_SYMBOLS];
}

/** 1 현지통화 → USD 환산 배수 */
export function rateToUsd(currency: Currency, fx: QuoteMap): number | null {
  const krw = fx["KRW=X"]?.price;
  const eur = fx["EURUSD=X"]?.price;
  const gbp = fx["GBPUSD=X"]?.price;
  const twd = fx["TWD=X"]?.price;
  switch (currency) {
    case "USD": return 1;
    case "KRW": return krw ? 1 / krw : null;
    case "EUR": return eur ?? null;
    case "GBp": return gbp ? gbp / 100 : null;
    case "TWD": return twd ? 1 / twd : null;
  }
}

export interface HoldingRow {
  ticker: string;
  name: string;
  sector: string;
  currency: Currency;
  qty: number;
  avgPrice: number;
  price: number | null;
  live: boolean; // 시세를 실제로 받아왔는지 (false면 평단가 기준)
  valueUsd: number | null;
  costUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  dayPct: number | null;
  dayUsd: number | null;
  weight: number | null; // 보유분 내 비중
}

export interface Totals {
  valueUsd: number;
  valueKrw: number | null;
  costUsd: number;
  pnlUsd: number;
  pnlPct: number;
  dayUsd: number;
  dayPct: number | null;
  usdkrw: number | null;
}

export function buildHoldingRows(quotes: QuoteMap): HoldingRow[] {
  const rows = heldPositions().map((p): HoldingRow => {
    const q = quotes[p.yahoo];
    const rate = rateToUsd(p.currency, quotes);
    const price = q?.price ?? p.avgPrice ?? null;
    const live = q?.price != null;
    const qty = p.qty ?? 0;
    const avg = p.avgPrice ?? 0;
    const valueUsd = price != null && rate != null ? qty * price * rate : null;
    const costUsd = rate != null ? qty * avg * rate : null;
    const pnlUsd = valueUsd != null && costUsd != null ? valueUsd - costUsd : null;
    const pnlPct = price != null && avg > 0 ? (price - avg) / avg : null;
    const prev = q?.prevClose ?? null;
    const dayPct = live && prev ? (q!.price - prev) / prev : null;
    const dayUsd = live && prev && rate != null ? qty * (q!.price - prev) * rate : null;
    return { ticker: p.ticker, name: p.name, sector: p.sector, currency: p.currency, qty, avgPrice: avg, price, live, valueUsd, costUsd, pnlUsd, pnlPct, dayPct, dayUsd, weight: null };
  });

  const total = rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  for (const r of rows) r.weight = total > 0 && r.valueUsd != null ? r.valueUsd / total : null;
  rows.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return rows;
}

export function buildTotals(rows: HoldingRow[], quotes: QuoteMap): Totals {
  const valueUsd = rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const costUsd = rows.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const pnlUsd = valueUsd - costUsd;
  const pnlPct = costUsd > 0 ? pnlUsd / costUsd : 0;
  const dayUsd = rows.reduce((s, r) => s + (r.dayUsd ?? 0), 0);
  const prevTotal = valueUsd - dayUsd;
  const dayPct = prevTotal > 0 ? dayUsd / prevTotal : null;
  const usdkrw = quotes["KRW=X"]?.price ?? null;
  const valueKrw = usdkrw ? valueUsd * usdkrw : null;
  return { valueUsd, valueKrw, costUsd, pnlUsd, pnlPct, dayUsd, dayPct, usdkrw };
}

/* ── 색 배정: 색은 순위가 아니라 종목(엔티티)을 따라간다 ─────────────── */

const SERIES = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

const TICKER_SLOT: Record<string, number> = {
  MSFT: 0, META: 1, INTC: 2, "005930": 3, "000660": 4, QCOM: 5,
};

export function tickerColorVar(ticker: string, fallbackIndex: number): string {
  const slot = TICKER_SLOT[ticker] ?? fallbackIndex;
  return `var(--${SERIES[slot % 8]})`;
}

const SECTOR_SLOT: Record<string, number> = {
  "코어 인덱스": 0, "AI CapEx": 1, "메모리 역상관": 2, "에너지": 3,
  "유럽 방산": 4, "금리 (인하)": 5, "금리 (인상)": 6, "현금": 7,
};

export function sectorColorVar(sector: string): string {
  return `var(--${SERIES[(SECTOR_SLOT[sector] ?? 0) % 8]})`;
}

export const SECTOR_ORDER = Object.keys(SECTOR_SLOT);

/* ── 포맷터 ────────────────────────────────────────────────────────── */

export function fmtKrw(n: number | null): string {
  if (n == null) return "—";
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

export function fmtUsd(n: number | null, digits = 0): string {
  if (n == null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSignedUsd(n: number | null): string {
  if (n == null) return "—";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return s + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function fmtPct(n: number | null, digits = 2): string {
  if (n == null) return "—";
  const s = n > 0 ? "+" : n < 0 ? "−" : "";
  return s + (Math.abs(n) * 100).toFixed(digits) + "%";
}

export function fmtLocalPrice(currency: Currency, n: number | null): string {
  if (n == null) return "—";
  switch (currency) {
    case "KRW": return n.toLocaleString("ko-KR") + "원";
    case "USD": return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "EUR": return "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "GBp": return n.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "p";
    case "TWD": return "NT$" + n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
}
