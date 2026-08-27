"use client";

import Logo from "@/components/Logo";
import {
  HOLDINGS, fmtPct, fmtUsd, fmtSignedMoney, sectorColorVar, tickerColorVar,
  type HoldingRow, type Unit,
} from "@/lib/portfolio";
import { AUM_USD, cashUsd, costOf } from "@/lib/trades";

/**
 * 목표 대비 허용 밴드 — 절대값(±1%p)이 아니라 목표의 ±25%.
 * 1.3%짜리 자리에 ±1%p를 걸면 사실상 밴드가 없는 것과 같아서다.
 */
const BAND = 0.25;

/** 괴리의 원인. 숫자는 같아도 성격이 정반대라 섞으면 액션이 안 나온다. */
type Cause = "미집행" | "집행 부족" | "드리프트" | "정상";

export interface AllocRow {
  key: string;
  ticker: string | null;
  name: string;
  sector: string;
  mp: number;            // 목표 비중
  ap: number;            // 현재 평가 비중
  gap: number;           // ap − mp
  cause: Cause;
  shortfallUsd: number;  // 목표 대비 덜 집행한 금액 (집행분만)
  pnlUsd: number | null;
  share: number | null;  // 총손익 기여도
  outOfBand: boolean;
}

export function buildAllocRows(rows: HoldingRow[]): { rows: AllocRow[]; nav: number; pnlTotal: number; cash: number } {
  const held = new Map(rows.map((r) => [r.ticker, r]));
  const invested = rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const nav = invested + cashUsd;
  const pnlTotal = rows.reduce((s, r) => s + (r.pnlUsd ?? 0), 0);

  const out: AllocRow[] = HOLDINGS.positions
    .filter((p) => p.targetUsd > 0 || (held.get(p.ticker)?.valueUsd ?? 0) > 0)
    .map((p) => {
      const r = held.get(p.ticker);
      const mp = p.targetWeight;
      const ap = nav > 0 ? (r?.valueUsd ?? 0) / nav : 0;
      const spent = costOf(p.ticker)?.usd ?? 0;
      const shortfall = Math.max(p.targetUsd - spent, 0);

      // 미매수 → 미집행. 목표액의 5% 넘게 덜 샀으면 집행 부족.
      // 둘 다 아닌데 벌어져 있으면 가격이 만든 드리프트다.
      let cause: Cause;
      if (p.status === "미매수" || spent <= 0) cause = "미집행";
      else if (p.status !== "매수완료" && shortfall > p.targetUsd * 0.05) cause = "집행 부족";
      else cause = Math.abs(ap - mp) > mp * BAND ? "드리프트" : "정상";

      const pnlUsd = r?.pnlUsd ?? null;
      return {
        key: p.ticker,
        ticker: p.ticker,
        name: p.name,
        sector: p.sector,
        mp, ap, gap: ap - mp, cause,
        shortfallUsd: cause === "정상" || cause === "드리프트" ? 0 : shortfall,
        pnlUsd,
        share: pnlTotal !== 0 && pnlUsd != null ? pnlUsd / pnlTotal : null,
        outOfBand: mp > 0 && Math.abs(ap - mp) > mp * BAND,
      };
    });

  // 미집행 현금은 종목이 아니라서 MP에 자리가 없다.
  // 현금 정책(SGOV)과 성격이 완전히 다르므로 별도 행으로 세운다.
  if (cashUsd > 0.005 * nav) {
    const ap = nav > 0 ? cashUsd / nav : 0;
    out.push({
      key: "__cash__",
      ticker: null,
      name: "미집행 현금",
      sector: "현금",
      mp: 0, ap, gap: ap, cause: "미집행",
      shortfallUsd: cashUsd,
      pnlUsd: null, share: null,
      outOfBand: true,
    });
  }

  out.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  return { rows: out, nav, pnlTotal, cash: cashUsd };
}

function causeClass(c: Cause): string {
  return c === "미집행" ? "miss" : c === "집행 부족" ? "short" : c === "드리프트" ? "drift" : "ok";
}

