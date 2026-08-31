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
    line: "AI 데이터센터 투자가 늘수록 메모리가 부족해진다는 판단. 만드는 쪽(삼성전자·SK하이닉스)과 쓰는 쪽(MSFT·META)을 같이 담았습니다",
  },
  {
    key: "헤지 ①", tone: "hedge", sectors: ["메모리 역상관"],
    line: "메모리를 사서 쓰는 회사들(QCOM·AAPL·DELL·HPQ). 메모리 가격이 꺾이면 이쪽이 방어해 줍니다",
  },
  {
    key: "헤지 ②", tone: "hedge", sectors: ["금리 (인하)", "금리 (인상)"],
    line: "장기채(TLT·IEF)와 은행(JPM·BAC·XLF)을 양쪽에 걸어서, 금리가 어느 쪽으로 가든 충격을 줄였습니다",
  },
  {
    key: "분산", tone: "div", sectors: ["에너지", "유럽 방산"],
    line: "에너지 메이저 4종과 유럽 방산(EUAD). 위 테마들과 따로 움직이는 자리입니다",
  },
  {
    key: "코어·현금", tone: "core", sectors: ["코어 인덱스", "현금"],
    line: "월드 인덱스(VT)와 초단기채(SGOV). 다음 기수가 들어오면 같이 제대로 굴려 보려고 남겨 둔 몫입니다",
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
        <span className="meta">목표 비중 기준 · 종목별 이유는 매수·매도 플랜에서 행을 누르면 볼 수 있습니다</span>
      </div>
      <p className="story-thesis">
        저희의 메인 베팅은 AI 투자 사이클이 만드는 <b>메모리 병목</b>입니다.
        이 흐름을 공급과 수요 양쪽에서 사고, 반대로 갈 때를 대비한 종목을 함께 담았으며,
        금리는 양쪽에 걸어 중립에 가깝게 뒀습니다.
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
