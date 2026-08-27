"use client";

import { useEffect, useState } from "react";
import Logo from "@/components/Logo";
import { tickerColorVar } from "@/lib/portfolio";

interface Reason { t: string; good: boolean }
interface StockSignal {
  ticker: string; name: string; sector: string; status: string;
  score: number; label: "강세" | "중립" | "약세";
  close: number; chg1d: number | null; rsi: number | null;
  reasons: Reason[];
}
interface MarketItem { name: string; value: string; note: string; good: boolean | null }
interface SignalsResp {
  asOf: string;
  market: { label: string; score: number; items: MarketItem[] };
  stocks: StockSignal[];
  /** 미보유 관심 종목 — 보유 섹터의 이웃들 */
  watch?: StockSignal[];
}

function SigRow({ s, idx }: { s: StockSignal; idx: number }) {
  const isWatch = s.status === "관심";
  return (
    <div className="sig-row">
      <Logo ticker={s.ticker} name={s.name} color={tickerColorVar(s.ticker, idx)} size={26} />
      <div className="sig-main">
        <div className="sig-id">
          <b>{s.name}</b>
          <span className="tk mono">{s.ticker}</span>
          {isWatch
            ? <span className="st">{s.sector}</span>
            : <span className="st">{s.status}</span>}
          {isWatch && <span className={`sig-badge sm ${s.label === "강세" ? "hot" : s.label === "약세" ? "cold" : ""}`}>{s.label}</span>}
        </div>
        <div className="sig-chips">
          {s.reasons.map((r, i) => (
            <i key={i} className={r.good ? "good" : "bad"}>{r.t}</i>
          ))}
        </div>
      </div>
      <div className="sig-nums num">
        {s.chg1d != null && (
          <span className={s.chg1d > 0 ? "gain" : s.chg1d < 0 ? "loss" : "flat"}>
            전일 {s.chg1d >= 0 ? "+" : "−"}{Math.abs(s.chg1d * 100).toFixed(1)}%
          </span>
        )}
        {s.rsi != null && <span>RSI {s.rsi}</span>}
      </div>
    </div>
  );
}

/**
 * 오늘의 분석 — 규칙 기반 시그널 보드 (팀 전용).
 * 추세(MA20·60)·모멘텀·RSI를 점수화해 강세/중립/약세로 나누고,
 * 매크로 5종으로 시장 온도를 판정한다. 근거 칩을 항상 함께 보여 블랙박스를 피한다.
 */
export default function DailySignals() {
  const [data, setData] = useState<SignalsResp | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");

  useEffect(() => {
    fetch("/api/signals")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SignalsResp) => { setData(d); setState("ok"); })
      .catch(() => setState("fail"));
  }, []);

  if (state === "loading") return <section className="section" role="tabpanel"><p className="log-empty">시그널 계산 중…</p></section>;
  if (state === "fail" || !data) return <section className="section" role="tabpanel"><p className="log-empty">시그널을 불러오지 못했습니다.</p></section>;

  const groups: { key: StockSignal["label"]; title: string; sub: string }[] = [
    { key: "강세", title: "흐름이 좋은 종목", sub: "추세·모멘텀이 살아있는 종목 — 분할 매수·보유 유지에 우호적" },
    { key: "중립", title: "중립", sub: "신호가 엇갈리는 구간 — 서두를 이유 없음" },
    { key: "약세", title: "주의가 필요한 종목", sub: "추세가 꺾였거나 과열 — 신규 매수는 근거를 다시 점검" },
  ];
  const tone = (label: string) => (label === "강세" ? "hot" : label === "약세" ? "cold" : "flat");

  return (
    <section className="section" role="tabpanel" aria-label="오늘의 분석">
      <div className="section-head">
        <h2>오늘의 분석</h2>
        <span className="meta num">{new Date(data.asOf).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })} 계산</span>
      </div>

      {/* 시장 온도 */}
      <div className={`sig-market ${tone(data.market.label)}`}>
        <div className="sig-market-head">
          <span className="k">시장 온도</span>
          <b>{data.market.label}</b>
        </div>
        <ul className="sig-market-items">
          {data.market.items.map((it, i) => (
            <li key={i} className={it.good == null ? "" : it.good ? "good" : "bad"}>
              <span className="n">{it.name}</span>
              {it.value && <b className="num">{it.value}</b>}
              <span className="note">{it.note}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 종목 시그널 */}
      {groups.map((g) => {
        const list = data.stocks.filter((s) => s.label === g.key);
        if (!list.length) return null;
        return (
          <div key={g.key} className="sig-group">
            <div className="sig-group-head">
              <h3><span className={`sig-badge ${tone(g.key)}`}>{g.key}</span>{g.title} <span className="cnt num">{list.length}</span></h3>
              <p>{g.sub}</p>
            </div>
            {list.map((s, i) => <SigRow key={s.ticker} s={s} idx={i} />)}
          </div>
        );
      })}

      {/* 미보유 관심 종목 — 보유 섹터의 이웃들, 같은 규칙으로 계산 */}
      {!!data.watch?.length && (
        <div className="sig-group sig-watch">
          <div className="sig-group-head">
            <h3><span className="sig-badge">관심</span>미보유 관심 종목 <span className="cnt num">{data.watch.length}</span></h3>
            <p>보유 섹터에 물리는 이웃 종목 — 같은 규칙으로 계산한 참고 시그널</p>
          </div>
          {data.watch.map((s, i) => <SigRow key={s.ticker} s={s} idx={i} />)}
        </div>
      )}

      <p className="log-foot">
        MA20·MA60 추세, 20일 모멘텀, 골든·데드크로스, RSI(14)를 점수화한 규칙 기반 시그널로, 30분마다 갱신됩니다.
        기업 실적·뉴스는 반영되지 않으므로 참고용이며, 매매 판단은 회의에서 결정합니다.
      </p>
    </section>
  );
}
