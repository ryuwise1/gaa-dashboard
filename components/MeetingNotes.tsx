"use client";

import { useMemo, useState } from "react";
import notesJson from "@/data/meeting-notes.json";
import Logo from "@/components/Logo";
import { HOLDINGS, fmtLocalPrice, fmtPct, fmtSignedUsd, tickerColorVar, type Currency, type HoldingRow } from "@/lib/portfolio";
import { TRADES, fmtTradeDate, realizedLots } from "@/lib/trades";

/**
 * 회의록 문단은 한 덩어리 문자열이라 읽기 힘들다.
 * 원형 숫자(①②…)로 항목이 이어지면 그 앞에서 자르고, 없으면 문장 경계("~다." 뒤 공백)에서 자른다.
 * 첫 조각이 마커 없이 시작하면 리드 문장으로 따로 둔다 (예: "8/26 집행 완료 3건: ① … ② …").
 */
const MARK = /^[①-⑳]/;
function splitNote(s: string): { lead: string | null; items: string[] } {
  // 항목 머리의 마커만 자른다 — "(… 안건 ⑦)."처럼 문장 안에 인용된 원형 숫자는 그대로 둔다
  const circled = s.split(/(?<=^|[\s:：])(?=[①-⑳]\s)/).map((x) => x.trim()).filter(Boolean);
  if (circled.length > 1) {
    const lead = MARK.test(circled[0]) ? null : circled[0];
    return { lead, items: lead ? circled.slice(1) : circled };
  }
  // 문장 끝 = 한글·닫는 괄호 뒤의 마침표 + 공백 ("~함. ", "~기로 함. "도 잡힌다). 숫자 뒤 마침표(3.5%, 8/26.)는 건너뛴다
  const sents = s.split(/(?<=[가-힣)\]]\.)\s+/).map((x) => x.trim()).filter(Boolean);
  return { lead: null, items: sents };
}
/** 원형 숫자로 시작하는 항목은 불릿을 끄고 숫자를 내어쓰기한다 — 마커가 두 번 찍히지 않게 */
function Items({ items }: { items: string[] }) {
  return (
    <ul className="mtg-list">
      {items.map((s, i) => <li key={i} data-marked={MARK.test(s) || undefined}>{s}</li>)}
    </ul>
  );
}

interface Note {
  no: number; date: string; title: string;
  context: string; agenda: string[]; decisions: string;
  /** 기초 포트폴리오처럼 회의 이전에 깔려 있던 판단의 배경 */
  background?: string[];
}

const NOTES = (notesJson as { notes: Note[] }).notes;
const NAME = new Map(HOLDINGS.positions.map((p) => [p.ticker, p.name]));

/**
 * 회의록 — 노션 회의 내용의 요지 + 그 회의에서 결정한 체결이
 * 지금 어떤 성과인지를 원장에서 자동으로 되짚는다. 팀 전용 화면.
 */
