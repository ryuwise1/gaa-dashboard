"use client";

import { useEffect, useState } from "react";
import { HOLDINGS } from "@/lib/portfolio";

/**
 * 투자 스토리 — 이 포트폴리오가 무슨 베팅인지 첫 화면에서 읽히게 한다.
 * 기본은 접힘: 역할별 비중 스택 바 + 범례만으로 구조가 한눈에 보인다.
 * 펼치면 같은 차트 아래로 역할별 근거가 개조식으로 나온다.
 * 비중은 holdings.json의 목표 비중(MP)을 섹터→역할 매핑으로 집계한다.
 */

const ROLES: { key: string; color: string; sectors: string[]; bullets: string[] }[] = [
  {
    key: "메인 알파", color: "var(--s2)", sectors: ["AI CapEx"],
    bullets: [
      "AI 데이터센터 투자 확대 → 메모리 공급 부족이라는 판단",
      "공급 측 삼성전자·SK하이닉스 / 수요 측 MSFT·META를 함께 편입",
      "9/8 코스피 저항 돌파 확인 후 SK하이닉스 비중 상향 (3.0% → 4.5%)",
    ],
  },
  {
    key: "알파 ②", color: "var(--s9)", sectors: ["AI 보안"],
    bullets: [
      "AI 도입의 다음 단계 지출인 보안 — 탐지 층 CrowdStrike, 복구 층 Rubrik",
      "GPT-6 Astra의 사이버보안 'Critical' 등급 도달(9/3)로 촉매 현실화 판단",
    ],
  },
  {
    key: "헤지 ①", color: "var(--s7)", sectors: ["메모리 역상관"],
    bullets: [
      "메모리를 원가로 부담하는 기업 (QCOM·AAPL·DELL·HPQ)",
      "메모리 가격 하락 국면에서 포트폴리오를 방어",
    ],
  },
  {
    key: "헤지 ②", color: "var(--s5)", sectors: ["금리 (인하)", "금리 (인상)"],
    bullets: [
      "장기 국채(TLT·IEF) ↔ 은행(JPM·BAC·XLF) 양방향 보유",
      "금리 방향과 무관하게 영향을 중립화",
    ],
  },
  {
    key: "분산", color: "var(--s3)", sectors: ["에너지", "유럽 방산"],
    bullets: [
      "에너지 메이저 4종 + 유럽 방산(EUAD) — 주력 테마와 상관 낮은 자산군",
      "방산은 휴전 협상 진전으로 목표 절반 축소, AI 보안으로 로테이션 중",
    ],
  },
  {
    key: "코어·현금", color: "var(--s1)", sectors: ["코어 인덱스", "현금"],
    bullets: [
      "월드 인덱스(VT) + 초단기 국채(SGOV)",
      "차기 기수 합류 이후의 본격 운용을 위해 남겨 둔 재원",
    ],
  },
];

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

  const weightOf = (sectors: string[]) =>
    HOLDINGS.positions
      .filter((p) => sectors.includes(p.sector))
      .reduce((s, p) => s + p.targetWeight, 0);
  const pct = (sectors: string[]) =>
    (weightOf(sectors) * 100).toFixed(1).replace(/\.0$/, "");

  return (
    <div className="story" data-collapsed={!open || undefined}>
      <div className="story-head">
        <h2>투자 스토리</h2>
        {open && <span className="meta">목표 비중 기준 · 종목별 근거는 매수·매도 플랜에서 각 종목 선택</span>}
        <button className="story-toggle" onClick={toggle} aria-expanded={open}>
          {open ? "접기 ▴" : "펼치기 ▾"}
        </button>
      </div>

      {/* 역할별 목표 비중 — 접혀 있어도 항상 보이는 구조 요약 */}
      <div className="story-bar" role="img" aria-label="역할별 목표 비중">
        {ROLES.map((r) => (
          <i key={r.key} style={{ width: `${weightOf(r.sectors) * 100}%`, background: r.color }} title={`${r.key} ${pct(r.sectors)}%`} />
        ))}
      </div>
      <div className="story-legend">
        {ROLES.map((r) => (
          <span key={r.key} className="story-leg">
            <i style={{ background: r.color }} />
            {r.key} <b className="num">{pct(r.sectors)}%</b>
          </span>
        ))}
      </div>

      {open && (
        <>
          <p className="story-thesis">
            핵심 논지는 AI 투자 사이클의 <b>메모리 병목</b>이며, 그 후행 수혜로 <b>AI 보안</b>을 확장 편입했습니다.
          </p>
          <ul className="story-roles">
            {ROLES.map((r) => (
              <li key={r.key}>
                <span className="story-badge" style={{ background: `color-mix(in srgb, ${r.color} 16%, transparent)`, color: r.color }}>
                  {r.key}
                </span>
                <b className="num">{pct(r.sectors)}%</b>
                <ul className="story-bullets">
                  {r.bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
