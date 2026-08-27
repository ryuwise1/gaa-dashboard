import { NextRequest, NextResponse } from "next/server";
import { HOLDINGS } from "@/lib/portfolio";
import krEventsJson from "@/data/kr-events.json";
import { koMacro } from "@/lib/macro-dict";

export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/**
 * 이번 주 경제 캘린더.
 * - 매크로: ForexFactory 주간 JSON (무료 공개 피드, 이번 주 분량만 제공)
 * - 어닝: Nasdaq 공식 캘린더 API (날짜별 전 종목 + 시총·EPS 컨센서스)
 * 한국 지표는 두 피드 모두 없다 — 미국 중심 캘린더라는 한계는 화면에 명시한다.
 */

export interface MacroEvent {
  /** KST 기준 ISO */
  time: string;
  country: string;
  title: string;
  /** 사전에서 찾은 한글명 — 없으면 영문 그대로 노출 */
  ko: string | null;
  /** 왜 중요한지 한 줄 (툴팁) */
  desc: string | null;
  impact: "High" | "Medium";
  forecast: string;
  previous: string;
  /** 발표가 끝난 이벤트의 실제치 (Nasdaq economic events) */
  actual?: string;
  verdict?: "상회" | "부합" | "하회";
}

export interface EarningsEvent {
  symbol: string;
  name: string;
  /** "장전" | "장후" | "" */
  when: string;
  marketCapUsd: number;
  epsForecast: string;
  /** 우리 보유 종목 여부 */
  held: boolean;
  /** 어느 섹터 맥락에서 중요한지 */
  tag: string;
  /** 발표가 끝난 어닝의 실제 EPS와 서프라이즈 % */
  epsActual?: number;
  surprisePct?: number | null;
}

interface CalDay {
  date: string; // KST YYYY-MM-DD
  macro: MacroEvent[];
  earnings: EarningsEvent[];
}

/* 주간(기본)과 월간을 키로 나눠 캐시한다.
   실제치(발표 결과)가 붙기 시작하면서 6시간은 너무 길어 30분으로 줄였다. */
const cacheMap = new Map<string, { t: number; days: CalDay[] }>();
const TTL_MS = 30 * 60_000;

/* 미·영·일·유로존(독일 포함)·중국만. FF는 독일 지표를 EUR로 묶어 준다.
   중국은 코스피·반도체 수요 직결이라 남기고, 호주·캐나다·스위스·뉴질랜드는
   우리 포트와 접점이 없어 뺀다. 한국은 피드에 없어 kr-events.json으로 넣는다. */
const COUNTRY: Record<string, string> = {
  USD: "미국", EUR: "유로존", GBP: "영국", JPY: "일본", CNY: "중국",
};

const kstDate = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);

async function fetchMacro(): Promise<MacroEvent[]> {
  const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
    headers: { "User-Agent": UA },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as {
    title: string; country: string; date: string; impact: string;
    forecast: string; previous: string;
  }[];
  return raw
    // High는 전 통화, Medium은 미국만 — 소음을 줄인다
    .filter((e) => e.impact === "High" || (e.impact === "Medium" && e.country === "USD"))
    .filter((e) => COUNTRY[e.country])
    .map((e) => {
      const k = koMacro(e.title);
      return {
        time: e.date,
        country: COUNTRY[e.country],
        title: e.title,
        ko: k?.ko ?? null,
        desc: k?.desc ?? null,
        impact: e.impact as "High" | "Medium",
        forecast: e.forecast ?? "",
        previous: e.previous ?? "",
      };
    });
}

/**
 * 보유 섹터에 직접 물리는 어닝 관심 종목.
 * AI CapEx·메모리 → 반도체 밸류체인, 에너지 → 메이저·유전서비스, 금리 → 대형은행.
 * 여기 없어도 시총 $500B 이상이면 시장 전체 이벤트로 보고 포함한다.
 */
const RELEVANT_TAG: Record<string, string> = {};
for (const t of ["NVDA", "TSM", "AVGO", "AMD", "MU", "ASML", "AMAT", "LRCX", "KLAC", "MRVL", "ARM", "SMCI", "WDC"])
  RELEVANT_TAG[t] = "반도체·AI";
for (const t of ["GOOGL", "GOOG", "AMZN", "ORCL"]) RELEVANT_TAG[t] = "빅테크·AI CapEx";
for (const t of ["BP", "COP", "SLB", "OXY"]) RELEVANT_TAG[t] = "에너지";
for (const t of ["JPM", "BAC", "WFC", "GS", "MS", "C"]) RELEVANT_TAG[t] = "금융";
const RELEVANT = new Set(Object.keys(RELEVANT_TAG));

