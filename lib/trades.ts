import ledger from "@/data/trades.json";
import type { Currency } from "@/lib/portfolio";

export interface Trade {
  date: string;
  ticker: string;
  side: "매수" | "매도";
  qty: number;
  price: number;
  currency: Currency;
  /** 현지통화 1단위당 USD — 체결 시점 고정 */
  fxToUsd: number;
  /** 체결 시점 원/달러 — 원화 기준 원가 계산용, 고정 */
  krwPerUsd: number;
  usd: number;
  meeting?: number;
  note: string;
}

export interface Meeting {
  no: number;
  date: string;
  note: string;
  executed?: string;
}

interface OpeningPosition {
  ticker: string;
  qty: number;
  avgPrice: number;
  currency: string;
  fxToUsd?: number;
  krwPerUsd?: number;
  /** 개시 편입 근거 — 1차 회의에서 이 종목을 고른 이유 */
  note?: string;
}

export const LEDGER = ledger as unknown as {
  aumUsd: number;
  openingPositions: { asOf: string; krwPerUsd?: number; positions: OpeningPosition[] };
  meetings: Meeting[];
  trades: Trade[];
};

export const TRADES: Trade[] = LEDGER.trades;
export const MEETINGS: Meeting[] = LEDGER.meetings;
export const AUM_USD = LEDGER.aumUsd;

/** 체결일 오름차순 — 원장 순서를 신뢰하지 않고 항상 정렬해서 쓴다 */
const sorted = [...TRADES].sort((a, b) => a.date.localeCompare(b.date));

export interface RealizedLot {
  date: string;
  ticker: string;
  qty: number;
  /** 현지통화 매도가 */
  price: number;
  /** 매도 시점 평단가 (현지통화) */
  avgAtSale: number;
  currency: Currency;
  /** 실현손익 — 체결 시점 환율로 환산한 USD */
  gainUsd: number;
  pct: number;
  meeting?: number;
  note: string;
}

interface Book {
  qty: number;
  /** 현지통화 평단 — 화면 표기용 */
  avg: number;
  /**
   * 취득원가. 체결 시점 환율로 확정하고 이후 절대 다시 환산하지 않는다.
   * 오늘 환율로 원가를 재환산하면 환차손익이 상쇄돼 사라진다 — 이게 핵심이다.
   */
  usdCost: number;
  krwCost: number;
}

/** 종목별 확정 취득원가 (달러·원화 양쪽) */
export interface CostBasis {
  usd: number;
  krw: number;
}

/**
 * 기초 보유분 + 체결 원장을 순서대로 적용해 종목별 장부와 실현손익을 만든다.
 * 평단은 이동평균법. 매도 시 현지통화 평단은 유지하고 수량만 줄인다.
 *
 * 실현손익은 매도대금(USD) − 그 수량의 취득원가(USD)로 계산한다.
 * 현지통화 손익에 매도일 환율만 곱하면 매수~매도 사이의 환차손익이 통째로 빠진다.
 * 우리 AUM이 달러 기준이므로 환차손익도 실현손익의 일부다.
 */
function replay() {
  const book = new Map<string, Book>();
  for (const p of LEDGER.openingPositions.positions) {
    const usd = p.qty * p.avgPrice * (p.fxToUsd ?? 1);
    book.set(p.ticker, {
      qty: p.qty,
      avg: p.avgPrice,
      usdCost: usd,
      krwCost: usd * (p.krwPerUsd ?? 1),
    });
  }

  const realized: RealizedLot[] = [];
  let buysUsd = 0;
  let sellsUsd = 0;

  for (const t of sorted) {
    const b = book.get(t.ticker) ?? { qty: 0, avg: 0, usdCost: 0, krwCost: 0 };
    if (t.side === "매수") {
      const q = b.qty + t.qty;
      book.set(t.ticker, {
        qty: q,
        avg: (b.qty * b.avg + t.qty * t.price) / q,
        usdCost: b.usdCost + t.usd,
        krwCost: b.krwCost + t.usd * t.krwPerUsd,
      });
      buysUsd += t.usd;
    } else {
      // 매도한 수량 몫의 취득원가
      const costOut = b.qty > 0 ? (b.usdCost * t.qty) / b.qty : 0;
      const krwOut = b.qty > 0 ? (b.krwCost * t.qty) / b.qty : 0;
      const gainUsd = t.usd - costOut;
      realized.push({
        date: t.date,
        ticker: t.ticker,
        qty: t.qty,
        price: t.price,
        avgAtSale: b.avg,
        currency: t.currency,
        gainUsd,
        pct: costOut > 0 ? gainUsd / costOut : 0,
        meeting: t.meeting,
        note: t.note,
      });
      book.set(t.ticker, {
        qty: b.qty - t.qty,
        avg: b.avg,
        usdCost: b.usdCost - costOut,
        krwCost: b.krwCost - krwOut,
      });
      sellsUsd += t.usd;
    }
  }

  const openingCostUsd = LEDGER.openingPositions.positions.reduce(
    (s, p) => s + p.qty * p.avgPrice * (p.fxToUsd ?? 1),
    0
  );

  return { book, realized, buysUsd, sellsUsd, openingCostUsd };
}

