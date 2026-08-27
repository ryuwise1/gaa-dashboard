import holdingsJson from "@/data/holdings.json";
import { costOf } from "@/lib/trades";

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
  /** 당일 흐름 — 상단 지표 밴드의 스파크라인용. 지표 심볼에만 실린다. */
  spark?: number[];
  /** 시간외·프리장 시세 — 진행 중일 때만 실린다. pct는 정규장 종가 대비 */
  over?: { price: number; pct: number; label: string };
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
  /** 체결 시점 환율로 확정된 달러 취득원가 (오늘 환율로 재환산하지 않는다) */
  costUsd: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  /**
   * 환차손익 (USD). 원화로 매수한 종목만 값이 있다.
   * 우리 자금은 달러라 국내주식은 달러를 원화로 환전해서 산다 —
   * 그래서 주가가 그대로여도 환율이 움직이면 달러 기준 손익이 생긴다.
   * 달러로 산 해외주식에는 환전 과정 자체가 없으므로 항상 null이다.
   */
  fxUsd: number | null;
  /** 가중평균 매수 환율 (원/달러). 국내주식만. */
  buyKrwPerUsd: number | null;
  /**
   * 그 종목을 실제로 매수한 통화 안에서만 본 값 — 원화 매수분 전용.
   * 원화로 사서 원화로 평가하면 환전이 개입하지 않으므로 환차손익이 빠진다.
   * 토스에서 국내주식이 원·달러 토글과 무관하게 같은 수익률을 보여주는 것과 같은 이치.
   */
  costKrw: number | null;
  valueKrw: number | null;
  pnlKrw: number | null;
  pnlPctKrw: number | null;
  dayPct: number | null;
  dayUsd: number | null;
  /** 당일 흐름 — 현재가 모드의 미니 차트용 */
  spark: number[] | null;
  /** 시간외·프리장 시세 (진행 중일 때만) */
  over: { price: number; pct: number; label: string } | null;
  /** 전일 종가 (현지통화) — 미니 차트의 기준선 */
  prevClose: number | null;
  weight: number | null; // 보유분 내 비중
  quoteTime: number | null; // 시세가 체결된 시각 (epoch seconds)
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
    // 원가는 체결 시점에 확정된 값을 쓴다. 오늘 환율로 다시 환산하면
    // 환차손익이 평가액과 원가에서 똑같이 상쇄돼 화면에서 사라진다.
    const basis = costOf(p.ticker);
    const costUsd = basis?.usd ?? null;
    const pnlUsd = valueUsd != null && costUsd != null ? valueUsd - costUsd : null;
    const pnlPct = pnlUsd != null && costUsd ? pnlUsd / costUsd : null;

    // 환차손익 분해 — 원화로 매수한 종목에만 해당한다.
    // 매수할 때 달러를 r_buy로 환전해 원화 원가를 만들었고, 지금 평가액을 r_now로 되돌린다.
    //   환차손익 = 현재 원화 평가액 × (1/r_now − 1/r_buy)
    // 남는 몫이 순수 주가손익이라 둘을 더하면 위의 pnlUsd와 정확히 일치한다.
    let fxUsd: number | null = null;
    let buyKrwPerUsd: number | null = null;
    let costKrw: number | null = null;
    let valueKrw: number | null = null;
    let pnlKrw: number | null = null;
    let pnlPctKrw: number | null = null;
    if (p.currency === "KRW" && basis && basis.usd > 0) {
      buyKrwPerUsd = basis.krw / basis.usd;
      costKrw = basis.krw;
      if (price != null) {
        valueKrw = qty * price;
        pnlKrw = valueKrw - costKrw;
        pnlPctKrw = costKrw > 0 ? pnlKrw / costKrw : null;
      }
      const krwNow = quotes["KRW=X"]?.price ?? null;
      if (krwNow && price != null) fxUsd = qty * price * (1 / krwNow - 1 / buyKrwPerUsd);
    }

    const prev = q?.prevClose ?? null;
    const dayPct = live && prev ? (q!.price - prev) / prev : null;
    const dayUsd = live && prev && rate != null ? qty * (q!.price - prev) * rate : null;

    return {
      ticker: p.ticker, name: p.name, sector: p.sector, currency: p.currency,
      qty, avgPrice: avg, price, live,
      valueUsd, costUsd, pnlUsd, pnlPct, fxUsd, buyKrwPerUsd,
      costKrw, valueKrw, pnlKrw, pnlPctKrw,
      dayPct, dayUsd, spark: q?.spark ?? null, over: q?.over ?? null, prevClose: prev,
      weight: null, quoteTime: q?.time ?? null,
    };
  });

  const total = rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  for (const r of rows) r.weight = total > 0 && r.valueUsd != null ? r.valueUsd / total : null;
  rows.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
  return rows;
}

export function buildTotals(rows: HoldingRow[], quotes: QuoteMap): Totals {
  // 시세가 아직 없는 종목은 평가액이 null이라 합계에서 빠진다.
  // 원가도 같이 빼야 손익이 부풀지 않는다.
  const priced = rows.filter((r) => r.valueUsd != null);
  const valueUsd = priced.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const costUsd = priced.reduce((s, r) => s + (r.costUsd ?? 0), 0);
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

/** 원/달러 표기를 한 곳에서 갈아끼우기 위한 헬퍼. usdkrw가 없으면 달러로 떨어진다. */
export type Unit = "KRW" | "USD";

export function fmtMoney(usd: number | null, unit: Unit, usdkrw: number | null): string {
  if (usd == null) return "—";
  if (unit === "KRW" && usdkrw) return fmtKrw(usd * usdkrw);
  return fmtUsd(usd);
}

export function fmtSignedKrw(krw: number | null): string {
  if (krw == null) return "—";
  const v = Math.round(krw);
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return s + "₩" + Math.abs(v).toLocaleString("ko-KR");
}

export function fmtSignedMoney(usd: number | null, unit: Unit, usdkrw: number | null): string {
  if (usd == null) return "—";
  if (unit === "KRW" && usdkrw) return fmtSignedKrw(usd * usdkrw);
  return fmtSignedUsd(usd);
}

/** 큰 금액을 "6.9억원" 처럼 줄여 쓴다 (예산 표기용) */
export function fmtKrwShort(krw: number | null): string {
  if (krw == null) return "—";
  const eok = krw / 100_000_000;
  if (Math.abs(eok) >= 1) return `${eok.toFixed(2)}억원`;
  return `${Math.round(krw / 10_000).toLocaleString("ko-KR")}만원`;
}

/** 당일 변동폭 — 현지통화, 부호 포함 ("+3,500원", "−$2.25") */
export function fmtLocalDelta(currency: Currency, d: number | null): string {
  if (d == null) return "—";
  const sign = d > 0 ? "+" : d < 0 ? "−" : "";
  return sign + fmtLocalPrice(currency, Math.abs(d));
}

export function fmtLocalPrice(currency: Currency, n: number | null): string {
  if (n == null) return "—";
  switch (currency) {
    // 원화는 소수점이 없다 — 이동평균 평단에서 딸려오는 소수를 여기서 정리한다
    case "KRW": return Math.round(n).toLocaleString("ko-KR") + "원";
    case "USD": return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "EUR": return "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    case "GBp": return n.toLocaleString("en-US", { maximumFractionDigits: 1 }) + "p";
    case "TWD": return "NT$" + n.toLocaleString("en-US", { maximumFractionDigits: 1 });
  }
}