export default function Allocation({
  rows, unit, usdkrw,
}: {
  rows: HoldingRow[];
  unit: Unit;
  usdkrw: number | null;
}) {
  const { rows: alloc, nav, pnlTotal, cash } = buildAllocRows(rows);
  const offBand = alloc.filter((a) => a.outOfBand).length;
  // 미체결 목표와 현금은 절대 더하지 않는다 — 현금은 그 목표를 채울 재원이라
  // 합치면 "가진 돈보다 많이 사야 한다"는 뜻이 돼버린다.
  const shortfall = alloc
    .filter((a) => a.ticker != null && (a.cause === "미집행" || a.cause === "집행 부족"))
    .reduce((s, a) => s + a.shortfallUsd, 0);
  // 발산형 막대의 스케일 — 가장 큰 괴리가 절반 폭을 차지하게 맞춘다
  const maxGap = Math.max(...alloc.map((a) => Math.abs(a.gap)), 0.01);

  return (
    <section className="section" role="tabpanel" aria-label="AP·MP 비중 괴리">
      <div className="section-head">
        <h2 className="sr-only">AP · MP 비중 괴리</h2>
        <span className="meta num">
          밴드(±{Math.round(BAND * 100)}%) 이탈 {offBand}종목 · 미체결 목표 {fmtUsd(shortfall)} · 가용 현금 {fmtUsd(cash)}
        </span>
      </div>

      <p className="alloc-note">
        <b>MP</b>는 전략상 목표 비중, <b>AP</b>는 실제 계좌 비중이다. 괴리가 같아도 원인이
        <em> 미집행</em>(아직 안 샀다)·<em>집행 부족</em>(목표만큼 못 채웠다)이냐
        <em> 드리프트</em>(사놓았는데 가격이 움직였다)냐에 따라 할 일이 정반대라 나눠서 표시한다.
        비중은 모두 <b>총자산 {fmtUsd(nav)}</b>(평가액+현금) 대비다.
      </p>

      <div className="alloc-head">
        <span>종목</span>
        <span className="num">MP</span>
        <span className="num">AP</span>
        <span>괴리</span>
        <span className="num">기여도</span>
      </div>

      {alloc.map((a) => {
        const half = (Math.abs(a.gap) / maxGap) * 50;
        return (
          <div key={a.key} className="alloc-row" data-cash={a.ticker == null || undefined}>
            <span className="nm">
              {a.ticker ? (
                <Logo
                  ticker={a.ticker}
                  name={a.name}
                  color={tickerColorVar(a.ticker, 0)}
                  size={22}
                />
              ) : (
                <i className="alloc-dot" style={{ background: sectorColorVar(a.sector) }} />
              )}
              <span className="alloc-nm">{a.name}</span>
              <span className={`alloc-cause ${causeClass(a.cause)}`}>{a.cause}</span>
            </span>

            <span className="num alloc-mp">{a.mp > 0 ? (a.mp * 100).toFixed(1) + "%" : "—"}</span>
            <span className="num alloc-ap">{(a.ap * 100).toFixed(1) + "%"}</span>

            <span className="alloc-gap">
              <span className="alloc-bar">
                <i
                  data-dir={a.gap >= 0 ? "over" : "under"}
                  style={a.gap >= 0 ? { left: "50%", width: `${half}%` } : { right: "50%", width: `${half}%` }}
                />
              </span>
              <b className={`num alloc-gapn ${a.gap >= 0 ? "over" : "under"}`}>
                {(a.gap >= 0 ? "+" : "−") + Math.abs(a.gap * 100).toFixed(1) + "%p"}
              </b>
              {a.shortfallUsd > 0 && (
                <span className="alloc-short" title="목표까지 남은 집행 금액">
                  잔여 {fmtUsd(a.shortfallUsd)}
                </span>
              )}
            </span>

            <span className="num alloc-share">
              {a.share != null ? (
                <>
                  <b className={a.share >= 0 ? "gain" : "loss"}>
                    {(a.share >= 0 ? "" : "−") + Math.abs(a.share * 100).toFixed(1)}%
                  </b>
                  <span className="alloc-pnl">{fmtSignedMoney(a.pnlUsd, unit, usdkrw)}</span>
                </>
              ) : (
                "—"
              )}
            </span>
          </div>
        );
      })}

      <p className="alloc-foot num">
        총손익 {fmtSignedMoney(pnlTotal, unit, usdkrw)} · AUM {fmtUsd(AUM_USD)} 대비 {fmtPct(pnlTotal / AUM_USD)}
        {cash > 0 && <> · 가용 현금 {fmtUsd(cash)}</>}
      </p>
    </section>
  );
}
