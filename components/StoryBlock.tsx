"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HOLDINGS } from "@/lib/portfolio";

/**
 * 투자 스토리 — 이 포트폴리오가 무슨 베팅인지 첫 화면에서 읽히게 한다.
 * 역할을 네 묶음(알파 / 헤지 / 분산 / 현금성 자산)으로 묶고, 그 안을 슬리브로 나눈다.
 * 4%짜리 위성 슬리브가 단독 행으로 떠서 구조가 기괴해 보이는 것을 막기 위한 2단 구조.
 * 기본은 접힘: 묶음 4개의 스택 바 + 범례만. 펼치면 슬리브별 근거가 개조식으로 나온다.
 * 비중은 holdings.json의 목표 비중(MP)을 섹터→슬리브 매핑으로 집계한다.
 */

interface Part { label: string; sectors: string[]; bullets: ReactNode[] }
interface Group { key: string; color: string; parts: Part[] }

const GROUPS: Group[] = [
  {
    key: "알파", color: "var(--s2)",
    parts: [
      {
        label: "메모리 병목 — 메인", sectors: ["AI CapEx"],
        bullets: [
          <>AI 데이터센터 투자 확대 → <b>메모리 공급 부족</b>이라는 판단</>,
          <>공급 측 <b>삼성전자·SK하이닉스</b> / 수요 측 <b>MSFT·META</b>, 파운드리 옵션 <b>INTC</b></>,
        ],
      },
      {
        label: "AI 보안 — 위성", sectors: ["AI 보안"],
        bullets: [
          <>AI 도입의 다음 단계 지출 — 탐지 <b>CrowdStrike</b>, 복구 <b>Rubrik</b></>,
          <>메인 15% 대비 <b>1/3 크기(5%)</b>의 위성 슬리브 — 검증 전 테마는 작게 시작해 2차로 채운다 (현재 1차 절반 편입)</>,
          <>GPT-6 Astra의 사이버보안 <b>&lsquo;Critical&rsquo; 등급</b> 도달(9/3)이 촉매</>,
        ],
      },
    ],
  },
  {
    key: "헤지", color: "var(--s7)",
    parts: [
      {
        label: "메모리 역상관", sectors: ["메모리 역상관"],
        bullets: [<><b>메모리를 원가로 부담</b>하는 QCOM·AAPL·DELL·HPQ — 메모리 하락 국면의 방어</>],
      },
      {
        label: "금리 바벨", sectors: ["금리 (인하)", "금리 (인상)"],
        bullets: [<>장기 국채 <b>TLT·IEF</b> ↔ 은행 <b>JPM·BAC·XLF</b> 양방향 — 금리 방향 <b>중립화</b></>],
      },
    ],
  },
  {
    key: "분산", color: "var(--s3)",
    parts: [
      {
        label: "에너지", sectors: ["에너지"],
        bullets: [<>메이저 4종 <b>XOM·CVX·SHEL·TTE</b> — 지정학·유가 상방 대비, 배당</>],
      },
      {
        label: "유럽 방산", sectors: ["유럽 방산"],
        bullets: [<><b>EUAD</b> — 휴전 협상 국면에서 절반 축소, 잔여는 협상 번복 대비 옵션</>],
      },
    ],
  },
  {
    key: "현금성 자산", color: "var(--s1)",
    parts: [
      {
        label: "VT · SGOV", sectors: ["현금성 자산"],
        bullets: [
          <>월드 인덱스 <b>VT</b> + 초단기 국채 <b>SGOV</b> (배당 자동 재투자 대상)</>,
          <><b>20기 신규 스토리(알파 ③)</b>에 배정할 재원 — 견해 없는 대기 자본</>,
        ],
      },
    ],
  },
];

const weightOf = (sectors: string[]) =>
  HOLDINGS.positions.filter((p) => sectors.includes(p.sector)).reduce((s, p) => s + p.targetWeight, 0);
const fmt = (w: number) => (w * 100).toFixed(2).replace(/\.?0+$/, "");

export default function StoryBlock() {
  // 기본은 접힘 — 펼친 상태는 브라우저에 기억된다
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (localStorage.getItem("gaa-story") === "on") setOpen(true); } catch {}
  }, []);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try { localStorage.setItem("gaa-story", next ? "on" : "off"); } catch {}
  };

  const groups = GROUPS.map((g) => {
    const parts = g.parts.map((p) => ({ ...p, w: weightOf(p.sectors) }));
    return { ...g, parts, w: parts.reduce((s, p) => s + p.w, 0) };
  });

  return (
    <div className="story" data-collapsed={!open || undefined}>
      <div className="story-head">
        <h2>투자 스토리</h2>
        {open && <span className="meta">목표 비중 기준 · 종목별 근거는 매수·매도 플랜에서 각 종목 선택</span>}
        <button className="story-toggle" onClick={toggle} aria-expanded={open}>
          {open ? "접기 ▴" : "펼치기 ▾"}
        </button>
      </div>

      {/* 묶음 4개의 스택 바 — 같은 묶음 안의 슬리브는 같은 색의 농담으로 나눈다 */}
      <div className="story-bar" role="img" aria-label="역할별 목표 비중">
        {groups.map((g) =>
          g.parts.map((p, i) => (
            <i
              key={g.key + p.label}
              style={{
                width: `${p.w * 100}%`,
                background: i === 0 ? g.color : `color-mix(in srgb, ${g.color} 55%, var(--bg))`,
              }}
              title={`${g.key} · ${p.label} ${fmt(p.w)}%`}
            />
          ))
        )}
      </div>
      <div className="story-legend">
        {groups.map((g) => (
          <span key={g.key} className="story-leg">
            <i style={{ background: g.color }} />
            {g.key} <b className="num">{fmt(g.w)}%</b>
            {g.parts.length > 1 && (
              <em className="num">({g.parts.map((p) => fmt(p.w)).join(" + ")})</em>
            )}
          </span>
        ))}
      </div>

      {open && (
        <>
          <p className="story-thesis">
            핵심 논지는 AI 투자 사이클의 <b>메모리 병목</b>이며, 그 후행 수혜인 <b>AI 보안</b>을 위성 알파로 두었습니다.
            헤지는 알파가 틀리는 국면에 대비하고, 분산은 상관이 낮은 자산군이며, 현금성 자산은 차기 기수의 신규 스토리에 배정할 재원입니다.
          </p>
          <ul className="story-roles">
            {groups.map((g) => (
              <li key={g.key}>
                <span className="story-badge" style={{ background: `color-mix(in srgb, ${g.color} 16%, transparent)`, color: g.color }}>
                  {g.key}
                </span>
                <b className="num">{fmt(g.w)}%</b>
                <div className="story-parts">
                  {g.parts.map((p) => (
                    <div key={p.label} className="story-part">
                      <div className="story-part-head">
                        <span>{p.label}</span>
                        <b className="num">{fmt(p.w)}%</b>
                      </div>
                      <ul className="story-bullets">
                        {p.bullets.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
