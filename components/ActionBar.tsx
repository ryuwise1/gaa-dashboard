"use client";

import ACTIONS from "@/data/actions.json";

/**
 * 오늘 할 일 — 팀 전용 배너.
 * 예약된 집행·감시 룰·기록 대기가 종목 상세에 묻히지 않고 첫 화면에서 보이게 한다.
 * 데이터는 data/actions.json — 끝난 항목은 지우고 새 예약은 추가한다 (규칙: CLAUDE.md).
 */

interface ActionItem { id: string; type: string; text: string; detail?: string; due?: string }

function dueChip(due: string | undefined, today: string) {
  if (!due) return null;
  const label = `${Number(due.slice(5, 7))}/${Number(due.slice(8, 10))}`;
  if (due < today) return { cls: "over", label: `${label} 지연` };
  if (due === today) return { cls: "today", label: "오늘" };
  return { cls: "", label };
}

export default function ActionBar() {
  const items = (ACTIONS.items ?? []) as ActionItem[];
  if (items.length === 0) return null;
  // 기기 시간대와 무관하게 KST 날짜로 "오늘"을 판정한다
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  return (
    <section className="actions" aria-label="오늘 할 일">
      <div className="actions-head">
        <h2>오늘 할 일</h2>
        <span className="cnt num">{items.length}</span>
      </div>
      <ul>
        {items.map((it) => {
          const due = dueChip(it.due, today);
          return (
            <li key={it.id}>
              <span className={`act-type${it.type === "집행 예정" ? " exec" : ""}`}>{it.type}</span>
              <span className="act-body">
                <b>{it.text}</b>
                {it.detail && <span className="act-detail">{it.detail}</span>}
              </span>
              {due && <span className={`act-due num ${due.cls}`}>{due.label}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