async function fetchEarnings(date: string): Promise<EarningsEvent[]> {
  const res = await fetch(`https://api.nasdaq.com/api/calendar/earnings?date=${date}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows: {
    symbol: string; name: string; time: string; marketCap: string; epsForecast: string;
  }[] = json?.data?.rows ?? [];

  const heldSector = new Map(HOLDINGS.positions.map((p) => [p.ticker, p.sector]));
  return rows
    .map((r) => {
      const held = heldSector.has(r.symbol);
      return {
        symbol: r.symbol,
        name: (r.name ?? "").replace(/,? (Inc|Corp|Corporation|Ltd|plc|Co)\.?$/i, ""),
        when: r.time === "time-pre-market" ? "장전" : r.time === "time-after-hours" ? "장후" : "",
        marketCapUsd: Number((r.marketCap ?? "").replace(/[$,]/g, "")) || 0,
        epsForecast: r.epsForecast ?? "",
        held,
        // 어느 섹터 맥락에서 봐야 하는지 — 보유면 우리 섹터명 그대로
        tag: held ? `보유 · ${heldSector.get(r.symbol)}` : RELEVANT_TAG[r.symbol] ?? "초대형주",
      };
    })
    // 보유 종목 + 우리 섹터에 직접 물리는 종목 + 초대형주(시장 전체 이벤트)만
    .filter((e) => e.held || RELEVANT.has(e.symbol) || e.marketCapUsd >= 500e9)
    .sort((a, b) => Number(b.held) - Number(a.held) || b.marketCapUsd - a.marketCapUsd)
    .slice(0, 8);
}

/* ── 발표가 끝난 이벤트의 실제치 ─────────────────────────────
   매크로: Nasdaq economic events (actual·consensus·previous 제공)
   어닝: Nasdaq earnings-surprise (실제 EPS·서프라이즈 %)
   FF 피드에는 실제치가 없어 이름·국가 매칭으로 붙인다. 못 찾으면 조용히 생략. */

interface EcoRow { country: string; eventName: string; actual: string; consensus: string; previous: string }

const NQ_COUNTRY: Record<string, string[]> = {
  "미국": ["United States"],
  "유로존": ["Euro Zone", "European Union", "Germany", "France", "Italy", "Spain"],
  "영국": ["United Kingdom"],
  "일본": ["Japan"],
  "중국": ["China"],
};

const normTitle = (s: string) =>
  s.toLowerCase().replace(/\b(m\/m|q\/q|y\/y|mom|qoq|yoy)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const tokensOf = (s: string) => new Set(normTitle(s).split(" ").filter(Boolean));
const isSubset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

/** "0.3%" "224K" "$48.2B" "-2.0%" → 숫자. K/M/B 배수 반영 */
function parseNum(s: string): number | null {
  const m = (s ?? "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let v = parseFloat(m[0]);
  if (/\d\s*[bB]\b/.test(s)) v *= 1e9;
  else if (/\d\s*[mM]\b/.test(s)) v *= 1e6;
  else if (/\d\s*[kK]\b/.test(s)) v *= 1e3;
  return v;
}

async function fetchEcoActuals(date: string): Promise<EcoRow[]> {
  const res = await fetch(`https://api.nasdaq.com/api/calendar/economicevents?date=${date}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data?.rows ?? []) as EcoRow[];
}

interface EpsRow { dateReported: string; eps: number; cons: number | null; pct: number | null }

/* 야후 quoteSummary는 발표 몇 시간 안에 실제 EPS가 실린다 (낫닥 서프라이즈 테이블은 하루 이상 지연).
   crumb 인증이 필요해서 쿠키+crumb을 받아 1시간 재사용한다. */
let yCred: { cookie: string; crumb: string; t: number } | null = null;
async function yahooCred(): Promise<{ cookie: string; crumb: string } | null> {
  if (yCred && Date.now() - yCred.t < 60 * 60_000) return yCred;
  try {
    const r1 = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual", cache: "no-store" });
    const hs = r1.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies = hs.getSetCookie?.() ?? (r1.headers.get("set-cookie") ? [r1.headers.get("set-cookie")!] : []);
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
    if (!cookie) return null;
    const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie }, cache: "no-store",
    });
    const crumb = (await r2.text()).trim();
    if (!r2.ok || !crumb || crumb.includes("<")) return null;
    yCred = { cookie, crumb, t: Date.now() };
    return yCred;
  } catch { return null; }
}

