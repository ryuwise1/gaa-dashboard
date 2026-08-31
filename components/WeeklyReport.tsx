"use client";

import { useMemo, useState } from "react";
import { HOLDINGS, SECTOR_ORDER, fmtLocalPrice, fmtUsd, type HoldingRow, type QuoteMap } from "@/lib/portfolio";
import { MACRO, fmtMacro } from "@/lib/macro";
import { AUM_USD, TRADES, cashUsd, realizedUsd } from "@/lib/trades";
import notesJson from "@/data/meeting-notes.json";

interface MeetingNote { no: number; date: string; title: string; agenda: string[]; decisions: string }
const NOTES = (notesJson as { notes: MeetingNote[] }).notes;
const NAME_OF = new Map(HOLDINGS.positions.map((p) => [p.ticker, p.name]));

/** 개조식 한 줄 — 첫 문장까지만 쓰되, 문장 중간에서는 절대 자르지 않는다 */
function clip(s: string): string {
  const first = s.split(/\.\s+/)[0];
  return first.replace(/\.$/, "");
}

interface Props {
  rows: HoldingRow[];
  quotes: QuoteMap;
  valueUsd: number;
  costUsd: number;
}

const pct = (n: number, d = 1) => (n >= 0 ? "+" : "-") + Math.abs(n * 100).toFixed(d) + "%";

