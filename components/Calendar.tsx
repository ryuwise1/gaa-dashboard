"use client";

import { useEffect, useMemo, useState } from "react";

interface MacroEvent {
  time: string; country: string; title: string;
  ko: string | null; desc: string | null;
  impact: "High" | "Medium"; forecast: string; previous: string;
  actual?: string; verdict?: "상회" | "부합" | "하회";
}
interface EarningsEvent {
  symbol: string; name: string; when: string; marketCapUsd: number;
  epsForecast: string; held: boolean; tag: string;
  epsActual?: number; surprisePct?: number | null;
}
interface CalDay { date: string; macro: MacroEvent[]; earnings: EarningsEvent[]; }

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const kstToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());

function dayLabel(iso: string): { label: string; today: boolean } {
  const [y, m, d] = iso.split("-").map(Number);
  return {
    label: `${m}/${d} (${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`,
    today: iso === kstToday(),
  };
}

function kstTime(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
}

function capShort(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(1) + "T";
  if (n >= 1e9) return Math.round(n / 1e9) + "B";
  return "";
}

/* ── 주간 표 생성 — 회의 자료의 이벤트 표 형식으로 클립보드에 담는다 ──
   AI 없이 캘린더 데이터에서 결정적으로 만든다. HTML+텍스트를 함께 실어
   노션·워드엔 표로, 카톡엔 텍스트로 붙는다. */

interface Roster { [date: string]: { lead: string; follow: string } }

function weekTitle(days: CalDay[]): string {
  if (!days.length) return "Weekly Events";
  const [, m, d] = days[0].date.split("-").map(Number);
  return `${MONTH_EN[m - 1]} Week ${Math.ceil(d / 7)} Events`;
}

