import ledger from "@/data/trades.json";
import divLedger from "@/data/dividend-ledger.json";
import type { Currency } from "@/lib/portfolio";
import { replayLedger, type LedgerFile } from "@/lib/ledger-core";
export type { RealizedLot } from "@/lib/ledger-core";

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
// 정렬본은 리플레이가 만들어 준다 (원장 순서를 신뢰하지 않는다)

interface Book {
  qty: number;
  avg: number;
  usdCost: number;
  krwCost: number;
}

/** 종목별 확정 취득원가 (달러·원화 양쪽) */
export interface CostBasis {
  usd: number;
  krw: number;
}

const REPLAY = replayLedger(LEDGER as LedgerFile);

/** 매도로 확정된 손익 합계 (USD) */
export const realizedUsd = REPLAY.realized.reduce((s, r) => s + r.gainUsd, 0);
export const realizedLots = REPLAY.realized;

/**
 * 남은 현금.
 * AUM에서 기초 보유원가와 이후 매수액을 빼고 매도 대금을 더한다.
 * 배당·수수료는 모의투자라 반영하지 않는다.
 */
/** 배당 수령 누적 — 배당락일 기준 확정분 (data/dividend-ledger.json). 현금으로 들어와 SGOV 재투자 재원이 된다 */
export const dividendUsd = (divLedger as { items: { usd: number }[] }).items.reduce((s, i) => s + i.usd, 0);

const cashBase =
  AUM_USD - REPLAY.openingCostUsd - REPLAY.buysUsd + REPLAY.sellsUsd;
export const cashUsd = cashBase + dividendUsd;

/** 지금까지 실제로 투입된 원가 (기초 + 매수 − 매도분 원가) — 배당과는 무관 */
export const investedUsd = AUM_USD - cashBase;

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
  return REPLAY.sorted.filter((t) => t.ticker === ticker).reverse();
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
  for (const t of REPLAY.sorted) {
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
