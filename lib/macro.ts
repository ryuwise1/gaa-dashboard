/**
 * 상단 지표 밴드. 보유 종목은 아니지만 시세 API 화이트리스트에 포함된다.
 * FICC(금리·환율·원자재)와 주요 주가지수를 한 줄에서 같이 본다.
 */
export interface MacroSpec {
  symbol: string;
  label: string;
  /** 이름 옆 작은 꼬리표 — 무슨 성격의 지표인지 */
  tag: string;
  /** 값 표기 방식 */
  kind: "plain" | "usd" | "krw" | "pct";
  digits: number;
  /** 오르는 게 좋은 지표가 아닐 때 툴팁으로 설명한다 */
  hint: string;
}

export const MACRO: MacroSpec[] = [
  { symbol: "^KS11", label: "코스피", tag: "국내", kind: "plain", digits: 2, hint: "한국종합주가지수" },
  { symbol: "^GSPC", label: "S&P 500", tag: "미국", kind: "plain", digits: 2, hint: "미국 대형주 지수" },
  { symbol: "^IXIC", label: "나스닥", tag: "미국", kind: "plain", digits: 2, hint: "나스닥 종합지수" },
  { symbol: "KRW=X", label: "원/달러", tag: "환율", kind: "krw", digits: 2, hint: "오르면 원화 약세 — 국내주식 달러 평가액에 불리" },
  { symbol: "^TNX", label: "미 10년물", tag: "금리", kind: "pct", digits: 3, hint: "오르면 TLT·IEF에 불리" },
  { symbol: "^VIX", label: "VIX", tag: "변동성", kind: "plain", digits: 2, hint: "오르면 위험자산에 불리" },
  { symbol: "DX-Y.NYB", label: "달러지수", tag: "환율", kind: "plain", digits: 2, hint: "달러 강세 정도" },
  { symbol: "GC=F", label: "금", tag: "원자재", kind: "usd", digits: 1, hint: "금 선물" },
  { symbol: "CL=F", label: "WTI", tag: "원자재", kind: "usd", digits: 2, hint: "서부텍사스유 — SHEL에 순풍" },
  { symbol: "BZ=F", label: "브렌트", tag: "원자재", kind: "usd", digits: 2, hint: "브렌트유 — SHEL에 순풍" },
];

export const MACRO_SYMBOLS = MACRO.map((m) => m.symbol);

export function fmtMacro(spec: MacroSpec, v: number | null): string {
  if (v == null) return "—";
  const n = v.toLocaleString("en-US", {
    minimumFractionDigits: spec.digits,
    maximumFractionDigits: spec.digits,
  });
  if (spec.kind === "usd") return "$" + n;
  if (spec.kind === "krw") return n + "원";
  if (spec.kind === "pct") return n + "%";
  return n;
}

/** 전일 대비 절대 변화량 — 지수는 퍼센트보다 포인트가 눈에 익다 */
export function fmtMacroDelta(spec: MacroSpec, price: number, prev: number): string {
  const d = price - prev;
  const s = d > 0 ? "+" : d < 0 ? "−" : "";
  const n = Math.abs(d).toLocaleString("en-US", {
    minimumFractionDigits: spec.digits,
    maximumFractionDigits: spec.digits,
  });
  return s + n;
}
