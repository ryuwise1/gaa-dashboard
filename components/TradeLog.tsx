"use client";

import { useMemo, useState } from "react";
import {
  HOLDINGS, fmtLocalPrice, fmtMoney, fmtPct, fmtSignedMoney, tickerColorVar,
  type Currency, type Unit,
} from "@/lib/portfolio";
import { MEETINGS, OPENING_DATE, OPENING_POSITIONS, fmtTradeDate, realizedLots, realizedUsd, tradeDays, totalBuysUsd, totalSellsUsd } from "@/lib/trades";
import Logo from "@/components/Logo";

const NAME = new Map(HOLDINGS.positions.map((p) => [p.ticker, p.name]));
const SLOT = new Map(HOLDINGS.positions.map((p, i) => [p.ticker, i]));
const color = (t: string) => tickerColorVar(t, SLOT.get(t) ?? 0);

type Filter = "전체" | "매수" | "매도";

export default function TradeLog({ unit, usdkrw }: { unit: Unit; usdkrw: number | null }) {
  const [filter, setFilter] = useState<Filter>("전체");
  const [ticker, setTicker] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);

  const money = (usd: number | null) => fmtMoney(usd, unit, usdkrw);
  const signed = (usd: number | null) => fmtSignedMoney(usd, unit, usdkrw);

  const days = useMemo(() => tradeDays(), []);

  const tickers = useMemo(() => {
    const set = new Set<string>();
    for (const d of days) for (const t of d.trades) set.add(t.ticker);
    return [...set].sort();
  }, [days]);

  const shown = useMemo(
    () =>
      days
        .map((d) => ({
          ...d,
          trades: d.trades.filter(
            (t) => (filter === "전체" || t.side === filter) && (!ticker || t.ticker === ticker)
          ),
        }))
        .filter((d) => d.trades.length > 0),
    [days, filter, ticker]
  );

  const count = shown.reduce((s, d) => s + d.trades.length, 0);

  return (
    <section className="section" role="tabpanel" aria-label="매매 내역">
      <div className="log-controls">
        <div className="seg" role="group" aria-label="매매 구분 필터">
          {(["전체", "매수", "매도"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <label className="log-select">
          <span className="sr-only">종목 필터</span>
          <select value={ticker} onChange={(e) => setTicker(e.target.value)} aria-label="종목 필터">
            <option value="">모든 종목</option>
            {tickers.map((t) => (
              <option key={t} value={t}>
                {NAME.get(t) ?? t}
              </option>
            ))}
          </select>
        </label>
        <span className="num log-count">
          {count}건 · 매수 {money(totalBuysUsd)} / 매도 {money(totalSellsUsd)}
        </span>
      </div>

      {shown.length === 0 && <p className="log-empty">해당 조건의 체결 내역이 없습니다.</p>}

      <ol className="log">
        {shown.map((d) => (
          <li key={d.date} className="log-day">
            <div className="log-daybar">
              <span className="log-date num">{fmtTradeDate(d.date)}</span>
              {d.meeting ? (
                <span className="log-meet" title={`${d.meetingDate} 회의에서 결정`}>
                  {d.meeting}차 회의 결정
                </span>
              ) : (
                <span className="log-meet plain">정기회의 외</span>
              )}
              <span className="log-sum num">
                {d.buyUsd > 0 && <span className="b">매수 {money(d.buyUsd)}</span>}
                {d.sellUsd > 0 && <span className="s">매도 {money(d.sellUsd)}</span>}
              </span>
            </div>

            <ul className="log-items">
              {d.trades.map((t, i) => {
                const key = `${d.date}-${t.ticker}-${i}`;
                const isOpen = open === key;
                return (
                  <li key={key}>
                    <button className="log-row" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                      <Logo ticker={t.ticker} name={NAME.get(t.ticker) ?? t.ticker} color={color(t.ticker)} size={26} />
                      <span className="log-name">
                        <span className="nm">{NAME.get(t.ticker) ?? t.ticker}</span>
                        <span className="tk">
                          <span className={`side ${t.side === "매수" ? "buy" : "sell"}`}>{t.side}</span>
                          <span className="num">{t.qty.toLocaleString()}주 @ {fmtLocalPrice(t.currency as Currency, t.price)}</span>
                        </span>
                      </span>
                      <span className="log-fig">
                        <span className="a num">{money(t.usd)}</span>
                      </span>
                      <span className="log-caret" aria-hidden>{isOpen ? "▾" : "▸"}</span>
                    </button>
                    {isOpen && (
                      <div className="log-note">
                        {t.note}
                        {t.currency !== "USD" && (
                          <span className="log-fx num">
                            적용 환율{" "}
                            {t.currency === "KRW"
                              ? `${(1 / t.fxToUsd).toFixed(2)}원/$`
                              : t.currency === "GBp"
                                ? `${(t.fxToUsd * 100).toFixed(4)} USD/£`
                                : `${t.fxToUsd.toFixed(4)} USD/€`}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      {/* 7/29 — 1차 회의 결정으로 편입한 개시 포트폴리오. 이후 체결과 구분해 묶는다 */}
      {!ticker && filter !== "매도" && (
        <div className="log-day opening">
          <div className="log-daybar">
            <span className="log-date num">{fmtTradeDate(OPENING_DATE)}</span>
            <span className="log-meet plain">개시 포트폴리오 편입 (1차 회의 결정 · 적용 환율 1,450.1원)</span>
          </div>
          <ul className="log-items">
            {OPENING_POSITIONS.map((p) => {
              const cur = HOLDINGS.positions.find((h) => h.ticker === p.ticker);
              return (
                <li key={p.ticker}>
                  <div className="log-row static">
                    <Logo ticker={p.ticker} name={NAME.get(p.ticker) ?? p.ticker} color={color(p.ticker)} size={26} />
                    <span className="log-name">
                      <span className="nm">{NAME.get(p.ticker) ?? p.ticker}</span>
                      <span className="tk">
                        <span className="side base">개시</span>
                        <span className="num">{p.qty.toLocaleString()}주 @ {fmtLocalPrice((cur?.currency ?? "USD") as Currency, p.avgPrice)}</span>
                      </span>
                      {p.note && <span className="opening-note">{p.note}</span>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {realizedLots.length > 0 && (
        <div className="realized">
          <div className="realized-head">
            확정 손익 <b className={`num ${realizedUsd >= 0 ? "gain" : "loss"}`}>{signed(realizedUsd)}</b> — 매도 {realizedLots.length}건
          </div>
          {realizedLots.map((r) => (
            <div key={`${r.date}-${r.ticker}`} className="realized-row">
              <span className="nm">
                {NAME.get(r.ticker) ?? r.ticker}
                <span className="tk">{r.ticker}</span>
              </span>
              <span className={`g num ${r.gainUsd >= 0 ? "gain" : "loss"}`}>
                {signed(r.gainUsd)} ({fmtPct(r.pct, 1)})
              </span>
              <span className="d num">{fmtTradeDate(r.date)} · {r.qty.toLocaleString()}주</span>
              <span className="p num">
                {fmtLocalPrice(r.currency as Currency, r.avgAtSale)} → {fmtLocalPrice(r.currency as Currency, r.price)}
              </span>
            </div>
          ))}
        </div>
      )}

      <p className="log-foot">
        원본 <span className="mono">data/trades.json</span> · 정기회의{" "}
        {MEETINGS.filter((m) => m.executed).map((m) => `${m.no}차 ${m.date.slice(5).replace("-", "/")}`).join(" · ")}
      </p>
    </section>
  );
}