async function fetchYahooEarnings(symbol: string): Promise<EpsRow[]> {
  const cred = await yahooCred();
  if (!cred) return [];
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=earnings&crumb=${encodeURIComponent(cred.crumb)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cred.cookie }, cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  interface YQ { actual?: { raw?: unknown }; estimate?: { raw?: unknown }; surprisePct?: string; reportedDate?: { fmt?: string } }
  const q: YQ[] = json?.quoteSummary?.result?.[0]?.earnings?.earningsChart?.quarterly ?? [];
  return q
    .filter((r) => typeof r?.actual?.raw === "number" && r?.reportedDate?.fmt)
    .map((r) => ({
      dateReported: r.reportedDate!.fmt!,
      eps: r.actual!.raw as number,
      cons: typeof r?.estimate?.raw === "number" ? (r.estimate.raw as number) : null,
      pct: r.surprisePct != null ? parseFloat(r.surprisePct) : null,
    }));
}

async function fetchEpsSurprise(symbol: string): Promise<EpsRow[]> {
  const res = await fetch(`https://api.nasdaq.com/api/company/${encodeURIComponent(symbol)}/earnings-surprise`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = await res.json();
  const rows: { dateReported: string; eps: unknown; consensusForecast: string; percentageSurprise: string }[] =
    json?.data?.earningsSurpriseTable?.rows ?? [];
  return rows.map((r) => ({
    dateReported: r.dateReported,
    eps: Number(r.eps),
    cons: parseNum(r.consensusForecast ?? ""),
    pct: parseNum(r.percentageSurprise ?? ""),
  }));
}

async function attachActuals(days: CalDay[]): Promise<void> {
  const nowMs = Date.now();
  // ── 매크로 실제치
  try {
    const etDateOf = (iso: string) =>
      new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(iso));
    const plus1 = (d: string) => new Date(Date.parse(d + "T12:00:00Z") + 86400_000).toISOString().slice(0, 10);
    const past = days.flatMap((d) => d.macro)
      .filter((m) => Date.parse(m.time) < nowMs && (NQ_COUNTRY[m.country] || m.country === "한국"));
    // 낫닥은 발표일보다 하루 뒤 날짜에 싣는 경우가 많다 — 당일과 다음날을 합쳐 매칭
    const etDates = [...new Set(past.flatMap((m) => [etDateOf(m.time), plus1(etDateOf(m.time))]))].sort().slice(-14);
    const ecoByDate = new Map<string, EcoRow[]>();
    await Promise.all(etDates.map(async (d) => ecoByDate.set(d, await fetchEcoActuals(d).catch(() => []))));
    for (const m of past) {
      const et = etDateOf(m.time);
      const rows = [...(ecoByDate.get(et) ?? []), ...(ecoByDate.get(plus1(et)) ?? [])];
      // 한국 이벤트(금통위)는 한글 제목이라 이름 매칭이 안 된다 — 기준금리만 특례로
      if (m.country === "한국") {
        if (/금통위|기준금리/.test(m.title)) {
          const r = rows.find((x) => x.country === "South Korea" && /interest rate decision/i.test(x.eventName) && (x.actual ?? "").trim());
          if (r) {
            m.actual = r.actual.trim();
            const a = parseNum(r.actual), p = parseNum(r.previous ?? "");
            if (a != null && p != null) m.verdict = a > p ? "상회" : a < p ? "하회" : "부합";
          }
        }
        continue;
      }
      const countries = NQ_COUNTRY[m.country];
      const tks = tokensOf(m.title);
      const cands = rows
        .filter((r) => countries.includes(r.country) && (r.actual ?? "").trim())
        .filter((r) => { const rt = tokensOf(r.eventName); return isSubset(tks, rt) || isSubset(rt, tks); });
      if (!cands.length) continue;
      // 같은 이름이 여럿(q/q vs y/y)이면 컨센서스가 우리 예상치와 가장 가까운 행으로
      let best = cands[0];
      const f = parseNum(m.forecast);
      if (cands.length > 1 && f != null) {
        best = cands.reduce((p, c) => {
          const pd = parseNum(p.consensus ?? "") == null ? Infinity : Math.abs(parseNum(p.consensus)! - f);
          const cd = parseNum(c.consensus ?? "") == null ? Infinity : Math.abs(parseNum(c.consensus)! - f);
          return cd < pd ? c : p;
        });
      }
      m.actual = best.actual.trim();
      const a = parseNum(best.actual);
      const ref = f ?? parseNum(best.consensus ?? "");
      if (a != null && ref != null) m.verdict = a > ref ? "상회" : a < ref ? "하회" : "부합";
    }
  } catch { /* 실제치는 부가 정보 — 실패해도 캘린더는 그대로 */ }

  // ── 어닝 실제치
  try {
    const todayKst = kstDate(new Date());
    const past = days.filter((d) => d.date <= todayKst).flatMap((d) => d.earnings.map((e) => ({ date: d.date, e })));
    if (!past.length) return;
    const symbols = [...new Set(
      past.sort((a, b) => Number(b.e.held) - Number(a.e.held)).map((x) => x.e.symbol)
    )].slice(0, 15);
    const bySym = new Map<string, EpsRow[]>();
    await Promise.all(symbols.map(async (s) => {
      // 야후 우선 (발표 당일 반영) → 비면 낫닥 서프라이즈 폴백
      let rows = await fetchYahooEarnings(s).catch(() => [] as EpsRow[]);
      if (!rows.length) rows = await fetchEpsSurprise(s).catch(() => [] as EpsRow[]);
      bySym.set(s, rows);
    }));
    for (const { date, e } of past) {
      const rows = bySym.get(e.symbol) ?? [];
      const evMs = Date.parse(date);
      const hit = rows.find((r) => {
        const t = Date.parse(r.dateReported);
        return Number.isFinite(t) && Math.abs(t - evMs) < 6 * 86400_000;
      });
      if (!hit || !Number.isFinite(hit.eps)) continue;
      e.epsActual = hit.eps;
      e.surprisePct = hit.pct ?? (hit.cons ? +(((hit.eps - hit.cons) / Math.abs(hit.cons)) * 100).toFixed(1) : null);
    }
  } catch { /* 동일 — 조용히 생략 */ }
}

