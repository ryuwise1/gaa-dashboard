"use client";

import { useMemo, useState } from "react";
import { HOLDINGS, SECTOR_ORDER, fmtLocalPrice, type HoldingRow, type QuoteMap } from "@/lib/portfolio";
import { MACRO, fmtMacro } from "@/lib/macro";
import { AUM_USD, TRADES, cashUsd, realizedLots, realizedUsd } from "@/lib/trades";
import notesJson from "@/data/meeting-notes.json";
import narrativeJson from "@/data/weekly-narrative.json";
import { meetingLabel } from "@/lib/meeting";

interface MeetingNote { no: number; date: string; title: string; agenda: string[]; decisions: string }
const NOTES = (notesJson as { notes: MeetingNote[] }).notes;

/**
 * 사람이 쓰는 글 부분 — 운용 경과·투자 논거·향후 계획. 숫자는 아래 build()가 채운다.
 * 투자 논거는 그 주에 바뀐 종목만 쓴다: changes[]에서 이번 주 체결된 티커만 골라 낸다.
 */
interface Change { ticker: string; title: string; body: string; points: string[] }
interface Narrative {
  updatedAt: string;
  intro: string;
  progress: string[];
  changes: Change[];
  concentration?: { label: string; sectors: string[] };
  risks: string[];
  plan: string[];
  closing: string;
}
const NARRATIVE = narrativeJson as unknown as Narrative;

const NAME_OF = new Map(HOLDINGS.positions.map((p) => [p.ticker, p.name]));
/** 카톡 보고용 짧은 이름 — 없으면 보드 이름 그대로 */
const SHORT: Record<string, string> = {
  META: "Meta",
  DELL: "Dell",
  XLV: "헬스케어 ETF",
  XLP: "필수소비재 ETF",
  XLF: "금융 ETF",
  KRE: "지역은행 ETF",
  "BRK-B": "Berkshire B",
  SGOV: "iShares 0-3M",
  TLT: "iShares 20+Y",
  IEF: "iShares 7-10Y",
};
const nameOf = (ticker: string) => SHORT[ticker] ?? NAME_OF.get(ticker) ?? ticker;

const SITE_URL = "https://gaa-dashboard-eight.vercel.app";
/** 목표 이탈 밴드 — 목표 대비 ±25%를 넘을 때만 리스크로 적는다 (Allocation.tsx BAND와 같다) */
const BAND = 0.25;
/** 이 손실률보다 크면 '낙폭 큰 종목'에 올린다 */
const DRAWDOWN = -0.05;

interface Props {
  rows: HoldingRow[];
  quotes: QuoteMap;
  valueUsd: number;
  costUsd: number;
  /** 총자산 추이 — 벤치마크 비교용 (Dashboard의 /api/history 결과) */
  history?: { date: string; totalUsd: number; benchUsd?: number | null; spxPct?: number | null }[];
}

const pct = (n: number, d = 1) => (n >= 0 ? "+" : "-") + Math.abs(n * 100).toFixed(d) + "%";
const pp = (n: number) => (n >= 0 ? "+" : "-") + Math.abs(n).toFixed(1) + "%p";
const usd0 = (n: number, sign = false) =>
  (sign ? (n >= 0 ? "+" : "-") : n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");
const md = (iso: string) => {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
};
/** 한 줄에 n개씩 " | "로 묶는다 */
const chunk = (xs: string[], n: number) => {
  const out: string[] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n).join(" | "));
  return out;
};

/** 기준 시점 — S&P 500 시세 시각(뉴욕)으로 정한다. 주말·휴장일엔 마지막 거래일 종가가 된다. */
function asOf(quotes: QuoteMap): string {
  const t = quotes["^GSPC"]?.time;
  const when = t ? new Date(t * 1000) : new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(when);
  const get = (k: string) => parts.find((x) => x.type === k)?.value ?? "";
  const stamp = md(`${get("year")}-${get("month")}-${get("day")}`);
  const fresh = t != null && Date.now() / 1000 - t < 20 * 60;
  return fresh && Number(get("hour")) < 16 ? `${stamp} 장중 기준` : `${stamp} 종가 기준`;
}

/**
 * 체결 사유 — note에서 사람이 읽을 이유만 남긴다.
 * 회의 출처·체결가 산정·기록 경위 문장은 괄호 안 출처 표기와 겹치므로 뺀다.
 */
const NOISE = /체결가|정기회의|임시회의|상시 승인|사후 기록|회의 결정|단톡 의견|이월/;
function reason(note: string | undefined): string | null {
  if (!note) return null;
  const parts = note
    .replace(/^수시 집행 \(정기회의 외\) — /, "")
    .split(/\.\s+/)
    .map((x) => x.replace(/\.$/, "").split(" — ")[0].trim())
    .filter((x) => x && !NOISE.test(x))
    .slice(0, 2);
  return parts.length ? parts.join(" · ") : null;
}

