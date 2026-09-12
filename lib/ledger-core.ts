import type { Currency } from "@/lib/portfolio";

/**
 * 원장 리플레이 — 순수 함수.
 *
 * `lib/trades.ts`는 번들에 포함된 JSON으로 이걸 한 번 돌려 쓰고,
 * `app/api/trade`는 GitHub에서 갓 받아온 JSON으로 같은 함수를 돌린다.
 * **로직을 두 벌로 복사하면 안 된다** — 갈라지는 순간 화면의 수량·평단과
 * 서버가 기록하는 값이 어긋나고, 그 어긋남은 조용히 수익률까지 번진다.
 */

export interface LedgerTrade {
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

export interface LedgerOpening {
  ticker: string;
  qty: number;
  avgPrice: number;
  currency: string;
  fxToUsd?: number;
  krwPerUsd?: number;
  note?: string;
}

export interface LedgerFile {
  aumUsd: number;
  openingPositions: { asOf: string; krwPerUsd?: number; positions: LedgerOpening[] };
  meetings: { no: number; date: string; note: string; executed?: string }[];
  trades: LedgerTrade[];
}

export interface BookEntry {
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

export interface ReplayResult {
  book: Map<string, BookEntry>;
  realized: RealizedLot[];
  buysUsd: number;
  sellsUsd: number;
  openingCostUsd: number;
  /** 체결일 오름차순 정렬본 */
  sorted: LedgerTrade[];
}

/**
 * 기초 보유분 + 체결 원장을 순서대로 적용해 종목별 장부와 실현손익을 만든다.
 * 평단은 이동평균법. 매도 시 현지통화 평단은 유지하고 수량만 줄인다.
 *
 * 실현손익은 매도대금(USD) − 그 수량의 취득원가(USD)로 계산한다.
 * 현지통화 손익에 매도일 환율만 곱하면 매수~매도 사이의 환차손익이 통째로 빠진다.
 * 우리 AUM이 달러 기준이므로 환차손익도 실현손익의 일부다.
 */
export function replayLedger(ledger: LedgerFile): ReplayResult {
  const book = new Map<string, BookEntry>();
  for (const p of ledger.openingPositions.positions) {
    const usd = p.qty * p.avgPrice * (p.fxToUsd ?? 1);
    book.set(p.ticker, {
      qty: p.qty,
      avg: p.avgPrice,
      usdCost: usd,
      krwCost: usd * (p.krwPerUsd ?? 1),
    });
  }

  // 원장 순서를 신뢰하지 않고 항상 체결일로 정렬해서 쓴다
  const sorted = [...ledger.trades].sort((a, b) => a.date.localeCompare(b.date));

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

  const openingCostUsd = ledger.openingPositions.positions.reduce(
    (s, p) => s + p.qty * p.avgPrice * (p.fxToUsd ?? 1),
    0
  );

  return { book, realized, buysUsd, sellsUsd, openingCostUsd, sorted };
}

/**
 * 매수·매도 후의 상태값. `holdings.json`의 status는 화면 알약과
 * AP·MP의 원인 분류(`집행 부족`)에 쓰이므로 원장과 같이 움직여야 한다.
 */
export function deriveStatus(qty: number, spentUsd: number, targetUsd: number): "미매수" | "매수중" | "매수완료" | "매도" {
  if (qty <= 0) return spentUsd > 0 ? "매도" : "미매수";
  if (targetUsd > 0 && spentUsd >= targetUsd * 0.95) return "매수완료";
  return "매수중";
}