const REPLAY = replay();

/** 매도로 확정된 손익 합계 (USD) */
export const realizedUsd = REPLAY.realized.reduce((s, r) => s + r.gainUsd, 0);
export const realizedLots = REPLAY.realized;

/**
 * 남은 현금.
 * AUM에서 기초 보유원가와 이후 매수액을 빼고 매도 대금을 더한다.
 * 배당·수수료는 모의투자라 반영하지 않는다.
 */
export const cashUsd =
  AUM_USD - REPLAY.openingCostUsd - REPLAY.buysUsd + REPLAY.sellsUsd;

/** 지금까지 실제로 투입된 원가 (기초 + 매수 − 매도분 원가) */
export const investedUsd = AUM_USD - cashUsd;

export const totalBuysUsd = REPLAY.buysUsd;
export const totalSellsUsd = REPLAY.sellsUsd;

/**
 * 종목별 확정 취득원가. 체결 시점 환율로 굳어 있어 오늘 환율에 흔들리지 않는다.
 * 화면의 평가손익은 반드시 이 값을 기준으로 계산해야 환차손익이 드러난다.
 */
export function costOf(ticker: string): CostBasis | null {
  const b = REPLAY.book.get(ticker);
  if (!b || b.qty <= 0) return null;
  return { usd: b.usdCost, krw: b.krwCost };
}

/** 종목별 체결 이력 — 최신순 */
export function tradesOf(ticker: string): Trade[] {
  return sorted.filter((t) => t.ticker === ticker).reverse();
}

/** 개시 포트폴리오 편입일 */
export const OPENING_DATE = LEDGER.openingPositions.asOf;

/**
 * 개시 포트폴리오(첫 편입) 정보 — 이후 체결과 구분해 보여준다.
 * 원가 재생에는 이미 반영돼 있어 표시 전용이다.
 */
export function openingOf(ticker: string): OpeningPosition | null {
  return LEDGER.openingPositions.positions.find((p) => p.ticker === ticker) ?? null;
}

export const OPENING_POSITIONS = LEDGER.openingPositions.positions;

/** 체결일 기준 내림차순 그룹 (최근 매매가 위로) */
export interface TradeDay {
  date: string;
  meeting?: number;
  meetingDate?: string;
  trades: Trade[];
  buyUsd: number;
  sellUsd: number;
}

export function tradeDays(): TradeDay[] {
  const byDate = new Map<string, Trade[]>();
  for (const t of sorted) {
    const list = byDate.get(t.date) ?? [];
    list.push(t);
    byDate.set(t.date, list);
  }
  return [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, trades]) => {
      const meeting = trades.find((t) => t.meeting)?.meeting;
      return {
        date,
        meeting,
        meetingDate: MEETINGS.find((m) => m.no === meeting)?.date,
        trades,
        buyUsd: trades.filter((t) => t.side === "매수").reduce((s, t) => s + t.usd, 0),
        sellUsd: trades.filter((t) => t.side === "매도").reduce((s, t) => s + t.usd, 0),
      };
    });
}

/** "2026-08-05" → "8/5 (수)" */
export function fmtTradeDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d} (${wd})`;
}
