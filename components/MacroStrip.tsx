"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MACRO, fmtMacro, fmtMacroDelta, type MacroSpec } from "@/lib/macro";
import { fmtPct, type QuoteMap } from "@/lib/portfolio";
import type { MarketStatus } from "@/lib/market";
import Sparkline from "@/components/Sparkline";

/** 전일 대비 방향. 장이 끝나 종가가 굳어도 부호는 유지된다. */
function move(spec: MacroSpec, quotes: QuoteMap) {
  const q = quotes[spec.symbol];
  const price = q?.price ?? null;
  const prev = q?.prevClose ?? null;
  const spark = q?.spark ?? [];
  // 전일 종가가 비면 당일 시계열의 처음↔끝으로 방향을 잡는 안전장치
  const from = prev ?? (spark.length >= 2 ? spark[0] : null);
  const chg = price != null && from ? (price - from) / from : null;
  const dir = chg == null ? 0 : chg > 0 ? 1 : chg < 0 ? -1 : 0;
  return { price, prev, spark, from, chg, dir, tone: dir > 0 ? "gain" : dir < 0 ? "loss" : "flat" };
}

export default function MacroStrip({
  quotes,
  markets,
}: {
  quotes: QuoteMap;
  markets: MarketStatus[] | null;
}) {
  // 메인은 어디까지나 포트폴리오다 — 지표는 접힌 한 줄이 기본이고, 편 상태만 기억한다.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(localStorage.getItem("gaa-macro") === "open");
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem("gaa-macro", next ? "open" : "closed");
  };

  // 접힌 줄은 가로로 스크롤된다. 양끝에 더 남았는지에 따라 페이드를 켠다 —
  // 끝까지 밀었는데도 흐려 보이면 잘린 것처럼 읽히므로 방향별로 따로 판단한다.
  const miniRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ l: false, r: false });
  const syncEdge = useCallback(() => {
    const el = miniRef.current;
    if (!el) return;
    setEdge({
      l: el.scrollLeft > 1,
      r: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);
  useEffect(() => {
    const el = miniRef.current;
    if (!el) return;
    syncEdge();
    el.addEventListener("scroll", syncEdge, { passive: true });
    // 마우스 세로 휠을 가로 스크롤로 바꾼다 (트랙패드 가로 제스처는 그대로 통과)
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      if (el.scrollWidth <= el.clientWidth) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(syncEdge);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncEdge);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [syncEdge, open, quotes]);

  const sessions = markets && (
    <span className="macro-sessions">
      {markets.map((m) => (
        <span key={m.code} className="mkt-pill" data-open={m.open} title={m.hint}>
          <span className="dot" aria-hidden />
          {m.label} {m.open ? "장중" : "마감"}
          {open && <span className="hrs">{m.hint}</span>}
        </span>
      ))}
    </span>
  );

  const toggleBtn = (
    <button className="macro-toggle" onClick={toggle} aria-expanded={open}>
      {open ? "접기" : `지표 ${MACRO.length}개`}
      <span className="caret" aria-hidden>{open ? "▴" : "▾"}</span>
    </button>
  );

  if (!open) {
    return (
      <section className="macro compact" aria-label="주요 지표">
        <div className="macro-line">
          {sessions}
          <div className="macro-mini" ref={miniRef} data-l={edge.l} data-r={edge.r}>
            {MACRO.map((m) => {
              const v = move(m, quotes);
              return (
                <span key={m.symbol} className="mini" title={m.hint}>
                  <span className="l">{m.label}</span>
                  <span className="v num">{fmtMacro(m, v.price)}</span>
                  <span className={`c num ${v.tone}`}>{v.chg == null ? "—" : fmtPct(v.chg, 2)}</span>
                </span>
              );
            })}
          </div>
          {toggleBtn}
        </div>
      </section>
    );
  }

  return (
    <section className="macro" aria-label="주요 지표">
      <div className="macro-head">
        {sessions}
        {toggleBtn}
      </div>

      <div className="macro-grid">
        {MACRO.map((m) => {
          const v = move(m, quotes);
          return (
            <div key={m.symbol} className="macro-card" title={m.hint}>
              <Sparkline data={v.spark} dir={v.dir} base={v.prev} />
              <div className="macro-body">
                <div className="macro-name">
                  {m.label}
                  <span className="tag">{m.tag}</span>
                </div>
                <div className="macro-val num">{fmtMacro(m, v.price)}</div>
                <div className={`macro-chg num ${v.tone}`}>
                  {v.price != null && v.from != null ? (
                    <>
                      {fmtMacroDelta(m, v.price, v.from)}
                      <span className="p"> ({fmtPct(v.chg, 2)})</span>
                    </>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