/** 카톡에 그대로 붙여넣는 주간 운용보고 초안을 만든다. 숫자는 화면과 같은 소스에서 나온다. */
function build({ rows, quotes, valueUsd, costUsd }: Props): string {
  const today = new Date();
  const stamp = `${today.getMonth() + 1}/${today.getDate()}`;
  const L: string[] = [];

  L.push(`안녕하십니까 선배님들, 자산운용팀 주간 운용보고 드립니다. (${stamp} 기준)`, "");
  L.push("■ 포트폴리오 현황");
  L.push(`포트폴리오 ${fmtUsd(valueUsd)} / 투자원금 ${fmtUsd(costUsd)} / AUM ${fmtUsd(AUM_USD)}`);
  const pnl = valueUsd - costUsd;
  L.push(
    `평가손익 ${pnl >= 0 ? "+" : "-"}$${Math.abs(Math.round(pnl)).toLocaleString()} (${pct(costUsd > 0 ? pnl / costUsd : 0, 2)})` +
      ` | 실현손익 ${realizedUsd >= 0 ? "+" : "-"}$${Math.abs(Math.round(realizedUsd)).toLocaleString()}`
  );
  L.push(`현금 ${fmtUsd(cashUsd)} (AUM 대비 ${((cashUsd / AUM_USD) * 100).toFixed(1)}%)`);

  const macro = MACRO.map((m) => {
    const q = quotes[m.symbol];
    return q?.price != null ? `${m.label} ${fmtMacro(m, q.price)}` : null;
  }).filter(Boolean);
  if (macro.length) L.push(macro.join(" | "));
  L.push("");

  L.push("■ 종목별 수익률 (비중 - 주식 평가금액 기준)");
  const sortable = rows
    .filter((r) => r.pnlPct != null && r.valueUsd != null)
    .sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  for (let i = 0; i < sortable.length; i += 2) {
    L.push(
      sortable
        .slice(i, i + 2)
        .map((r) => `${r.name} ${pct(r.pnlPct ?? 0)} (${((r.weight ?? 0) * 100).toFixed(1)}%)`)
        .join(" | ")
    );
  }
  L.push("");

  // 목표 비중이 AUM 기준이므로 현재 비중도 AUM 기준으로 맞춘다.
  // (주식 평가금액 기준으로 쓰면 현금이 빠져 있어 모든 섹터가 부풀어 보인다)
  L.push("■ 섹터 비중 (목표 / 현재 — AUM 기준)");
  const bySector = new Map<string, number>();
  for (const r of rows) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + (r.valueUsd ?? 0));
  const secLines = SECTOR_ORDER.map((s) => {
    const tgt = HOLDINGS.positions.filter((p) => p.sector === s).reduce((x, p) => x + p.targetUsd, 0);
    if (tgt === 0) return null;
    const cur = bySector.get(s) ?? 0;
    return `${s} ${((tgt / AUM_USD) * 100).toFixed(1)}% / ${((cur / AUM_USD) * 100).toFixed(1)}%`;
  }).filter(Boolean) as string[];
  for (let i = 0; i < secLines.length; i += 2) L.push(secLines.slice(i, i + 2).join(" | "));
  L.push("");

  // ── 이번 주 체결 — 원장에서 최근 7일 치를 그대로 가져와 개조식으로
  L.push("■ 이번 주 매매");
  const cutoff = Date.now() - 7 * 86400_000;
  const recent = TRADES.filter((t) => Date.parse(t.date + "T00:00:00+09:00") >= cutoff);
  if (recent.length === 0) {
    L.push("- 신규 체결 없음 (기존 포지션 유지)");
  } else {
    for (const t of [...recent].sort((a, b) => a.date.localeCompare(b.date))) {
      const [, m, d] = t.date.split("-").map(Number);
      const src = t.meeting ? `${t.meeting}차 회의 결정` : "수시 집행";
      const why = t.note ? ` — ${clip(t.note.replace(/^수시 집행 \(정기회의 외\) — /, ""))}` : "";
      L.push(`- ${m}/${d} ${NAME_OF.get(t.ticker) ?? t.ticker} ${t.qty.toLocaleString()}주 ${t.side} @ ${fmtLocalPrice(t.currency, t.price)} (${src})${why}`);
    }
  }
  L.push("");

  // ── 회의 요약 — 최근 회의의 결정과 차기 안건을 자동으로 붙인다
  const todayIso = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const past = NOTES.filter((n) => n.date <= todayIso && Date.parse(n.date + "T00:00:00+09:00") >= cutoff - 3 * 86400_000);
  const next = NOTES.find((n) => n.date > todayIso);
  if (past.length || next) {
    L.push("■ 회의 요약");
    for (const n of past) {
      const [, m, d] = n.date.split("-").map(Number);
      L.push(`- ${n.no}차(${m}/${d}) ${n.title}: ${clip(n.decisions)}`);
    }
    if (next) {
      const [, m, d] = next.date.split("-").map(Number);
      L.push(`- 차기 ${next.no}차(${m}/${d}) 예정 — ${next.title.replace(/ ?\(안건지\)/, "")} 등 안건 ${next.agenda.length}건`);
    }
    L.push("");
  }
  L.push("■ 리스크 관리");
  const over = SECTOR_ORDER.map((s) => {
    const tgt = HOLDINGS.positions.filter((p) => p.sector === s).reduce((x, p) => x + p.targetUsd, 0);
    if (tgt === 0 || valueUsd === 0) return null;
    const curPctAum = ((bySector.get(s) ?? 0) / AUM_USD) * 100;
    const tgtPct = (tgt / AUM_USD) * 100;
    return curPctAum > tgtPct * 1.1
      ? `- ${s} ${curPctAum.toFixed(1)}% (목표 ${tgtPct.toFixed(1)}%, +${(((curPctAum / tgtPct) - 1) * 100).toFixed(0)}% 이탈) — 비중 축소 검토 대상`
      : null;
  }).filter(Boolean) as string[];
  L.push(...(over.length ? over : ["- 목표 비중을 크게 벗어난 섹터 없음"]));
  const losers = rows.filter((r) => (r.pnlPct ?? 0) < -0.05);
  for (const r of losers) L.push(`- ${r.name} ${pct(r.pnlPct ?? 0)} — 손절선 점검 중`);
  L.push("");
  L.push("항상 학회에 관심 가져주셔서 감사드립니다.");

  return L.join("\n");
}

export default function WeeklyReport(props: Props) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => build(props), [props]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="section" aria-label="주간 운용보고 초안">
      <div className="section-head">
        <h2>주간 운용보고 초안</h2>
        <div className="wr-actions">
          <button className="btn" onClick={() => setShow((s) => !s)} aria-expanded={show}>
            {show ? "접기" : "펼치기"}
          </button>
          <button className="btn primary" onClick={copy}>
            {copied ? "복사됨 ✓" : "카톡용 복사"}
          </button>
        </div>
      </div>
      <p className="wr-hint">
        시세·체결 원장·회의록에서 현황, 이번 주 매매, 회의 결정·차기 안건까지 자동으로 채워집니다.
        보내기 전에 한 번 읽고 필요한 부분만 다듬으면 됩니다.
      </p>
      {show && <pre className="wr-pre">{text}</pre>}
    </section>
  );
}
