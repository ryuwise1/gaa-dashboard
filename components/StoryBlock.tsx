"use client";

import { useEffect, useState, type ReactNode } from "react";
import { HOLDINGS } from "@/lib/portfolio";

/**
 * 투자 스토리 — 이 포트폴리오가 무슨 베팅인지 첫 화면에서 읽히게 한다.
 * 역할을 네 묶음(알파 / 헤지 / 분산 / 현금성 자산)으로 묶고, 그 안을 슬리브로 나눈다.
 * 5%짜리 위성 슬리브가 단독 행으로 떠서 구조가 기괴해 보이는 것을 막기 위한 2단 구조.
 * 기본은 접힘: 묶음 4개의 스택 바 + 범례만. 펼치면 슬리브별 근거가 개조식으로 나온다.
 * 비중은 holdings.json의 목표 비중(MP)을 섹터→슬리브 매핑으로 집계한다.
 */

interface Part { label: string; sectors: string[]; bullets: ReactNode[] }
interface Group { key: string; color: string; parts: Part[] }

const GROUPS: Group[] = [
  {
    key: "공격형", color: "var(--s2)",
    parts: [
      {
        label: "AI CapEx — 메모리 병목", sectors: ["AI CapEx"],
        bullets: [
          <>AI 데이터센터 투자 확대 → <b>메모리 공급 부족</b>이라는 판단</>,
          <>공급 측 <b>SK하이닉스 5 · 삼성전자 5</b>(확정 10%) / 수요 측 <b>MSFT·META</b>, 파운드리 옵션 <b>INTC</b> — 10/16 기존 종목 1/3 익절</>,
        ],
      },
      {
        label: "전력 인프라", sectors: ["전력 인프라"],
        bullets: [
          <>AI 데이터센터의 병목이 <b>전력·냉각</b>으로 옮겨 가는 구간 — <b>VRT·GEV·ETN·BE</b></>,
          <>10/16 배분안으로 신규 편입, 슬리브 안 비율은 팀원 응답 평균</>,
        ],
      },
      {
        label: "AI 보안", sectors: ["AI 보안"],
        bullets: [
          <>AI 도입의 다음 단계 지출 — 탐지 <b>CrowdStrike</b>, 복구 <b>Rubrik</b></>,
          <>10/16 배분안에서 <b>7%로 확대</b>(응답 평균, RBRK 4 · CRWD 3)</>,
        ],
      },
      {
        label: "메모리 역상관", sectors: ["메모리 역상관"],
        bullets: [<><b>메모리를 원가로 부담</b>하는 QCOM·AAPL·DELL·HPQ — 10/16 공격형으로 옮기며 1.25%씩으로 축소</>],
      },
      {
        label: "반도체 장비·파운드리", sectors: ["반도체"],
        bullets: [<>메모리 업체 설비투자의 장비 수혜 <b>ASML</b>, 파운드리 1위 <b>TSMC</b> — 삼전·하닉 축소분의 위험 분산</>],
      },
    ],
  },
  {
    key: "방어형", color: "var(--s7)",
    parts: [
      {
        label: "필수소비재 · 헬스케어 · 보험", sectors: ["필수소비재", "헬스케어", "보험"],
        bullets: [
          <>경기 방어 ETF <b>XLP·XLV</b>와 <b>버크셔 해서웨이</b>를 10 : 10 : 5로 — 개별주 대신 ETF 위주(4 : 1)</>,
          <>금리 상승에도 손실이 난 은행 <b>JPM·BAC·XLF</b>는 10/16 <b>전량 매도</b>(확정 6/6)</>,
        ],
      },
    ],
  },
  {
    key: "원자재", color: "var(--s3)",
    parts: [
      {
        label: "에너지 (원자재 관련주)", sectors: ["에너지"],
        bullets: [<>메이저 4종 <b>XOM·CVX·SHEL·TTE</b> — 지정학·유가 상방 대비, 배당</>],
      },
    ],
  },
  {
    key: "현금", color: "var(--s1)",
    parts: [
      {
        label: "SGOV · 현금", sectors: ["현금성 자산"],
        bullets: [
          <>초단기 국채 <b>SGOV</b> 5%(배당 자동 재투자 대상)와 현금을 따로 관리</>,
          <>10/16 배분안에서 현금성 합계 <b>18.3%</b>(팀원 응답 평균) — 현금 10% 안은 1명에 그쳐 평균에 반영</>,
        ],
      },
    ],
  },
];

const weightOf = (sectors: string[]) =>
  HOLDINGS.positions.filter((p) => sectors.includes(p.sector)).reduce((s, p) => s + p.targetWeight, 0)
  // SGOV와 별개로 관리하는 "현금" 목표는 종목이 아니라 meta에 있다
  + (sectors.includes("현금성 자산") ? HOLDINGS.meta.cashTargetWeight ?? 0 : 0);
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
            핵심 논지는 AI 투자 사이클의 <b>메모리 병목</b>이며, 병목이 옮겨 가는 <b>전력 인프라</b>와 후행 수혜인 <b>AI 보안</b>을 함께 두었습니다.
            방어형은 경기 방어 업종으로 공격형이 흔들리는 국면에 대비하고, 원자재는 상관이 낮은 자산군이며, 현금성 자산은 대기 재원입니다.
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
