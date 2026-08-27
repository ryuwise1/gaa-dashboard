/**
 * 매크로 지표 한글 사전.
 * 지표는 매달 같은 이름으로 반복되므로 정적 사전이면 거의 다 커버된다 —
 * AI 번역과 달리 비용이 없고 표기가 흔들리지 않는다.
 * 앞에서부터 부분일치로 찾으므로 구체적인 패턴을 위에 둔다.
 */

interface Entry {
  /** 영문 제목에 이 문자열이 포함되면 매칭 */
  match: string;
  ko: string;
  /** 왜 중요한지 한 줄 — 툴팁용 */
  desc: string;
}

const DICT: Entry[] = [
  // ── 물가 ──
  { match: "Core PCE Price Index", ko: "근원 PCE 물가", desc: "연준이 공식으로 삼는 물가지표 — 금리 경로에 직결 (TLT·IEF)" },
  { match: "PCE Price Index", ko: "PCE 물가", desc: "연준 기준 물가지표" },
  { match: "Core CPI", ko: "근원 소비자물가(CPI)", desc: "변동성 큰 식품·에너지 제외 물가" },
  { match: "CPI Flash Estimate", ko: "소비자물가(CPI) 속보치", desc: "물가 선행 신호" },
  { match: "CPI", ko: "소비자물가(CPI)", desc: "인플레이션 대표 지표 — 금리 기대에 직결" },
  { match: "Core PPI", ko: "근원 생산자물가(PPI)", desc: "소비자물가의 선행 지표" },
  { match: "PPI", ko: "생산자물가(PPI)", desc: "소비자물가의 선행 지표" },
  { match: "Inflation Expectations", ko: "기대인플레이션", desc: "장기 물가 심리 — 연준이 주시" },

  // ── 성장·소비 ──
  { match: "Advance GDP", ko: "GDP 속보치", desc: "분기 성장률 첫 발표 — 시장 영향 가장 큼" },
  { match: "Prelim GDP Price Index", ko: "GDP 물가지수", desc: "GDP에 딸려 나오는 물가 지표" },
  { match: "Prelim GDP", ko: "GDP 잠정치", desc: "분기 성장률 수정 발표" },
  { match: "Final GDP", ko: "GDP 확정치", desc: "분기 성장률 확정 발표" },
  { match: "GDP", ko: "GDP 성장률", desc: "경기의 큰 방향" },
  { match: "Core Retail Sales", ko: "근원 소매판매", desc: "자동차 제외 소비 — 미국 경기의 7할이 소비" },
  { match: "Retail Sales", ko: "소매판매", desc: "소비 경기 체온계" },
  { match: "CB Consumer Confidence", ko: "컨퍼런스보드 소비자신뢰지수", desc: "소비 심리 선행 지표" },
  { match: "UoM Consumer Sentiment", ko: "미시간대 소비자심리지수", desc: "소비 심리 + 기대인플레 서베이" },

  // ── 고용 ──
  { match: "Non-Farm Employment Change", ko: "비농업 고용", desc: "미국 고용의 대표 지표 — 발표 순간 변동성 큼" },
  { match: "ADP Non-Farm", ko: "ADP 민간고용", desc: "비농업 고용의 이틀 전 예고편" },
  { match: "Unemployment Claims", ko: "신규 실업수당청구", desc: "매주 나오는 고용 냉각 신호 — 늘면 인하 기대↑" },
  { match: "Unemployment Rate", ko: "실업률", desc: "고용 시장 체온계" },
  { match: "Average Hourly Earnings", ko: "시간당 임금", desc: "임금발 인플레 압력" },
  { match: "JOLTS Job Openings", ko: "구인건수(JOLTS)", desc: "노동 수요 — 연준이 주시" },
  { match: "Benchmark Payrolls Revision", ko: "고용 벤치마크 수정치", desc: "과거 고용 통계의 대규모 소급 수정 — 서프라이즈 잦음" },

  // ── 제조·서비스 ──
  { match: "ISM Manufacturing PMI", ko: "ISM 제조업 PMI", desc: "50 위면 확장, 아래면 위축" },
  { match: "ISM Services PMI", ko: "ISM 서비스업 PMI", desc: "미국 경제의 대부분은 서비스업" },
  { match: "Flash Manufacturing PMI", ko: "제조업 PMI 속보치", desc: "그 달 경기를 가장 먼저 보여주는 서베이" },
  { match: "Flash Services PMI", ko: "서비스업 PMI 속보치", desc: "그 달 경기를 가장 먼저 보여주는 서베이" },
  { match: "Manufacturing PMI", ko: "제조업 PMI", desc: "제조업 경기 서베이" },
  { match: "Philly Fed Manufacturing", ko: "필라델피아 연은 제조업지수", desc: "지역 연은 제조업 서베이" },
  { match: "Empire State Manufacturing", ko: "뉴욕 연은 제조업지수", desc: "지역 연은 제조업 서베이" },
  { match: "ifo Business Climate", ko: "ifo 기업환경지수", desc: "독일(유럽 최대 경제) 기업 심리" },
  { match: "ZEW Economic Sentiment", ko: "ZEW 경기기대지수", desc: "독일 금융가 심리 서베이" },

  // ── 통화정책 ──
  { match: "FOMC Meeting Minutes", ko: "FOMC 의사록", desc: "연준 내부 논의 공개 — 인하 힌트 찾기" },
  { match: "FOMC Statement", ko: "FOMC 성명", desc: "미국 기준금리 결정" },
  { match: "FOMC Press Conference", ko: "FOMC 기자회견", desc: "의장 발언 한 마디에 시장이 움직임" },
  { match: "Federal Funds Rate", ko: "미국 기준금리 결정", desc: "TLT·IEF·환율 전부에 직결" },
  { match: "Fed Chairman", ko: "연준 의장 연설", desc: "통화정책 방향 힌트 — 잭슨홀·의회 증언 등" },
  { match: "Fed Chair", ko: "연준 의장 연설", desc: "통화정책 방향 힌트" },
  { match: "Treasury Sec", ko: "미 재무장관 발언", desc: "재정·국채 발행 관련 발언" },
  { match: "Main Refinancing Rate", ko: "ECB 기준금리", desc: "유로존 통화정책 — EUAD 등 유럽 자산에 영향" },
  { match: "Monetary Policy Statement", ko: "통화정책 성명", desc: "중앙은행 금리 결정" },
  { match: "Official Bank Rate", ko: "영란은행 기준금리", desc: "영국 통화정책" },
  { match: "BOJ Policy Rate", ko: "일본은행 기준금리", desc: "엔 캐리 흐름 — 글로벌 유동성에 영향" },
  { match: "Outlook Report", ko: "일본은행 전망 보고서", desc: "BOJ의 물가·성장 전망" },

  // ── 기타 ──
  { match: "Trade Balance", ko: "무역수지", desc: "수출입 격차" },
  { match: "Crude Oil Inventories", ko: "EIA 원유재고", desc: "유가 단기 재료 — SHEL·TTE" },
  { match: "Pending Home Sales", ko: "잠정주택판매", desc: "금리에 민감한 주택 경기" },
  { match: "Existing Home Sales", ko: "기존주택판매", desc: "금리에 민감한 주택 경기" },
  { match: "New Home Sales", ko: "신규주택판매", desc: "금리에 민감한 주택 경기" },
  { match: "Durable Goods Orders", ko: "내구재 주문", desc: "기업 투자 선행 지표" },
  { match: "New Loans", ko: "신규 위안화 대출", desc: "중국 유동성 — 코스피·원자재에 영향" },
  { match: "Industrial Production", ko: "산업생산", desc: "제조업 실물 지표" },
];

export function koMacro(title: string): { ko: string; desc: string } | null {
  for (const e of DICT) if (title.includes(e.match)) return { ko: e.ko, desc: e.desc };
  return null;
}
