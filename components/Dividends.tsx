"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { fmtUsd, tickerColorVar } from "@/lib/portfolio";

/**
 * 배당 수익 — 운용 개시 후 배당락일 기준으로 받은 배당을 종목별로 집계한다.
 * 매매 내역 탭 하단: 매매가 만든 손익과 별개로 "들고만 있어도 들어오는 현금"을 보여준다.
 */

interface DivEvent { exDate: string; perShare: number; qty: number; amountNative: number; amountUsd: number }
interface DivRow {
  ticker: string; name: string; currency: string;
  yieldPct: number | null; perYear: number; subtotalUsd: number; events: DivEvent[];
}
interface DivResp { since: string; totalUsd: number; krwPerUsd: number; rows: DivRow[] }

const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};
const fmtNative = (v: number, cur: string) =>
  cur === "KRW" ? `₩${Math.round(v).toLocaleString("ko-KR")}` : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Dividends() {
  const [data, setData] = useState<DivResp | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dividends")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: DivResp) => { setData(d); setState("ok"); })
      .catch(() => setState("fail"));
  }, []);

  if (state === "fail") return null;

  return (
    <section className="section div-sec" aria-label="배당 수익">
      <div className="section-head">
        <h2>배당 수익</h2>
        {data && (
          <span className="meta num">
            운용 개시 후 수령 <b className="gain">{fmtUsd(data.totalUsd, 0)}</b> · 배당락일 기준
          </span>
        )}
      </div>
      {state === "loading" && <p className="log-empty">배당 내역 계산 중…</p>}
      {data && data.rows.filter((r) => r.events.length).length === 0 && (
        <p className="log-empty">운용 개시 후 배당락일이 지난 배당이 아직 없습니다.</p>
      )}
      {data && data.rows.filter((r) => r.events.length).map((r) => {
        const isOpen = open === r.ticker;
        return (
          <div key={r.ticker}>
            <button className="div-row" data-open={isOpen} onClick={() => setOpen(isOpen ? null : r.ticker)} aria-expanded={isOpen}>
              <Logo ticker={r.ticker} name={r.name} color={tickerColorVar(r.ticker, 0)} size={24} />
              <span className="div-id">
                <b>{r.name}</b>
                <span className="div-sub num">
                  {r.yieldPct != null && <span>연 배당수익률 약 {r.yieldPct}%</span>}
                  <span>연 {r.perYear}회 지급</span>
                  <span>{r.events.length}건 수령</span>
                </span>
              </span>
              <span className="div-amt num gain">+{fmtUsd(r.subtotalUsd, 2)}</span>
              <span className="hold-caret" aria-hidden>›</span>
            </button>
            {isOpen && (
              <div className="div-detail">
                {r.events.map((e, i) => (
                  <div key={i} className="div-ev num">
                    <span className="d">{fmtDate(e.exDate)}</span>
                    <span className="q">{e.qty.toLocaleString()}주 × {fmtNative(e.perShare, r.currency)}</span>
                    <span className="n">{fmtNative(e.amountNative, r.currency)}</span>
                    <span className="u gain">+{fmtUsd(e.amountUsd, 2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="log-foot">
        배당락일에 보유한 수량 기준으로 집계하며, 실제 입금(지급일)은 통상 2주~1개월 뒤입니다.
        원화 배당은 현재 환율로 환산해 표시합니다. 배당금은 현금 잔고와 별도로 집계합니다 — 원장 반영 방식은 회의에서 결정합니다.
      </p>
    </section>
  );
}