function buildTableHtml(days: CalDay[], roster: Roster): string {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  // 워드·노션에 붙였을 때 열이 흔들리지 않게 폭을 박아둔다.
  // Date·Name은 줄바꿈 금지 — "학회원"이 중간에 꺾이는 것을 막는다.
  const base = "border:1px solid #999;padding:7px 10px;vertical-align:top;font-size:13px;line-height:1.6";
  const tdDate = `style="${base};width:52px;white-space:nowrap;text-align:center;font-weight:700"`;
  const tdName = `style="${base};width:118px;white-space:nowrap"`;
  const tdMacro = `style="${base}"`;
  const tdEarn = `style="${base};width:190px"`;
  const th = (w?: string) =>
    `style="border:1px solid #999;padding:7px 10px;background:#f0f0f0;font-weight:700;font-size:13px;text-align:center${w ? `;width:${w}` : ""}"`;
  const rows = days.map((d) => {
    const [, m, dd] = d.date.split("-").map(Number);
    const r = roster[d.date] ?? { lead: "", follow: "" };
    // 국가를 굵게, 지표는 사전 한글명으로 — 화면과 같은 표기
    const macro = d.macro
      .map((x) => `<b>${esc(x.country)}</b> ${esc(x.ko ?? x.title)}`)
      .join("<br/>") || "—";
    const earn = d.earnings.map((x) => esc(`${x.name}(${x.symbol})`)).join("<br/>") || "—";
    return `<tr><td ${tdDate}>${m}/${dd}</td><td ${tdName}>리딩: ${esc(r.lead) || "미정"}<br/>팔로잉: ${esc(r.follow) || "미정"}</td><td ${tdMacro}>${macro}</td><td ${tdEarn}>${earn}</td></tr>`;
  }).join("");
  // 제목 행은 레퍼런스처럼 왼쪽, 열 머리글은 가운데
  const thTitle =
    'style="border:1px solid #999;padding:7px 10px;background:#f0f0f0;font-weight:700;font-size:13px;text-align:left"';
  return `<table style="border-collapse:collapse;width:100%"><thead><tr><th ${thTitle} colspan="4">${weekTitle(days)}</th></tr><tr><th ${th("52px")}>Date</th><th ${th("118px")}>Name</th><th ${th()}>Macro Event List</th><th ${th("190px")}>Earnings List</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function buildTableText(days: CalDay[], roster: Roster): string {
  const L: string[] = [`[${weekTitle(days)}]`, ""];
  for (const d of days) {
    const [, m, dd] = d.date.split("-").map(Number);
    const r = roster[d.date] ?? { lead: "", follow: "" };
    L.push(`■ ${m}/${dd} — 리딩: ${r.lead || "미정"} / 팔로잉: ${r.follow || "미정"}`);
    for (const x of d.macro) L.push(`  · [${x.country}] ${x.ko ?? x.title}`);
    for (const x of d.earnings) L.push(`  · [어닝] ${x.name}(${x.symbol})${x.held ? " ★보유" : ""}`);
    L.push("");
  }
  return L.join("\n");
}

/* ── 이벤트 상세 아이템 — 주간 뷰와 월간 클릭 상세가 같은 걸 쓴다 ── */

function MacroItem({ m }: { m: MacroEvent }) {
  return (
    <div className="cal-item" data-impact={m.impact} title={m.desc ?? undefined}>
      <span className="cal-time num">{kstTime(m.time)}</span>
      <span className="cal-flag">{m.country}</span>
      <span className="cal-title">
        {m.ko ?? m.title}
        <span className="cal-est num">
          {m.ko && <span className="cal-en">{m.title}</span>}
          {m.forecast && <span className="pair">예상 {m.forecast}</span>}
          {m.previous && <span className="pair">이전 {m.previous}</span>}
        </span>
        {m.actual && (
          <span className="cal-act num">
            실제 <b>{m.actual}</b>
            {m.verdict && <i data-v={m.verdict}>예상 {m.verdict}</i>}
          </span>
        )}
        {m.desc && <span className="cal-desc">{m.desc}</span>}
      </span>
    </div>
  );
}

function EarnItem({ e }: { e: EarningsEvent }) {
  return (
    <div className="cal-item" data-held={e.held}>
      <span className="cal-when">{e.when || "—"}</span>
      <span className="cal-title">
        <b className="num">{e.symbol}</b> {e.name}
        <span className={`cal-tag${e.held ? " held" : ""}`}>{e.tag}</span>
        <span className="cal-est num">
          {capShort(e.marketCapUsd) && <span className="pair">시총 ${capShort(e.marketCapUsd)}</span>}
          {e.epsForecast && <span className="pair">EPS 예상 {e.epsForecast}</span>}
        </span>
        {e.epsActual != null && (
          <span className="cal-act num">
            실제 EPS <b>{e.epsActual}</b>
            {e.surprisePct != null && (
              <i data-v={e.surprisePct >= 2 ? "상회" : e.surprisePct <= -2 ? "하회" : "부합"}>
                {e.surprisePct >= 2 ? `서프라이즈 +${e.surprisePct}%` : e.surprisePct <= -2 ? `쇼크 ${e.surprisePct}%` : "예상 부합"}
              </i>
            )}
          </span>
        )}
      </span>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────── */

export default function Calendar() {
  const [view, setView] = useState<"주간" | "월간">("주간");
  const [week, setWeek] = useState<CalDay[] | null>(null);
  const [month, setMonth] = useState<string>(kstToday().slice(0, 7));
  const [monthDays, setMonthDays] = useState<Record<string, CalDay[]>>({});
  const [failed, setFailed] = useState(false);
  /** 월간에서 클릭한 날짜 — 그리드 아래에 주간 뷰와 같은 상세를 띄운다 */
  const [selDay, setSelDay] = useState<string | null>(null);

  const [builder, setBuilder] = useState(false);
  const [roster, setRoster] = useState<Roster>({});
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setWeek(d.days ?? []))
      .catch(() => setFailed(true));
    try {
      const saved = localStorage.getItem("gaa-cal-roster");
      if (saved) setRoster(JSON.parse(saved));
    } catch {}
  }, []);

  useEffect(() => {
    if (view !== "월간" || monthDays[month]) return;
    fetch(`/api/calendar?month=${month}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMonthDays((prev) => ({ ...prev, [month]: d.days ?? [] })))
      .catch(() => {});
  }, [view, month, monthDays]);

  const setPerson = (date: string, key: "lead" | "follow", v: string) => {
    setRoster((prev) => {
      const base = prev[date] ?? { lead: "", follow: "" };
      const next = { ...prev, [date]: { ...base, [key]: v } };
      try { localStorage.setItem("gaa-cal-roster", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const copyTable = async () => {
    if (!week) return;
    const html = buildTableHtml(week, roster);
    const text = buildTableText(week, roster);
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      setCopied("ok");
    } catch {
      try { await navigator.clipboard.writeText(text); setCopied("ok"); }
      catch { setCopied("fail"); }
    }
    setTimeout(() => setCopied(""), 2500);
  };

  /* 월간 그리드 — 주말은 이벤트가 없으니 월~금 5열로 짠다 */
  const grid = useMemo(() => {
    const days = monthDays[month] ?? [];
    const byDate = new Map(days.map((d) => [d.date, d]));
    const [y, m] = month.split("-").map(Number);
    type Cell = { date: string; d: CalDay | null; dayNum: number };
    const weeks: Cell[][] = [];
    let cur: Cell[] = [];
    for (let day = 1; day <= 31; day++) {
      const dt = new Date(Date.UTC(y, m - 1, day));
      if (dt.getUTCMonth() !== m - 1) break;
      const wd = dt.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      if (wd === 1 && cur.length) { weeks.push(cur); cur = []; }
      if (!cur.length && wd > 1 && !weeks.length) {
        for (let i = 1; i < wd; i++) cur.push({ date: "", d: null, dayNum: 0 });
      }
      const iso = dt.toISOString().slice(0, 10);
      cur.push({ date: iso, d: byDate.get(iso) ?? null, dayNum: day });
    }
    if (cur.length) weeks.push(cur);
    return weeks;
  }, [month, monthDays]);

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7));
  };

  return (
    <section className="section" role="tabpanel" aria-label="캘린더">
      <div className="cal-controls">
        <div className="seg" role="group" aria-label="캘린더 보기">
          {(["주간", "월간"] as const).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{v}</button>
          ))}
        </div>
        {view === "월간" && (
          <div className="cal-nav num">
            <button onClick={() => shiftMonth(-1)} aria-label="이전 달">‹</button>
            <b>{month.replace("-", ".")}</b>
            <button onClick={() => shiftMonth(1)} aria-label="다음 달">›</button>
          </div>
        )}
        {view === "주간" && week != null && week.length > 0 && (
          <button className="btn cal-make" onClick={() => setBuilder((b) => !b)} aria-expanded={builder}>
            {builder ? "표 만들기 닫기" : "주간 표 만들기"}
          </button>
        )}
      </div>

      {failed && <p className="log-empty">캘린더를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
      {!failed && week == null && <p className="log-empty">캘린더 불러오는 중…</p>}

      {view === "주간" && builder && week != null && (
        <div className="cal-builder">
          <p className="cal-builder-hint">
            날짜별 담당자를 적고 <b>표 복사</b>를 누르면 회의 자료용 표가 클립보드에 담깁니다.
            노션·워드에는 표 그대로, 카톡에는 텍스트로 붙습니다. 담당자는 이 브라우저에 저장됩니다.
          </p>
          {week.map((d) => {
            const { label } = dayLabel(d.date);
            const r = roster[d.date] ?? { lead: "", follow: "" };
            return (
              <div key={d.date} className="cal-person num">
                <span className="d">{label}</span>
                <input placeholder="리딩" value={r.lead} onChange={(e) => setPerson(d.date, "lead", e.target.value)} />
                <input placeholder="팔로잉" value={r.follow} onChange={(e) => setPerson(d.date, "follow", e.target.value)} />
              </div>
            );
          })}
          <button className="btn primary" onClick={copyTable}>
            {copied === "ok" ? "복사 완료 ✓" : copied === "fail" ? "복사 실패 — 다시 시도" : "표 복사"}
          </button>
        </div>
      )}

      {view === "주간" && (week ?? []).map((d) => {
        const { label, today } = dayLabel(d.date);
        return (
          <div key={d.date} className="cal-day" data-today={today} data-past={d.date < kstToday()}>
            <div className="cal-date num">
              {label}
              {today && <span className="cal-today">오늘</span>}
            </div>
            <div className="cal-cols">
              <div className="cal-col">
                <div className="cal-col-head">매크로</div>
                {d.macro.length === 0 && <div className="cal-none">—</div>}
                {d.macro.map((m, i) => <MacroItem key={i} m={m} />)}
              </div>
              <div className="cal-col">
                <div className="cal-col-head">어닝</div>
                {d.earnings.length === 0 && <div className="cal-none">—</div>}
                {d.earnings.map((e) => <EarnItem key={e.symbol} e={e} />)}
              </div>
            </div>
          </div>
        );
      })}

      {view === "월간" && (
        <div className="cal-grid-wrap">
          {!monthDays[month] && <p className="log-empty">불러오는 중…</p>}
          {monthDays[month] && (
            <table className="cal-grid">
              <thead>
                <tr>{["월", "화", "수", "목", "금"].map((w) => <th key={w}>{w}</th>)}</tr>
              </thead>
              <tbody>
                {grid.map((wk, i) => (
                  <tr key={i}>
                    {wk.map((cell, j) => (
                      <td
                        key={j}
                        data-today={cell.date === kstToday()}
                        data-past={!!cell.date && cell.date < kstToday()}
                        data-empty={!cell.date}
                        data-sel={!!cell.date && cell.date === selDay}
                        data-clickable={!!cell.d}
                        onClick={() => cell.d && setSelDay((cur) => (cur === cell.date ? null : cell.date))}
                      >
                        {cell.date && (
                          <>
                            <div className="g-day num">{cell.dayNum}</div>
                            {cell.d?.macro.slice(0, 3).map((m, k) => (
                              <div key={"m" + k} className="g-ev macro" data-impact={m.impact}
                                title={`${kstTime(m.time)} ${m.country} · ${m.ko ?? m.title}${m.actual ? ` — 실제 ${m.actual}${m.verdict ? ` (예상 ${m.verdict})` : ""}` : ""}${m.desc ? ` — ${m.desc}` : ""}`}>
                                {m.country === "한국" ? "🇰🇷 " : ""}{m.ko ?? m.title}
                              </div>
                            ))}
                            {cell.d?.earnings.slice(0, 3).map((e) => (
                              <div key={e.symbol} className="g-ev earn" data-held={e.held}
                                title={`${e.name} · ${e.tag} (${e.when || "시간 미정"})${e.epsActual != null ? ` — 실제 EPS ${e.epsActual}${e.surprisePct != null ? ` (${e.surprisePct >= 0 ? "+" : ""}${e.surprisePct}%)` : ""}` : ""}`}>
                                {e.symbol}{e.held ? " ★" : ""}
                              </div>
                            ))}
                            {cell.d && cell.d.macro.length + cell.d.earnings.length > 6 && (
                              <div className="g-more">+{cell.d.macro.length + cell.d.earnings.length - 6}</div>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                    {wk.length < 5 && Array.from({ length: 5 - wk.length }).map((_, k) => (
                      <td key={"pad" + k} data-empty="true" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {/* 클릭한 날짜의 상세 — 주간 뷰와 같은 형식 */}
          {selDay && (() => {
            const d = (monthDays[month] ?? []).find((x) => x.date === selDay);
            const { label } = dayLabel(selDay);
            return (
              <div className="cal-day cal-detail" data-today={selDay === kstToday()}>
                <div className="cal-date num">
                  {label}
                  {selDay === kstToday() && <span className="cal-today">오늘</span>}
                  <button className="cal-close" onClick={() => setSelDay(null)} aria-label="상세 닫기">닫기 ✕</button>
                </div>
                {!d && <div className="cal-none">등록된 일정이 없습니다</div>}
                {d && (
                  <div className="cal-cols">
                    <div className="cal-col">
                      <div className="cal-col-head">매크로</div>
                      {d.macro.length === 0 && <div className="cal-none">—</div>}
                      {d.macro.map((m, i) => <MacroItem key={i} m={m} />)}
                    </div>
                    <div className="cal-col">
                      <div className="cal-col-head">어닝</div>
                      {d.earnings.length === 0 && <div className="cal-none">—</div>}
                      {d.earnings.map((e) => <EarnItem key={e.symbol} e={e} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
          <p className="log-foot">
            날짜 칸을 누르면 아래에 그날의 상세(예상·실제치 포함)가 표시됩니다.
            월간 뷰는 어닝(Nasdaq)과 한국 확정 일정 중심입니다 — 해외 매크로 피드는 이번 주 분량만 제공되어
            다른 주에는 표시되지 않습니다.
          </p>
        </div>
      )}

      {view === "주간" && (
        <p className="log-foot">
          시각은 한국시간(KST). 매크로는 미국·영국·일본·유로존·중국(High) + 미국 Medium + 한국 확정 일정,
          어닝은 보유 종목 전부 + 섹터 관련 + 시총 $500B 이상입니다. 발표가 끝난 이벤트에는 실제치와 예상 대비 판정이 붙습니다. 30분마다 갱신.
        </p>
      )}
    </section>
  );
}