/** 카톡에 그대로 붙여넣는 주간 운용보고 초안을 만든다. 숫자는 화면과 같은 소스에서 나온다. */
function build({ rows, quotes, valueUsd, costUsd, history }: Props): string {
  const L: string[] = [];
  const totalUsd = valueUsd + cashUsd;
  const N = NARRATIVE;

  L.push(`안녕하십니까 선배님들, 자산운용팀 주간 운용보고 드립니다. (${asOf(quotes)})`, "");
  L.push(N.intro, "", "");

  // ── 포트폴리오 현황
  const pnl = valueUsd - costUsd;
  L.push("■ 포트폴리오 현황");
  L.push(`포트폴리오 ${usd0(valueUsd)} / 투자원금 ${usd0(costUsd)} / 현금 ${usd0(cashUsd)} (AUM의 ${((cashUsd / AUM_USD) * 100).toFixed(1)}%)`);
  L.push(`평가손익 ${usd0(pnl, true)} (${pct(costUsd > 0 ? pnl / costUsd : 0, 2)}) | 실현손익 ${usd0(realizedUsd, true)}`);
  const cur = history?.[history.length - 1];
  const vsAum = totalUsd / AUM_USD - 1;
  // 초과수익은 추이 카드와 같은 점(총자산·PME 모두 history 마지막 값)에서 잰다 — 실시간 총자산과 섞으면 화면과 어긋난다
  const bench = cur?.benchUsd != null ? ` | PME 방식 벤치마크(S&P500) 대비 ${pp(((cur.totalUsd - cur.benchUsd) / AUM_USD) * 100)}` : "";
  L.push(`총자산 ${usd0(totalUsd)} (운용 개시 후 ${pct(vsAum)})${bench}`);
  const macro = MACRO.map((m) => {
    const q = quotes[m.symbol];
    return q?.price != null ? `${m.label.replace("S&P 500", "S&P500")} ${fmtMacro(m, q.price)}` : null;
  }).filter(Boolean) as string[];
  L.push(...chunk(macro, 5));
  L.push("");

  // ── 종목별 수익률 — 수익률 높은 순, 한 줄에 두 종목
  const priced = rows
    .filter((r) => r.pnlPct != null && r.valueUsd != null && r.qty > 0)
    .sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  L.push("■ 종목별 수익률 (비중 — 평가금액 대비)");
  L.push(...chunk(priced.map((r) => `${nameOf(r.ticker)} ${pct(r.pnlPct ?? 0)} (${((r.weight ?? 0) * 100).toFixed(1)}%)`), 2));
  L.push("", "");

  // ── 운용 경과 — 사람이 쓴 문단 + 이번 주 회의 결정
  const todayIso = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const cutoff = Date.now() - 7 * 86400_000;
  const recentNotes = NOTES.filter((n) => n.date <= todayIso && Date.parse(n.date + "T00:00:00+09:00") >= cutoff - 3 * 86400_000);
  L.push("■ 운용 경과");
  for (const p of N.progress) L.push(p, "");
  for (const n of recentNotes) {
    L.push(`이번 주 ${meetingLabel(n.no)}차 회의(${md(n.date)}) — ${n.title}`);
    for (const d of n.decisions.split(/\.\s+/).map((x) => x.replace(/\.$/, "").trim()).filter(Boolean))
      L.push(`- ${d.replace(/않는다$/, "않습니다").replace(/한다$/, "합니다")}`);
    L.push("");
  }
  L.push("");

  // ── 이번 주 매매 — 원장 최근 7일, 체결 사유 포함
  L.push("■ 이번 주 매매");
  const recent = [...TRADES.filter((t) => Date.parse(t.date + "T00:00:00+09:00") >= cutoff)].sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length === 0) {
    L.push("- 신규 체결 없음 (기존 포지션 유지)");
  } else {
    for (const t of recent) {
      const src = t.meeting ? `, ${meetingLabel(t.meeting)}차 회의 결정` : t.note?.startsWith("수시 집행") ? ", 수시 집행" : "";
      L.push(`- ${t.side} ${nameOf(t.ticker)} ${t.qty.toLocaleString()}주 @ ${fmtLocalPrice(t.currency, t.price)} (${md(t.date)}${src})`);
      const why = reason(t.note);
      if (why) L.push(`  ${why}`);
    }
  }
  L.push("", "");

  // ── 투자 논거 — 이번 주에 바뀐 종목만. 배당 재투자(SGOV)는 운용 판단이 아니라 제외한다.
  const changed = [...new Set(recent.filter((t) => !t.note?.startsWith("배당 재투자")).map((t) => t.ticker))];
  const rowOf = new Map(rows.map((r) => [r.ticker, r]));
  changed.forEach((ticker, i) => {
    const c = N.changes.find((x) => x.ticker === ticker);
    const r = rowOf.get(ticker);
    const pos = HOLDINGS.positions.find((p) => p.ticker === ticker);
    L.push(`■ 투자 논거 ${i + 1}. ${nameOf(ticker)} — ${c?.title ?? recent.filter((t) => t.ticker === ticker).map((t) => t.side).join("·")}`);
    if (c) {
      L.push(c.body);
      for (const p of c.points) L.push(`- ${p}`);
    } else if (pos?.why) {
      // 글이 아직 없으면 편입 근거(holdings why) 앞 두 문장으로 대신한다
      L.push(pos.why.split(/(?<=다\.)\s+/).slice(0, 2).join(" "));
    }
    if (r && r.qty > 0 && r.pnlPct != null) {
      L.push(`→ 현재 ${pct(r.pnlPct)} · 비중 ${((r.weight ?? 0) * 100).toFixed(1)}% (평가금액 대비)`);
    } else {
      const gain = realizedLots.filter((x) => x.ticker === ticker && Date.parse(x.date + "T00:00:00+09:00") >= cutoff).reduce((x, y) => x + y.gainUsd, 0);
      L.push(`→ 전량 매도, 이번 주 실현손익 ${usd0(gain, true)}`);
    }
    L.push("", "");
  });

  // 섹터 비중 — 목표가 AUM 기준이므로 현재 비중도 AUM 기준 (평가금액 기준이면 현금이 빠져 모든 섹터가 부풀어 보인다)
  const bySector = new Map<string, number>();
  for (const r of rows) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + (r.valueUsd ?? 0));
  const tgtOf = (secs: string[]) =>
    (HOLDINGS.positions.filter((p) => secs.includes(p.sector)).reduce((x, p) => x + p.targetUsd, 0) / AUM_USD) * 100;
  const curOf = (secs: string[]) => (secs.reduce((x, s) => x + (bySector.get(s) ?? 0), 0) / AUM_USD) * 100;

  // ── 리스크 관리
  L.push("■ 리스크 관리");
  const sectors = SECTOR_ORDER.map((s) => ({ s, tgt: tgtOf([s]), cur: curOf([s]) })).filter((x) => x.tgt > 0);
  const off = sectors.filter((x) => Math.abs(x.cur / x.tgt - 1) > BAND);
  if (off.length) {
    for (const x of off) L.push(`- ${x.s} ${x.cur.toFixed(1)}% (목표 ${x.tgt.toFixed(1)}%, ${pct(x.cur / x.tgt - 1, 0)} 이탈) — 목표 대비 ±25% 밴드 밖`);
  } else if (sectors.length) {
    const worst = sectors.reduce((a, b) => (Math.abs(b.cur - b.tgt) > Math.abs(a.cur - a.tgt) ? b : a));
    L.push(`- 목표 비중을 크게 벗어난 섹터 없음 (최대 ${worst.s} ${pp(worst.cur - worst.tgt)})`);
  }
  if (N.concentration) L.push(`- ${N.concentration.label} 합산 AUM의 ${curOf(N.concentration.sectors).toFixed(1)}%`);
  const drawdowns = priced.filter((r) => (r.pnlPct ?? 0) < DRAWDOWN).sort((a, b) => (a.pnlPct ?? 0) - (b.pnlPct ?? 0));
  if (drawdowns.length) L.push(`- 낙폭 큰 종목: ${drawdowns.map((r) => `${nameOf(r.ticker)} ${pct(r.pnlPct ?? 0)}`).join(" · ")}`);
  for (const r of N.risks) L.push(`- ${r}`);
  L.push("");

  // ── 향후 계획
  const next = NOTES.find((n) => n.date > todayIso);
  if (N.plan.length || next) {
    L.push("■ 향후 계획");
    for (const p of N.plan) L.push(`- ${p}`);
    if (next) L.push(`- 차기 ${meetingLabel(next.no)}차 회의(${md(next.date)}) — 안건 ${next.agenda.length}건`);
    L.push("");
  }

  L.push("■ 실시간 포트폴리오", SITE_URL, "");
  L.push(N.closing);

  return L.join("\n");
}

export default function WeeklyReport(props: Props) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => build(props), [props]);
  const stale = Date.now() - Date.parse(NARRATIVE.updatedAt + "T00:00:00+09:00") > 7 * 86400_000;

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
        현황·종목별 수익률·이번 주 매매·회의 결정·리스크는 시세와 원장에서 자동으로 채워집니다.
        투자 논거는 이번 주에 바뀐 종목만 나오고, 운용 경과·논거·향후 계획 문장은 data/weekly-narrative.json에서 가져옵니다
        ({md(NARRATIVE.updatedAt)} 수정{stale ? " — 1주 넘게 지나 내용 확인 필요" : ""}).
      </p>
      {show && <pre className="wr-pre">{text}</pre>}
    </section>
  );
}