export default function MeetingNotes({ rows }: { rows: HoldingRow[] }) {
  // 기본은 전부 접힘 — 목록에서 회차·성적 요약만 훑고, 필요한 회의만 펼친다 (9/9)
  const [open, setOpen] = useState<number | null>(null);

  const rowBy = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows]);

  // 회의별: 매수 건은 "그때 산 가격 → 지금", 매도 건은 확정 손익
  const perf = useMemo(() => {
    const m = new Map<number, { buys: { t: (typeof TRADES)[number]; nowPct: number | null }[]; sells: typeof realizedLots }>();
    for (const n of NOTES) {
      const buys = TRADES.filter((t) => t.meeting === n.no && t.side === "매수").map((t) => {
        const r = rowBy.get(t.ticker);
        const nowPct = r?.price != null ? (r.price - t.price) / t.price : null;
        return { t, nowPct };
      });
      const sells = realizedLots.filter((l) => l.meeting === n.no);
      m.set(n.no, { buys, sells });
    }
    return m;
  }, [rowBy]);

  return (
    <section className="section" role="tabpanel" aria-label="회의록">
      <p className="mtg-intro">
        회의별 논의와 결정, 그리고 그 결정의 현재 성과입니다. 체결 내역은 원장에서 자동으로 붙습니다.
        <span className="mtg-lock">팀 전용 화면 — 기본 주소에서는 보이지 않습니다</span>
      </p>

      {[...NOTES].reverse().map((n) => {
        const p = perf.get(n.no)!;
        const isOpen = open === n.no;
        const buyCount = p.buys.length;
        const avgNow = p.buys.filter((b) => b.nowPct != null);
        const hit = avgNow.filter((b) => (b.nowPct ?? 0) > 0).length;
        return (
          <article key={n.no} className="mtg" data-open={isOpen}>
            <button className="mtg-head" onClick={() => setOpen(isOpen ? null : n.no)} aria-expanded={isOpen}>
              <span className="mtg-no num">{n.no}차</span>
              <span className="mtg-title">
                {n.title}
                <span className="mtg-date num">{fmtTradeDate(n.date)}</span>
              </span>
              <span className="mtg-sum num">
                {buyCount > 0 && `매수 ${buyCount}건`}
                {p.sells.length > 0 && ` · 매도 ${p.sells.length}건`}
                {avgNow.length > 0 && (
                  <span className="hitrate"> · 플러스 {hit}/{avgNow.length}</span>
                )}
              </span>
              <span className="mtg-caret" aria-hidden>{isOpen ? "▾" : "▸"}</span>
            </button>

            {isOpen && (
              <div className="mtg-body">
                <div className="mtg-agenda mtg-prose">
                  <div className="h">배경</div>
                  <p className="mtg-context">{n.context}</p>
                </div>
                <div className="mtg-agenda mtg-prose">
                  <div className="h">논의</div>
                  <Items items={n.agenda} />
                </div>
                <div className="mtg-agenda mtg-prose">
                  <div className="h">결정</div>
                  {(() => {
                    const { lead, items } = splitNote(n.decisions);
                    return (
                      <>
                        {lead && <p className="mtg-lead">{lead}</p>}
                        <Items items={items} />
                      </>
                    );
                  })()}
                </div>

                {n.background && (
                  <div className="mtg-agenda mtg-prose">
                    <div className="h">개시 포트폴리오 — 종목별 선정 근거</div>
                    <Items items={n.background} />
                  </div>
                )}

                {(p.buys.length > 0 || p.sells.length > 0) && (
                  <div className="mtg-agenda">
                    <div className="h">이 회의의 성적표 (현재 기준)</div>
                    <ul className="mtg-perf">
                      {p.sells.map((l, i) => (
                        <li key={`s-${l.ticker}-${l.date}-${i}`} className="num">
                          <Logo ticker={l.ticker} name={NAME.get(l.ticker) ?? l.ticker} color={tickerColorVar(l.ticker, 0)} size={20} />
                          <span className="mtg-perf-txt">
                            <b>{NAME.get(l.ticker) ?? l.ticker}</b> {l.qty}주 익절 —
                            확정 <i className={l.gainUsd >= 0 ? "gain" : "loss"}>
                              {fmtSignedUsd(l.gainUsd)} ({fmtPct(l.pct, 1)})
                            </i>
                          </span>
                        </li>
                      ))}
                      {p.buys.map(({ t, nowPct }, i) => (
                        <li key={`b-${t.ticker}-${t.date}-${i}`} className="num">
                          <Logo ticker={t.ticker} name={NAME.get(t.ticker) ?? t.ticker} color={tickerColorVar(t.ticker, 0)} size={20} />
                          <span className="mtg-perf-txt">
                            <b>{NAME.get(t.ticker) ?? t.ticker}</b> {t.qty.toLocaleString()}주 @{" "}
                            {fmtLocalPrice(t.currency as Currency, t.price)} →{" "}
                            {nowPct == null ? "—" : (
                              <i className={nowPct > 0 ? "gain" : nowPct < 0 ? "loss" : "flat"}>{fmtPct(nowPct, 1)}</i>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </article>
        );
      })}

      <p className="log-foot">
        원본: 노션 회의 페이지 + <span className="mono">data/meeting-notes.json</span> ·
        성과는 각 체결가 대비 현재가 기준이라 화면의 평단 기준 수익률과 다를 수 있습니다.
      </p>
    </section>
  );
}
