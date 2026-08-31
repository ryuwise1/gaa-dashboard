"use client";

import { HOLDINGS } from "@/lib/portfolio";

/**
 * 투자 스토리 — 이 포트폴리오가 무슨 베팅인지 첫 화면에서 읽히게 한다.
 * "메인으로 무엇의 어떤 알파에 투자했고, 그걸 어떤 종목으로 표현했고,
 *  무엇으로 헤지하고, 나머지는 어떤 역할인가"를 역할 단위로 요약.
 * 비중은 holdings.json의 목표 비중(MP)을 섹터→역할 매핑으로 집계한다 (1차 회의 프레임 기준).
 */

const ROLES: { key: string; tone: "alpha" | "hedge" | "div" | "core"; sectors: string[]; line: string }[] = [
  {
    key: "메인 알파", tone: "alpha", sectors: ["AI CapEx"],
    line: "AI CapEx 사이클의 메모리 병목 — 공급(삼성전자·SK하이닉스)과 수요(MSFT·META)를 같이 들어 사이클 전체를 겨냥",
  },
  {
    key: "헤지 ①", tone: "hedge", sectors: ["메모리 역상관"],
    line: "메모리를 사는 쪽(QCOM·AAPL·DELL·HPQ) — 메인 베팅이 틀리는 국면(메모리 하락)의 방어",
  },
  {
    key: "헤지 ②", tone: "hedge", sectors: ["금리 (인하)", "금리 (인상)"],
    line: "장기채(TLT·IEF) ↔ 은행(JPM·BAC·XLF) 바벨 — 금리 방향을 중화, 순노출은 인하 쪽",
  },
  {
    key: "분산", tone: "div", sectors: ["에너지", "유럽 방산"],
    line: "에너지 메이저 4종 + 유럽 방산(EUAD) — 메인 테마와 상관이 낮은 자리",
  },
  {
    key: "코어·현금", tone: "core", sectors: ["코어 인덱스", "현금"],
    line: "월드 인덱스(VT) + 초단기채(SGOV) — 아직 견해를 싣지 않은 자본의 주차장",
  },
];

export default function StoryBlock() {
  const weightOf = (sectors: string[]) =>
    HOLDINGS.positions
      .filter((p) => sectors.includes(p.sector))
      .reduce((s, p) => s + p.targetWeight, 0);

  return (
    <div className="story">
      <div className="story-head">
        <h2>투자 스토리</h2>
        <span className="meta">목표 비중(MP) 기준 · 종목별 근거는 매수·매도 플랜에서 행을 누르면 보입니다</span>
      </div>
      <p className="story-thesis">
        메인 베팅은 <b>AI CapEx 사이클의 메모리 병목</b>입니다. 이 사이클을 공급과 수요 양쪽으로 사고,
        반대 국면은 메모리 원가를 지는 종목으로 방어하며, 금리 리스크는 바벨로 중화합니다.
      </p>
      <ul className="story-roles">
        {ROLES.map((r) => (
          <li key={r.key}>
            <span className={`story-badge ${r.tone}`}>{r.key}</span>
            <b className="num">{(weightOf(r.sectors) * 100).toFixed(1).replace(/\.0$/, "")}%</b>
            <span className="story-line">{r.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
