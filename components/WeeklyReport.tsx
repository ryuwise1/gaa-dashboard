"use client";

import { useMemo, useState } from "react";
import { HOLDINGS, SECTOR_ORDER, fmtLocalPrice, type HoldingRow, type QuoteMap } from "@/lib/portfolio";
import { MACRO, fmtMacro } from "@/lib/macro";
import { AUM_USD, TRADES, cashUsd, realizedLots, realizedUsd, type Trade } from "@/lib/trades";
import notesJson from "@/data/meeting-notes.json";
import narrativeJson from "@/data/weekly-narrative.json";
import { meetingLabel } from "@/lib/meeting";

/*
 * 주간 운용보고 초안 — 선배님 단톡에 올리는 정기 보고(2026-05-23 예시 형식).
 *   ■ 포트폴리오 현황 → ■ 종목별 수익률 → ■ 섹터 비중 → ■ 이번 주 주요 액션
 *   → ■ 주요 종목 변동 → ■ 리스크 관리 → ■ 향후 관전 포인트
 * 숫자는 시세·원장·회의록에서 자동으로 채우고, 이유·관전 포인트 같은 문장은
 * data/weekly-narrative.json에서 가져온다. 운용 경과·전 종목 논거는 첫 보고용이라 주간 보고엔 넣지 않는다.
 */

interface MeetingNote { no: number; date: string; title: string; agenda: string[]; decisions: string }
const NOTES = (notesJson as { notes: MeetingNote[] }).notes;

interface Narrative {
  updatedAt: string;
  /** 이번 주 주요 액션의 이유 — 그 주에 체결된 종목만 초안에 나온다 */
  actions: { ticker: string; title?: string; points: string[] }[];
  /** 주요 종목 변동 — 비중 큰 종목의 뉴스. 비어 있으면 섹션을 뺀다 */
  movers: { ticker: string; points: string[] }[];
  /** 집중도 점검에 쓸 섹터 묶음 */
  concentration?: { label: string; sectors: string[] };
  /** 자동 항목(집중도·밴드·낙폭) 뒤에 붙는 사람이 쓴 리스크 */
  risks: { title: string; text: string }[];
  /** 향후 관전 포인트 */
  watch: { title: string; points: string[] }[];
  closing: string;
}
const N = narrativeJson as unknown as Narrative;

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
  SGOV: "SGOV",
  TLT: "TLT",
  IEF: "IEF",
};
const nameOf = (ticker: string) => SHORT[ticker] ?? NAME_OF.get(ticker) ?? ticker;

const SITE_URL = "https://gaa-dashboard-eight.vercel.app";
/** 목표 이탈 밴드 — 목표 대비 ±25% (Allocation.tsx BAND와 같다) */
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
const kst = (iso: string) => Date.parse(iso + "T00:00:00+09:00");

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

/** 체결 note에서 사람이 읽을 이유만 — 회의 출처·체결가 산정·기록 경위 문장은 뺀다 (글이 없을 때 대신 쓴다) */
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

/** 액션 제목 — 체결 전후 수량으로 신규·추가·축소·전량을 가른다 */
function actionKind(ts: Trade[], qtyNow: number): string {
  if (ts.every((t) => t.note?.startsWith("배당 재투자"))) return "배당 재투자";
  const net = ts.reduce((x, t) => x + (t.side === "매수" ? t.qty : -t.qty), 0);
  const before = qtyNow - net;
  if (net > 0) return before === 0 ? "신규 매수" : "추가 매수";
  if (net < 0) return qtyNow === 0 ? "전량 매도" : "비중 축소";
  return "매매";
}

