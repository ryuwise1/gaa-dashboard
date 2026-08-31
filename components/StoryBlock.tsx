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
    line: "AI 데이터센터 투자 확대가 메모리 공급 부족으로 이어진다는 판단입니다. 공급 측(삼성전자·SK하이닉스)과 수요 측(MSFT·META)을 함께 편입했습니다",
  },
  {
    key: "헤지 ①", tone: "hedge", sectors: ["메모리 역상관"],
    line: "메모리를 원가로 부담하는 기업(QCOM·AAPL·DELL·HPQ)입니다. 메모리 가격 하락 국면에서 포트폴리오를 방어합니다",
  },
  {
    key: "헤지 ②", tone: "hedge", sectors: ["금리 (인하)", "금리 (인상)"],
    line: "장기 국채(TLT·IEF)와 은행(JPM·BAC·XLF)을 양방향으로 보유하여 금리 변동의 영향을 중립화했습니다",
  },
  {
    key: "분산", tone: "div", sectors: ["에너지", "유럽 방산"],
    line: "에너지 메이저 4종과 유럽 방산(EUAD)으로, 주력 테마와 상관관계가 낮은 자산군입니다",
  },
  {
    key: "코어·현금", tone: "core", sectors: ["코어 인덱스", "현금"],
    line: "월드 인덱스(VT)와 초단기 국채(SGOV)입니다. 차기 기수 합류 이후의 본격 운용을 위해 남겨 둔 재원입니다",
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
        <span className="meta">목표 비중 기준 · 종목별 편입 근거는 매수·매도 플랜에서 각 종목을 선택하면 확인할 수 있습니다</span>
      </div>
      <p className="story-thesis">
        본 포트폴리오의 핵심 투자 논지는 AI 투자 사이클에서 발생하는 <b>메모리 병목</b>입니다.
        해당 사이클을 공급과 수요 양측에서 매수하고, 반대 국면에 대비한 종목을 함께 편입했으며,
        금리 리스크는 양방향 포지션으로 중립화했습니다.
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
