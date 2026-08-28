import { NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 오늘의 분석 — 규칙 기반 시그널.
 * 종목별로 일봉 6개월을 받아 추세(MA20·60)·모멘텀·RSI를 점수화하고,
 * 매크로(S&P·코스피·VIX·미10년·환율)로 시장 온도를 계산한다.
 * AI 판단이 아니라 명시된 규칙의 결과이므로, 근거(reasons)를 항상 함께 내려보낸다.
 */

interface Reason { t: string; good: boolean }
interface StockSignal {
  ticker: string; name: string; sector: string; status: string;
  score: number; label: "강세" | "중립" | "약세";
  close: number; chg1d: number | null; rsi: number | null;
  reasons: Reason[];
  /** 리서치 노트 요지 (원문은 리포 research/{티커}.md) */
  thesis?: string;
}

/**
 * 미보유 관심 종목 — 보유 섹터에 직접 물리는 이웃들 + 외부 리서치 노트로 들어온 종목.
 * 같은 야후 일봉이면 어떤 티커든 분석되므로 데이터 부담은 없다.
 * thesis가 있는 종목은 원문 리서치가 리포 research/{티커}.md에 있다 (8/27~28 반입).
 */
const WATCH: { ticker: string; name: string; tag: string; thesis?: string }[] = [
  { ticker: "NVDA", name: "NVIDIA", tag: "반도체·AI" },
  { ticker: "TSM", name: "TSMC", tag: "반도체·AI" },
  { ticker: "AVGO", name: "Broadcom", tag: "반도체·AI" },
  { ticker: "AMD", name: "AMD", tag: "반도체·AI" },
  { ticker: "MU", name: "Micron", tag: "반도체·AI" },
  { ticker: "ASML", name: "ASML", tag: "반도체·AI" },
  {
    ticker: "MRVL", name: "Marvell", tag: "반도체·AI",
    thesis: "커스텀 XPU·어태치 풀스택 — FY28 가이던스는 확정 수주만 반영, 스케일업 스위칭·신규 수주는 전부 상방. CXL은 메모리 사이클의 2차 수혜 경로",
  },
  { ticker: "GOOGL", name: "Alphabet", tag: "빅테크" },
  { ticker: "AMZN", name: "Amazon", tag: "빅테크" },
  { ticker: "ORCL", name: "Oracle", tag: "빅테크" },
  { ticker: "COP", name: "ConocoPhillips", tag: "에너지" },
  { ticker: "SLB", name: "SLB", tag: "에너지" },
  { ticker: "GS", name: "Goldman Sachs", tag: "금융" },
  { ticker: "MS", name: "Morgan Stanley", tag: "금융" },
  {
    ticker: "RBRK", name: "Rubrik", tag: "보안·복원",
    thesis: "백업이 아니라 '되돌릴 수 있는 상태'를 판다 — AI 에이전트 확산이 롤백 수요를 만든다는 논지. 성장률 둔화(51→39%)와 마진 전환(기여마진 −3%→13%)이 공존",
  },
  {
    ticker: "CRWD", name: "CrowdStrike", tag: "사이버보안",
    thesis: "AI 도입이 보안 현대화 사이클 점화 — 순신규 ARR +51% 사상 최대, 기저효과 가설 반증. Flex는 할인이 아니라 재약정 상승 사다리(전환 +40%·re-Flex +25%)",
  },
  {
    ticker: "ALM", name: "Almonty", tag: "텅스텐·전략자원",
    thesis: "비중국 텅스텐 P 사이클 — APT +579%, 매출 +498%, GTP 오프테이크 기간+6y·물량+40%. 상동광산 램프업은 3Q26 실적(11월)이 최초 검증",
  },
];
interface MarketItem { name: string; value: string; note: string; good: boolean | null }

let cache: { t: number; body: unknown } | null = null;
const TTL_MS = 30 * 60_000;

async function daily(symbol: string): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=6mo`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  const closes: unknown[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((c): c is number => typeof c === "number" && Number.isFinite(c));
}

function smaLast(xs: number[], n: number): number | null {
  if (xs.length < n) return null;
  let s = 0;
  for (let i = xs.length - n; i < xs.length; i++) s += xs[i];
  return s / n;
}

function rsi14(xs: number[]): number | null {
  const n = 14;
  if (xs.length < n + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = xs[i] - xs[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgG = gain / n, avgL = loss / n;
  for (let i = n + 1; i < xs.length; i++) {
    const d = xs[i] - xs[i - 1];
    avgG = (avgG * (n - 1) + Math.max(d, 0)) / n;
    avgL = (avgL * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (avgL === 0) return 100;
  return +(100 - 100 / (1 + avgG / avgL)).toFixed(1);
}

/** 최근 lookback일 안에서 MA20이 MA60을 가로질렀는지 (+1 골든 / -1 데드 / 0 없음) */
function recentCross(xs: number[], lookback: number): number {
  if (xs.length < 61 + lookback) return 0;
  const diffAt = (end: number) => {
    const slice = xs.slice(0, end);
    const a = smaLast(slice, 20), b = smaLast(slice, 60);
    return a != null && b != null ? a - b : null;
  };
  let prev = diffAt(xs.length - lookback);
  for (let k = lookback - 1; k >= 0; k--) {
    const cur = diffAt(xs.length - k);
    if (prev != null && cur != null && (prev > 0) !== (cur > 0)) return cur > 0 ? 1 : -1;
    prev = cur;
  }
  return 0;
}

function analyzeStock(xs: number[]): Omit<StockSignal, "ticker" | "name" | "sector" | "status"> | null {
  if (xs.length < 30) return null;
  const close = xs[xs.length - 1];
  const prev = xs[xs.length - 2];
  const ma20 = smaLast(xs, 20);
  const ma60 = smaLast(xs, 60);
  const rsi = rsi14(xs);
  const mom20 = xs.length > 21 ? close / xs[xs.length - 21] - 1 : null;
  const cross = recentCross(xs, 7);

  let score = 0;
  const reasons: Reason[] = [];
  if (ma20 != null) {
    const up = close > ma20;
    score += up ? 1 : -1;
    reasons.push({ t: up ? "MA20 위" : "MA20 아래", good: up });
  }
  if (ma60 != null) {
    const up = close > ma60;
    score += up ? 1 : -1;
    reasons.push({ t: up ? "MA60 위" : "MA60 아래", good: up });
  }
  if (ma20 != null && ma60 != null) {
    const aligned = ma20 > ma60;
    score += aligned ? 1 : -1;
    reasons.push({ t: aligned ? "정배열" : "역배열", good: aligned });
  }
  if (mom20 != null && Math.abs(mom20) >= 0.03) {
    const up = mom20 > 0;
    score += up ? 1 : -1;
    reasons.push({ t: `20일 ${up ? "+" : "−"}${Math.abs(mom20 * 100).toFixed(1)}%`, good: up });
  }
  if (cross !== 0) {
    score += cross;
    reasons.push({ t: cross > 0 ? "골든크로스 직후" : "데드크로스 직후", good: cross > 0 });
  }
  if (rsi != null && rsi >= 70) {
    score -= 1;
    reasons.push({ t: `RSI ${rsi} 과열`, good: false });
  }
  if (rsi != null && rsi <= 30) {
    // 추세가 살아있으면 눌림목, 죽어있으면 낙폭 과대 — 점수엔 반영하지 않고 사실만 표시
    reasons.push({ t: `RSI ${rsi} 과매도`, good: ma60 != null && close > ma60 });
  }

  const label: StockSignal["label"] = score >= 2 ? "강세" : score <= -2 ? "약세" : "중립";
  return {
    score, label, close: +close.toFixed(4),
    chg1d: prev ? +(close / prev - 1).toFixed(5) : null,
    rsi, reasons,
  };
}

export async function GET() {
  if (cache && Date.now() - cache.t < TTL_MS) {
    return NextResponse.json(cache.body, {
      headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
    });
  }

  // 현금성(SGOV 등)은 추세 시그널이 무의미해서 제외
  const positions = HOLDINGS.positions.filter(
    (p) => (p.targetUsd > 0 || (p.qty ?? 0) > 0) && p.sector !== "현금"
  );
  const MACRO = ["^GSPC", "^KS11", "^VIX", "^TNX", "KRW=X"];
  const symbols = [...positions.map((p) => p.yahoo), ...WATCH.map((w) => w.ticker), ...MACRO];
  const settled = await Promise.allSettled(symbols.map(daily));
  const series = new Map<string, number[]>();
  symbols.forEach((s, i) => {
    const r = settled[i];
    if (r.status === "fulfilled" && r.value.length) series.set(s, r.value);
  });

  // ── 종목별 시그널
  const stocks: StockSignal[] = [];
  for (const p of positions) {
    const xs = series.get(p.yahoo);
    if (!xs) continue;
    const a = analyzeStock(xs);
    if (!a) continue;
    stocks.push({ ticker: p.ticker, name: p.name, sector: p.sector, status: p.status, ...a });
  }
  stocks.sort((a, b) => b.score - a.score);

  // ── 관심 종목 (미보유)
  const watch: StockSignal[] = [];
  for (const w of WATCH) {
    const xs = series.get(w.ticker);
    if (!xs) continue;
    const a = analyzeStock(xs);
    if (!a) continue;
    watch.push({ ticker: w.ticker, name: w.name, sector: w.tag, status: "관심", thesis: w.thesis, ...a });
  }
  watch.sort((a, b) => b.score - a.score);

  // ── 시장 온도
  let mScore = 0;
  const items: MarketItem[] = [];
  const push = (name: string, value: string, note: string, good: boolean | null, weight = 1) => {
    if (good != null) mScore += good ? weight : -weight;
    items.push({ name, value, note, good });
  };
  const spx = series.get("^GSPC");
  if (spx) {
    const c = spx[spx.length - 1], m20 = smaLast(spx, 20), m60 = smaLast(spx, 60);
    if (m20 != null) push("S&P 500", c.toLocaleString("en-US", { maximumFractionDigits: 0 }), c > m20 ? "MA20 위 — 추세 유지" : "MA20 아래 — 추세 이탈", c > m20);
    if (m60 != null) push("S&P 중기", "", c > m60 ? "MA60 위" : "MA60 아래", c > m60);
  }
  const kospi = series.get("^KS11");
  if (kospi) {
    const c = kospi[kospi.length - 1], m20 = smaLast(kospi, 20);
    if (m20 != null) push("코스피", c.toLocaleString("en-US", { maximumFractionDigits: 0 }), c > m20 ? "MA20 위 — 추세 유지" : "MA20 아래 — 추세 이탈", c > m20);
  }
  const vix = series.get("^VIX");
  if (vix) {
    const c = vix[vix.length - 1];
    push("VIX", c.toFixed(1), c < 17 ? "낮음 — 시장 안정" : c < 25 ? "보통" : "높음 — 변동성 경계", c < 17 ? true : c < 25 ? null : false);
  }
  const tnx = series.get("^TNX");
  if (tnx && tnx.length > 5) {
    const c = tnx[tnx.length - 1], w = tnx[tnx.length - 6];
    const d = c - w;
    push("미 10년물", `${c.toFixed(2)}%`, `주간 ${d >= 0 ? "+" : "−"}${Math.abs(d).toFixed(2)}%p ${d < 0 ? "— 금리 부담 완화" : d > 0.1 ? "— 금리 상승 부담" : ""}`, d < 0 ? true : d > 0.1 ? false : null);
  }
  const krw = series.get("KRW=X");
  if (krw && krw.length > 5) {
    const c = krw[krw.length - 1], w = krw[krw.length - 6];
    const d = c / w - 1;
    push("원/달러", c.toFixed(0) + "원", `주간 ${d >= 0 ? "+" : "−"}${Math.abs(d * 100).toFixed(1)}% ${d < 0 ? "— 원화 강세(국내주식 환차익)" : ""}`, null);
  }
  const marketLabel = mScore >= 2 ? "리스크 온" : mScore <= -2 ? "리스크 오프" : "중립";

  const body = {
    asOf: new Date().toISOString(),
    market: { label: marketLabel, score: mScore, items: items.filter((i) => i.value || i.note) },
    stocks,
    watch,
  };
  cache = { t: Date.now(), body };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" },
  });
}