/** 카톡에 그대로 붙여넣는 주간 운용보고 초안. 숫자는 화면과 같은 소스에서 나온다. */
function build({ rows, quotes, valueUsd, costUsd, history }: Props): string {
  const L: string[] = [];
  const totalUsd = valueUsd + cashUsd;
  const cutoff = Date.now() - 7 * 86400_000;
  const todayIso = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const rowOf = new Map(rows.map((r) => [r.ticker, r]));
  const priced = rows
    .filter((r) => r.pnlPct != null && r.valueUsd != null && r.qty > 0)
    .sort((a, b) => (b.pnlPct ?? 0) - (a.pnlPct ?? 0));
  const w = (r: HoldingRow | undefined) => ((r?.weight ?? 0) * 100).toFixed(1) + "%";

  L.push(`안녕하십니까 선배님들, 자산운용팀 주간 운용보고 드립니다. (${asOf(quotes)})`, "");

  // ── 포트폴리오 현황
  const pnl = valueUsd - costUsd;
  const cur = history?.[history.length - 1];
  L.push("■ 포트폴리오 현황", "");
  L.push(`포트폴리오 ${usd0(valueUsd)} / 투자원금 ${usd0(costUsd)} / AUM ${usd0(AUM_USD)}`);
  L.push(`평가손익 ${usd0(pnl, true)} (${pct(costUsd > 0 ? pnl / costUsd : 0, 2)}) / 실현손익 ${usd0(realizedUsd, true)}`);
  L.push(`현금 ${usd0(cashUsd)} (AUM 대비 ${((cashUsd / AUM_USD) * 100).toFixed(1)}%)`);
  L.push(`총자산 ${usd0(totalUsd)} (운용 개시 후 ${pct(totalUsd / AUM_USD - 1)})`);
  // 초과수익은 추이 카드와 같은 점(총자산·PME 모두 history 마지막 값)에서 잰다
  if (cur?.benchUsd != null) {
    const a = ((cur.totalUsd - cur.benchUsd) / AUM_USD) * 100;
    L.push(`PME 방식 벤치마크(S&P500) 대비 ${pp(a)} ${a >= 0 ? "상회" : "하회"}`);
  }
  const macro = MACRO.map((m) => {
    const q = quotes[m.symbol];
    return q?.price != null ? `${m.label.replace("S&P 500", "S&P500")} ${fmtMacro(m, q.price)}` : null;
  }).filter(Boolean) as string[];
  if (macro.length) L.push(macro.join(" | "));
  L.push("");

  // ── 종목별 수익률 — 수익률 높은 순 한 문단
  L.push("■ 종목별 수익률 (비중 - 주식 평가금액 기준)", "");
  L.push(priced.map((r) => `${nameOf(r.ticker)} ${pct(r.pnlPct ?? 0)} (${w(r)})`).join(" | "), "");

  // ── 섹터 비중 — 목표가 AUM 기준이므로 현재도 AUM 기준 (평가금액 기준이면 현금이 빠져 모든 섹터가 부풀어 보인다)
  const bySector = new Map<string, number>();
  for (const r of rows) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + (r.valueUsd ?? 0));
  const tgtOf = (secs: string[]) =>
    (HOLDINGS.positions.filter((p) => secs.includes(p.sector)).reduce((x, p) => x + p.targetUsd, 0) / AUM_USD) * 100;
  const curOf = (secs: string[]) => (secs.reduce((x, s) => x + (bySector.get(s) ?? 0), 0) / AUM_USD) * 100;
  const sectors = SECTOR_ORDER.map((s) => ({ s, tgt: tgtOf([s]), cur: curOf([s]) })).filter((x) => x.tgt > 0);
  L.push("■ 섹터 비중 (목표 / 현재 - AUM 기준)", "");
  L.push(sectors.map((x) => `${x.s} ${x.tgt.toFixed(1)}% / ${x.cur.toFixed(1)}%`).join(" | "), "");

  // ── 이번 주 주요 액션 — 종목별로 묶고, 이유는 narrative(없으면 체결 note)
  const recent = [...TRADES.filter((t) => kst(t.date) >= cutoff)].sort((a, b) => a.date.localeCompare(b.date));
  const meetings = NOTES.filter((n) => n.date <= todayIso && kst(n.date) >= cutoff - 3 * 86400_000);
  L.push("■ 이번 주 주요 액션", "");
  for (const n of meetings) L.push(`${meetingLabel(n.no)}차 회의(${md(n.date)}) — ${n.title}`, "");
  if (recent.length === 0) {
    L.push("신규 체결 없음 — 기존 포지션 유지", "");
  } else {
    const byTicker = new Map<string, Trade[]>();
    for (const t of recent) byTicker.set(t.ticker, [...(byTicker.get(t.ticker) ?? []), t]);
    // 운용 판단(회의·수시)이 먼저, 배당 재투자는 맨 뒤
    const order = [...byTicker.entries()].sort(
      ([, a], [, b]) => Number(!!a[0].note?.startsWith("배당 재투자")) - Number(!!b[0].note?.startsWith("배당 재투자"))
    );
    order.forEach(([ticker, ts], i) => {
      const r = rowOf.get(ticker);
      const qtyNow = r?.qty ?? HOLDINGS.positions.find((p) => p.ticker === ticker)?.qty ?? 0;
      const c = N.actions.find((x) => x.ticker === ticker);
      const kind = c?.title ?? actionKind(ts, qtyNow);
      const src = ts[0].meeting ? ` (${meetingLabel(ts[0].meeting)}차 회의 결정)` : "";
      if (ts.length === 1) {
        const t = ts[0];
        L.push(`${i + 1}. ${nameOf(ticker)} ${kind} — ${md(t.date)}, ${t.qty.toLocaleString()}주 x ${fmtLocalPrice(t.currency, t.price)}, ${usd0(t.usd)}${src}`);
      } else {
        const span = ts[0].date === ts[ts.length - 1].date ? md(ts[0].date) : `${md(ts[0].date)}~${md(ts[ts.length - 1].date)}`;
        L.push(`${i + 1}. ${nameOf(ticker)} ${kind} — ${span}, ${ts.length}건${src}`);
        for (const t of ts) L.push(`- ${md(t.date)}: ${t.side} ${t.qty.toLocaleString()}주 x ${fmtLocalPrice(t.currency, t.price)}`);
      }
      const points = c?.points.length ? c.points : ts.map((t) => reason(t.note)).filter(Boolean) as string[];
      for (const p of points) L.push(`- ${p}`);
      // 결과 한 줄 — 매도는 실현손익, 보유 중이면 현재 수량·비중
      const gain = realizedLots.filter((x) => x.ticker === ticker && kst(x.date) >= cutoff).reduce((x, y) => x + y.gainUsd, 0);
      const tail: string[] = [];
      if (ts.some((t) => t.side === "매도")) tail.push(`실현손익 ${usd0(gain, true)}`);
      if (qtyNow > 0) tail.push(`현재 ${qtyNow.toLocaleString()}주 보유, 비중 ${w(r)}${r?.pnlPct != null ? `, 수익률 ${pct(r.pnlPct)}` : ""}`);
      if (tail.length) L.push(`- ${tail.join(" / ")}`);
      L.push("");
    });
  }

  // ── 주요 종목 변동 — 사람이 쓴 뉴스, 수익률·비중은 자동
  const movers = N.movers.filter((m) => rowOf.get(m.ticker)?.qty);
  if (movers.length) {
    L.push("■ 주요 종목 변동", "");
    for (const m of movers) {
      const r = rowOf.get(m.ticker);
      L.push(`- ${nameOf(m.ticker)} ${r?.pnlPct != null ? pct(r.pnlPct) : ""} (비중 ${w(r)}): ${m.points.join(" ")}`);
    }
    L.push("");
  }

  // ── 리스크 관리 — 숫자 항목은 자동, 그 뒤에 사람이 쓴 항목
  const risk: string[] = [];
  if (N.concentration) {
    const c = N.concentration;
    risk.push(`섹터 집중도: ${c.label} 합산 ${curOf(c.sectors).toFixed(1)}% (목표 ${tgtOf(c.sectors).toFixed(1)}%)`);
  }
  const top3 = [...priced].sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0)).slice(0, 3);
  if (top3.length === 3) {
    const sum = top3.reduce((x, r) => x + (r.weight ?? 0), 0);
    risk.push(`상위 3종목 집중도 ${(sum * 100).toFixed(1)}%: ${top3.map((r) => `${nameOf(r.ticker)}(${w(r)})`).join(", ")}`);
  }
  const off = sectors.filter((x) => Math.abs(x.cur / x.tgt - 1) > BAND);
  if (off.length) {
    risk.push(`목표 이탈: ${off.map((x) => `${x.s} ${x.cur.toFixed(1)}%(목표 ${x.tgt.toFixed(1)}%, ${pct(x.cur / x.tgt - 1, 0)})`).join(", ")} — ±25% 밴드 밖`);
  } else if (sectors.length) {
    const worst = sectors.reduce((a, b) => (Math.abs(b.cur - b.tgt) > Math.abs(a.cur - a.tgt) ? b : a));
    risk.push(`목표 이탈: ±25% 밴드를 벗어난 섹터 없음 (최대 ${worst.s} ${pp(worst.cur - worst.tgt)})`);
  }
  const dd = priced.filter((r) => (r.pnlPct ?? 0) < DRAWDOWN).sort((a, b) => (a.pnlPct ?? 0) - (b.pnlPct ?? 0));
  if (dd.length) risk.push(`낙폭 큰 종목: ${dd.map((r) => `${nameOf(r.ticker)} ${pct(r.pnlPct ?? 0)}`).join(", ")}`);
  for (const r of N.risks) risk.push(`${r.title}: ${r.text}`);
  L.push("■ 리스크 관리", "");
  risk.forEach((x, i) => L.push(`${i + 1}. ${x}`));
  L.push("");

  // ── 향후 관전 포인트 — 사람이 쓴 항목 + 차기 회의
  const next = NOTES.find((n) => n.date > todayIso);
  if (N.watch.length || next) {
    L.push("■ 향후 관전 포인트", "");
    N.watch.forEach((x, i) => {
      L.push(`${i + 1}. ${x.title}`);
      for (const p of x.points) L.push(`- ${p}`);
      L.push("");
    });
    if (next) L.push(`${N.watch.length + 1}. 차기 ${meetingLabel(next.no)}차 회의 (${md(next.date)}) — 안건 ${next.agenda.length}건`, "");
  }

  L.push(`실시간 포트폴리오: ${SITE_URL}`, "");
  L.push(N.closing);
  return L.join("\n");
}

export default function WeeklyReport(props: Props) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = useMemo(() => build(props), [props]);
  const stale = Date.now() - kst(N.updatedAt) > 7 * 86400_000;

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
        현황·수익률·섹터 비중·체결·집중도·낙폭은 시세와 원장에서 자동으로 채워집니다.
        액션 이유·종목 변동·리스크·관전 포인트 문장은 data/weekly-narrative.json에서 가져옵니다
        ({md(N.updatedAt)} 수정{stale ? " — 1주 넘게 지나 내용 확인 필요" : ""}).
      </p>
      {show && <pre className="wr-pre">{text}</pre>}
    </section>
  );
}