export async function GET(req: NextRequest) {
  // ?month=YYYY-MM 이면 그 달 전체(어닝+한국 일정), 없으면 이번 주
  const month = req.nextUrl.searchParams.get("month");
  const key = month && /^\d{4}-\d{2}$/.test(month) ? month : "week";
  const hit = cacheMap.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) {
    return NextResponse.json({ days: hit.days });
  }

  const dates: string[] = [];
  if (key === "week") {
    // 오늘부터 7일 — 어닝은 날짜별 호출, 주말은 건너뛴다 (미국 동부 기준 날짜)
    for (let i = 0; i < 8; i++) {
      const d = new Date(Date.now() + i * 86400_000 - 13 * 3600_000); // 대략 ET
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      dates.push(d.toISOString().slice(0, 10));
    }
  } else {
    // 그 달의 평일 전부
    const [y, m] = key.split("-").map(Number);
    for (let day = 1; day <= 31; day++) {
      const d = new Date(Date.UTC(y, m - 1, day));
      if (d.getUTCMonth() !== m - 1) break;
      const wd = d.getUTCDay();
      if (wd === 0 || wd === 6) continue;
      dates.push(d.toISOString().slice(0, 10));
    }
  }

  const [macro, ...earningsByDate] = await Promise.all([
    fetchMacro().catch(() => [] as MacroEvent[]),
    ...dates.map((d) => fetchEarnings(d).catch(() => [] as EarningsEvent[])),
  ]);

  // KST 날짜로 묶는다 (매크로는 발표 시각을 KST로 환산해 해당 날짜에)
  const byDay = new Map<string, CalDay>();
  const dayOf = (key: string) => {
    let d = byDay.get(key);
    if (!d) { d = { date: key, macro: [], earnings: [] }; byDay.set(key, d); }
    return d;
  };
  for (const m of macro) {
    const key = kstDate(new Date(m.time));
    dayOf(key).macro.push(m);
  }
  // 한국 확정 일정 (금통위·수출입동향) — 표시 범위 안의 것만
  const windowStart = key === "week" ? kstDate(new Date()) : dates[0] ?? "";
  const windowEnd = dates[dates.length - 1] ?? "";
  for (const k of (krEventsJson as { events: { date: string; time: string; title: string }[] }).events) {
    if (k.date < windowStart || (windowEnd && k.date > windowEnd)) continue;
    dayOf(k.date).macro.push({
      time: k.date + "T" + k.time + ":00+09:00",
      country: "한국",
      title: k.title,
      ko: null, // 이미 한글
      desc: (k as { note?: string }).note || null,
      impact: "High",
      forecast: "",
      previous: "",
    });
  }
  // 시간순 정렬
  for (const d of byDay.values()) d.macro.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  // 어닝의 "장후"는 KST로 다음날 새벽이지만, 관례상 미국 날짜 그대로 묶는다
  dates.forEach((d, i) => {
    for (const e of earningsByDate[i]) dayOf(d).earnings.push(e);
  });

  const days = [...byDay.values()]
    .filter((d) => d.macro.length || d.earnings.length)
    // 월간 모드에선 주간 매크로 피드가 달 경계 밖 날짜를 끌고 올 수 있어 잘라낸다
    .filter((d) => key === "week" || d.date.startsWith(key))
    .sort((a, b) => a.date.localeCompare(b.date));

  // 발표가 끝난 이벤트엔 실제치·서프라이즈를 붙인다
  await attachActuals(days);

  if (days.length) cacheMap.set(key, { t: Date.now(), days });
  return NextResponse.json(
    { days },
    { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=3600" } }
  );
}
