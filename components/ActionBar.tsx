"use client";

import { useEffect, useState } from "react";
import ACTIONS from "@/data/actions.json";

/**
 * 오늘 할 일 — 팀 전용 배너.
 * 기본은 접힘: 유형별 건수 + "오늘 N건" 요약 한 줄만 보인다. 펼침 상태는 브라우저에 기억.
 * 데이터는 data/actions.json — 끝난 항목은 지우고 새 예약은 추가한다 (규칙: CLAUDE.md).
 */

interface ActionItem { id: string; type: string; text: string; bullets?: string[]; due?: string }

function dueChip(due: string | undefined, today: string) {
  if (!due) return null;
  const label = `${Number(due.slice(5, 7))}/${Number(due.slice(8, 10))}`;
  if (due < today) return { cls: "over", label: `${label} 지연` };
  if (due === today) return { cls: "today", label: "오늘" };
  return { cls: "", label };
}

export default function ActionBar() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("gaa-actions") === "on") setOpen(true); } catch {}
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem("gaa-actions", next ? "on" : "off"); } catch {}
  };

  const items = (ACTIONS.items ?? []) as ActionItem[];
  if (items.length === 0) return null;
  // 기기 시간대와 무관하게 KST 날짜로 "오늘"을 판정한다
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });

  // 접힘 요약 — 유형별 건수, 오늘 마감은 따로 강조
  const byType = new Map<string, number>();
  for (const it of items) byType.set(it.type, (byType.get(it.type) ?? 0) + 1);
  const summary = [...byType.entries()].map(([t, n]) => `${t} ${n}`).join(" · ");
  const dueToday = items.filter((it) => it.due === today).length;
  const overdue = items.filter((it) => it.due && it.due < today).length;

  return (
    <section className="actions" data-collapsed={!open || undefined} aria-label="오늘 할 일">
      <div className="actions-head">
        <h2>오늘 할 일</h2>
        <span className="cnt num">{items.length}</span>
        {!open && <span className="act-summary num">{summary}</span>}
        {!open && overdue > 0 && <span className="act-due over num">지연 {overdue}건</span>}
        {!open && dueToday > 0 && <span className="act-due today num">오늘 {dueToday}건</span>}
        <button className="story-toggle" onClick={toggle} aria-expanded={open}>
          {open ? "접기 ▴" : "펼치기 ▾"}
        </button>
      </div>
      {open && (
        <ul>
          {items.map((it) => {
            const due = dueChip(it.due, today);
            return (
              <li key={it.id}>
                <span className={`act-type${it.type === "집행 예정" ? " exec" : ""}`}>{it.type}</span>
                <span className="act-body">
                  <b>{it.text}</b>
                  {!!it.bullets?.length && (
                    <ul className="act-bullets">
                      {it.bullets.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                </span>
                {due && <span className={`act-due num ${due.cls}`}>{due.label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
