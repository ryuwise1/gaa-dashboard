"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Donut, { type DonutSegment } from "@/components/Donut";
import {
  HOLDINGS, SECTOR_ORDER, buildHoldingRows, buildTotals, fmtKrw, fmtKrwShort, fmtLocalDelta, fmtLocalPrice,
  fmtMoney, fmtPct, fmtSignedKrw, fmtSignedMoney, fmtSignedUsd, fmtUsd,
  sectorColorVar, symbolsToFetch, tickerColorVar,
  type HoldingRow, type QuoteMap, type Unit,
} from "@/lib/portfolio";
import { marketOfCurrency, marketStatus, type MarketStatus } from "@/lib/market";
import { MACRO_SYMBOLS } from "@/lib/macro";
import { AUM_USD, OPENING_DATE, TRADES, cashUsd, fmtTradeDate, investedUsd, openingOf, tradesOf } from "@/lib/trades";
import Logo from "@/components/Logo";
import TradeLog from "@/components/TradeLog";
import WeeklyReport from "@/components/WeeklyReport";
import MacroStrip from "@/components/MacroStrip";
import Sparkline from "@/components/Sparkline";
import TrendChart from "@/components/TrendChart";
import Calendar from "@/components/Calendar";
import MeetingNotes from "@/components/MeetingNotes";
import RangeChart from "@/components/RangeChart";
import DailySignals from "@/components/DailySignals";
import Allocation from "@/components/Allocation";
import ChangeLog from "@/components/ChangeLog";
import StoryBlock from "@/components/StoryBlock";

const REFRESH_OPEN_MS = 60_000;
const REFRESH_CLOSED_MS = 300_000;

type Tab = "보유 현황" | "매수·매도 플랜" | "AP·MP" | "매매 내역" | "오늘의 분석" | "캘린더" | "회의록" | "보유 비중";
type Figure = "현재가" | "평가금";
type Sort = "평가금액" | "수익률" | "당일";

interface BenchRow { label: string; base: number; last: number; pct: number; pctUsd?: number; }
interface HistoryPoint { date: string; totalUsd: number; benchUsd?: number | null; spxPct?: number | null; }

function deltaClass(n: number | null | undefined): string {
  if (n == null || n === 0) return "flat";
  return n > 0 ? "gain" : "loss";
}

function statusPill(status: string) {
  const cls = status === "매수중" ? "buying" : status === "매수완료" ? "done" : status === "매도" ? "sold" : "none";
  return <span className={`pill ${cls}`}>{status}</span>;
}

export default function Dashboard() {
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<"종목" | "섹터">("종목");
  const [hovered, setHovered] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("보유 현황");
  const [unit, setUnit] = useState<Unit>("KRW");
  const [figure, setFigure] = useState<Figure>("평가금");
  const [sort, setSort] = useState<Sort>("평가금액");
  const [bench, setBench] = useState<BenchRow[]>([]);
  // 플랜 탭에서 행을 누르면 그 종목의 매수 근거(why)가 펼쳐진다
  const [planWhy, setPlanWhy] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  // 팀 전용 모드 — 회의록 탭과 주간보고 초안이 여기 묶인다.
  // ?team(또는 기존 ?report)으로 한 번 들어오면 이 브라우저에 저장돼 계속 보인다.
  // 선배들께 보내는 기본 주소에서는 존재 자체가 안 보인다.
  const [teamMode, setTeamMode] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has("team") || q.has("report")) {
      localStorage.setItem("gaa-team", "on");
      setTeamMode(true);
    } else {
      setTeamMode(localStorage.getItem("gaa-team") === "on");
    }
  }, []);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [now, setNow] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 저장된 표시 설정 반영 — 없으면 기본값 (라이트 / 원화 / 평가금 / 보유 현황)
  useEffect(() => {
    const saved = localStorage.getItem("gaa-theme");
    setTheme(saved === "dark" ? "dark" : "light");
    const u = localStorage.getItem("gaa-unit");
    if (u === "USD") setUnit("USD");
    const fg = localStorage.getItem("gaa-figure");
    if (fg === "현재가") setFigure("현재가");
    const t = localStorage.getItem("gaa-tab");
    // 캘린더는 팀 전용이라 복원 시 팀 모드 여부를 함께 본다
    const team = localStorage.getItem("gaa-team") === "on" || /[?&](team|report)\b/.test(location.search);
    if (t === "매수·매도 플랜" || t === "매매 내역" || (t === "캘린더" && team)) setTab(t);
  }, []);
  const pickUnit = (u: Unit) => { setUnit(u); localStorage.setItem("gaa-unit", u); };
  const pickFigure = (fg: Figure) => { setFigure(fg); localStorage.setItem("gaa-figure", fg); };
  const pickTab = (t: Tab) => { setTab(t); localStorage.setItem("gaa-tab", t); };

  // 보유 비중 탭은 모바일 전용 — 데스크톱 폭이 되면 보유 현황으로 돌려보낸다
  useEffect(() => {
    const mq = matchMedia("(min-width: 900px)");
    const fix = () => { if (mq.matches) setTab((c) => (c === "보유 비중" ? "보유 현황" : c)); };
    fix();
    mq.addEventListener("change", fix);
    return () => mq.removeEventListener("change", fix);
  }, []);

  // 벤치마크·총자산 추이 — 일 단위 데이터라 마운트 때 한 번만
  useEffect(() => {
    fetch("/api/bench")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.rows) setBench(d.rows); })
      .catch(() => {});
    fetch("/api/history")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.points?.length >= 2) setHistory(d.points); })
      .catch(() => {});
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("gaa-theme", next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // KRW=X는 환산용·지표용으로 양쪽에 들어 있다 — 중복 요청을 막는다
      const wanted = [...new Set([...symbolsToFetch(), ...MACRO_SYMBOLS])];
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(wanted.join(","))}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setQuotes(data.quotes ?? {});
      setFetchedAt(data.fetchedAt ?? Date.now());
      setError(null);
    } catch {
      setError("시세를 불러오지 못했습니다. 잠시 후 자동으로 다시 시도합니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const markets: MarketStatus[] | null = useMemo(
    () => (now ? [marketStatus("KR", now), marketStatus("US", now)] : null),
    [now]
  );
  const anyOpen = markets?.some((m) => m.open) ?? true;
  const marketOpenFor = (currency: string) =>
    markets?.find((m) => m.code === marketOfCurrency(currency))?.open ?? true;

  useEffect(() => {
    load();
    const interval = anyOpen ? REFRESH_OPEN_MS : REFRESH_CLOSED_MS;
    timerRef.current = setInterval(load, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible" && fetchedAt && Date.now() - fetchedAt > interval) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, anyOpen]);

  const rows = useMemo(() => buildHoldingRows(quotes), [quotes]);
  const totals = useMemo(() => buildTotals(rows, quotes), [rows, quotes]);
  const hasLive = rows.some((r) => r.live);
  // 환율이 아직 안 온 종목은 valueUsd가 null이라 합계·비중에서 통째로 빠진다.
  // 로딩 중 잠깐이지만 그동안 비중이 실제보다 부풀어 보이므로 그 사실을 드러낸다.
  const pending = rows.filter((r) => r.valueUsd == null);
  const fx = totals.usdkrw;
  const money = (usd: number | null) => fmtMoney(usd, unit, fx);
  const signed = (usd: number | null) => fmtSignedMoney(usd, unit, fx);
  // 기준 통화는 항상 달러다. 원가가 체결 시점 환율로 굳어 있으므로
  // 국내주식은 달러 손익에 환차손익이 이미 포함돼 있고,
  // ₩/$ 토글은 그 달러 값을 오늘 환율로 바꿔 보여주는 표시 변환일 뿐이다.
  /**
   * 표시 통화가 그 종목을 실제로 매수한 통화와 같으면 환전이 개입하지 않은 값을 보여준다.
   * 원화 모드의 국내주식이 여기 해당 — 환차손익이 빠진 순수 주가 수익률이다.
   * (토스에서 원화 보유자의 국내주식이 원·달러 토글과 무관하게 같은 수익률인 것과 동일한 규칙)
   * 그 외에는 기준통화인 달러 손익을 쓰고, 원화 모드면 오늘 환율로 환산만 한다.
   */
  const nativeKrw = (r: HoldingRow) => unit === "KRW" && r.currency === "KRW" && r.pnlKrw != null;
  const pctOf = (r: HoldingRow) => (nativeKrw(r) ? r.pnlPctKrw : r.pnlPct);
  const pnlText = (r: HoldingRow) => (nativeKrw(r) ? fmtSignedKrw(r.pnlKrw) : signed(r.pnlUsd));
  const hasPnl = (r: HoldingRow) => (nativeKrw(r) ? r.pnlKrw != null : r.pnlUsd != null);
  const totalPnl = totals.pnlUsd;
  const totalPct = totals.pnlPct;
  const showSigned = (v: number | null) => signed(v);

  const segments: DonutSegment[] = useMemo(() => {
    if (group === "종목") {
      return rows
        .filter((r) => (r.valueUsd ?? 0) > 0)
        .map((r, i) => ({
          key: r.ticker, label: r.name, value: r.valueUsd!,
          pct: r.weight ?? 0, color: tickerColorVar(r.ticker, i),
        }));
    }
    const bySector = new Map<string, number>();
    for (const r of rows) {
      if ((r.valueUsd ?? 0) > 0) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + r.valueUsd!);
    }
    const total = [...bySector.values()].reduce((s, v) => s + v, 0);
    return SECTOR_ORDER.filter((s) => bySector.has(s)).map((s) => ({
      key: s, label: s, value: bySector.get(s)!,
      pct: total > 0 ? bySector.get(s)! / total : 0, color: sectorColorVar(s),
    }));
  }, [rows, group]);

  /** 스크린샷처럼 국내주식 / 해외주식으로 묶고, 선택한 기준으로 그룹 안을 정렬한다 */
  const marketGroups = useMemo(() => {
    const by: Record<Sort, (a: HoldingRow, b: HoldingRow) => number> = {
      평가금액: (a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0),
      수익률: (a, b) => (b.pnlPct ?? -Infinity) - (a.pnlPct ?? -Infinity),
      당일: (a, b) => (b.dayPct ?? -Infinity) - (a.dayPct ?? -Infinity),
    };
    const kr = rows.filter((r) => r.currency === "KRW").sort(by[sort]);
    const ov = rows.filter((r) => r.currency !== "KRW").sort(by[sort]);
    // 환차손익 — 국내주식 묶음에만 작게 표시. 원화 강세면 익, 약세면 손.
    const fxKr = kr.some((r) => r.fxUsd != null) ? kr.reduce((s, r) => s + (r.fxUsd ?? 0), 0) : null;
    const wCost = kr.reduce((s, r) => s + (r.buyKrwPerUsd != null ? r.costUsd ?? 0 : 0), 0);
    const buyRate = wCost > 0
      ? kr.reduce((s, r) => s + (r.buyKrwPerUsd ?? 0) * (r.costUsd ?? 0), 0) / wCost
      : null;
    return [
      { title: "국내주식", items: kr, note: "달러 → 원화 환전 후 매수", fxUsd: fxKr, buyRate },
      { title: "해외주식", items: ov, note: "달러로 직접 매수 (환전 없음)", fxUsd: null, buyRate: null },
    ].filter((g) => g.items.length > 0);
  }, [rows, sort]);

  const planBySector = useMemo(() => {
    const costBy = new Map<string, number>();
    for (const r of rows) costBy.set(r.ticker, r.costUsd ?? 0);
    return SECTOR_ORDER.map((sector) => {
      // 목표 0 = 플랜에서 제외된 종목(교체·정리된 자리). 진행바에 0%로 남기지 않는다.
      const positions = HOLDINGS.positions.filter((p) => p.sector === sector && p.targetUsd > 0);
      if (positions.length === 0) return null;
      return {
        sector,
        positions,
        targetSum: positions.reduce((s, p) => s + p.targetUsd, 0),
        boughtSum: positions.reduce((s, p) => s + (costBy.get(p.ticker) ?? 0), 0),
      };
    }).filter(Boolean) as { sector: string; positions: typeof HOLDINGS.positions; targetSum: number; boughtSum: number }[];
  }, [rows]);

  const deployedPct = Math.min(investedUsd / AUM_USD, 1);
  const totalAssetUsd = totals.valueUsd + cashUsd;

  const updatedText = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    : null;

  // 시세 기준 시각 + 장 상태 — 목록 아래가 아니라 머리말에 둔다
  // 장 상태는 상단 지표줄이 이미 말하고 있으므로 시각만
  const quoteNote = !hasLive ? "시세 불러오는 중 — 평단가 기준" : `시세 ${updatedText ?? ""} 기준`;

  // 보유 비중은 모바일 전용 탭 — 데스크톱에선 왼쪽 열에 상주하므로 버튼을 숨긴다.
  // 공개판(선배 공지용)은 열람 화면만: 보유 현황·플랜·매매 내역·비중.
  // 캘린더(담당자 표 생성기 포함)·회의록·주간보고는 팀 관리 도구라 팀 모드 전용.
  const TABS: Tab[] = [
    "보유 현황", "매수·매도 플랜", "AP·MP", "매매 내역",
    ...(teamMode ? (["오늘의 분석", "캘린더", "회의록"] as Tab[]) : []),
    "보유 비중",
  ];
  const tabCount: Record<Tab, string> = {
    "보유 현황": `${rows.length}`,
    "매수·매도 플랜": `${HOLDINGS.positions.filter((p) => p.targetUsd > 0).length}`,
    "AP·MP": "",
    "매매 내역": `${TRADES.length}`,
    "오늘의 분석": "",
    "캘린더": "",
    "회의록": "",
    "보유 비중": `${segments.length}`,
  };

  // 보유 비중 — 데스크톱은 왼쪽 열, 모바일은 전용 탭에서 같은 것을 보여준다
  const donutSection = (
      <section className="section" aria-label="보유 비중">
        <div className="section-head">
          <h2>보유 비중</h2>
          <div className="seg" role="group" aria-label="비중 묶기 기준">
            {(["종목", "섹터"] as const).map((g) => (
              <button key={g} aria-pressed={group === g} onClick={() => { setGroup(g); setHovered(null); }}>
                {g}별
              </button>
            ))}
          </div>
        </div>
        <div className="donut-wrap">
          <Donut
            segments={segments}
            hovered={hovered}
            onHover={setHovered}
            centerLabel={pending.length > 0 ? `총 보유 (${pending.length}종목 대기)` : "총 보유"}
            centerValue={money(totals.valueUsd)}
          />
        </div>
        <div className="legend">
          {(group === "종목" && !legendOpen ? segments.slice(0, 8) : segments).map((s) => (
            <div
              key={s.key}
              className="legend-row"
              data-active={hovered === s.key}
              onMouseEnter={() => setHovered(s.key)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="legend-dot" style={{ background: s.color }} />
              <span className="legend-name">
                {s.label}
                {group === "종목" && <span className="tk">{s.key}</span>}
              </span>
              <span className="legend-val num">{money(s.value)}</span>
              <span className="legend-pct num">{(s.pct * 100).toFixed(1)}%</span>
            </div>
          ))}
          {group === "종목" && segments.length > 8 && (
            <button className="legend-more num" onClick={() => setLegendOpen((v) => !v)} aria-expanded={legendOpen}>
              {legendOpen
                ? "접기 ▴"
                : `외 ${segments.length - 8}종목 ${(segments.slice(8).reduce((t, x) => t + x.pct, 0) * 100).toFixed(1)}% ▾`}
            </button>
          )}
        </div>

        {/* 수익 기여 순위 — 누가 벌어다 줬고 누가 까먹었나 (달러 손익, 상위 3 + 하위 2) */}
        {hasLive && (() => {
          const ranked = rows.filter((r) => r.pnlUsd != null && r.pnlUsd !== 0)
            .sort((a, b) => (b.pnlUsd ?? 0) - (a.pnlUsd ?? 0));
          if (ranked.length < 2) return null;
          const show = [...ranked.slice(0, 3), ...ranked.slice(-2)]
            .filter((r, i, arr) => arr.findIndex((x) => x.ticker === r.ticker) === i);
          const maxAbs = Math.max(...ranked.map((x) => Math.abs(x.pnlUsd ?? 0)), 1);
          return (
            <div className="contrib">
              <div className="contrib-head">수익 기여 순위</div>
              {show.map((r) => (
                <div key={r.ticker} className="contrib-row num">
                  <span className="n">{r.name}</span>
                  <span className="cbar" aria-hidden>
                    <i
                      data-neg={(r.pnlUsd ?? 0) < 0}
                      style={{ width: `${(Math.abs(r.pnlUsd ?? 0) / maxAbs) * 100}%` }}
                    />
                  </span>
                  <span className={`v ${deltaClass(r.pnlUsd)}`}>{signed(r.pnlUsd)}</span>
                </div>
              ))}
            </div>
          );
        })()}
      </section>
  );

  return (
    <div className="wrap">
      <header className="topbar">
        <h1>
          자산운용팀
          <span className="team-glyph">GLIF 26-2</span>
          {teamMode && (
            <button
              className="team-chip"
              title="팀 관리 모드 — 캘린더·회의록·주간보고가 보여요. 누르면 공개판으로 전환 (다시 켜려면 ?team)"
              onClick={() => {
                if (confirm("공개판(선배 공지용) 화면으로 전환할까요?\n다시 팀 모드로 돌아오려면 주소 뒤에 ?team 을 붙여 접속하면 됩니다.")) {
                  localStorage.removeItem("gaa-team");
                  setTeamMode(false);
                  setTab((c) => (c === "캘린더" || c === "회의록" ? "보유 현황" : c));
                }
              }}
            >
              TEAM
            </button>
          )}
        </h1>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="표기 통화">
            {(["KRW", "USD"] as const).map((u) => (
              <button key={u} aria-pressed={unit === u} onClick={() => pickUnit(u)}>
                {u === "KRW" ? "원" : "$"}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={toggleTheme} aria-label={theme === "dark" ? "라이트 모드로" : "다크 모드로"} title={theme === "dark" ? "라이트 모드" : "다크 모드"}>
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <button className="icon-btn" onClick={load} disabled={loading} aria-label="시세 새로고침">
            <span className={loading ? "spin" : undefined} aria-hidden>⟳</span>
          </button>
        </div>
      </header>

      {/* 정체성·면책 — 처음 링크 받은 사람이 3초 안에 맥락을 잡게 */}
      <p className="site-intro">
        성균관대학교 금융투자학회 GLIF 26-2 자산운용팀의 모의운용 대시보드입니다.
        AUM $500,000은 가상 자금이며, 시세는 거래소에 따라 지연될 수 있습니다.
      </p>

      {error && <p className="err" role="alert">{error}</p>}

      <MacroStrip quotes={quotes} markets={markets} />

      <div className="grid">
        <div className="col-side">
          <section className="summary" aria-label="자산 요약">
            <div className="sum-label">내 투자</div>
            <div className="sum-total num">
              {hasLive ? fmtUsd(totals.valueUsd) : "—"}
            </div>
            <div className={`sum-delta num ${deltaClass(totalPnl)}`}>
              {fmtSignedUsd(totalPnl)}
              <span className="sub">({fmtPct(totalPct)})</span>
            </div>
            {/* 이름+수치는 한 덩어리로 — 줄이 바뀌어도 "S&P 500 / +4.6%"처럼 짝이 갈라지지 않게 */}
            {bench.length > 0 && hasLive && (
              <p className="bench num" title="7/30 운용 시작 직전 종가 대비 지수 등락">
                <span className="bench-lead">운용 시작 후</span>
                {bench.map((b) => (
                  <span key={b.label} className="bench-item">
                    {b.label} <b className={deltaClass(b.pct)}>{fmtPct(b.pct, 1)}</b>
                  </span>
                ))}
                <span className="bench-item me">
                  자산운용팀 <b className={deltaClass(totalPct)}>{fmtPct(totalPct, 1)}</b>
                </span>
              </p>
            )}
            {pending.length > 0 && (
              <p className="pending-note">
                {pending.map((r) => r.ticker).join(", ")} 환율 대기 중 — 합계·비중에서 제외되어 있습니다
              </p>
            )}

            <div className="sum-cards">
              <div className="sum-card">
                <div className="k">현금</div>
                <div className="v num">{fmtUsd(cashUsd)}</div>
                <div className="s num">AUM 대비 {((cashUsd / AUM_USD) * 100).toFixed(1)}%</div>
              </div>
              <div className="sum-card">
                <div className="k">오늘 변동</div>
                <div className={`v num ${deltaClass(totals.dayPct)}`}>
                  {hasLive && totals.dayPct != null ? fmtPct(totals.dayPct) : "—"}
                </div>
                <div className={`s num ${deltaClass(totals.dayUsd)}`}>
                  {hasLive ? fmtSignedUsd(totals.dayUsd) : "시세 대기 중"}
                </div>
              </div>
            </div>

            <div className="budget">
              <div className="budget-top">
                <span>운용 예산 <b className="num">{fmtUsd(AUM_USD)}</b>
                  {fx && <span className="approx num"> ≈ {fmtKrwShort(AUM_USD * fx)}</span>}
                </span>
                <span className="num"><b>{(deployedPct * 100).toFixed(1)}%</b> 집행</span>
              </div>
              <div
                className="budget-bar"
                role="progressbar"
                aria-valuenow={Math.round(deployedPct * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="운용 예산 집행률"
              >
                <i className="done" style={{ width: `${deployedPct * 100}%` }} />
              </div>
              <div className="budget-legend num">
                <span><i className="done" style={{ background: "var(--accent)" }} />투입 {fmtUsd(investedUsd)}</span>
                <span><i style={{ background: "var(--chip-bg)" }} />잔여 {fmtUsd(cashUsd)}</span>
              </div>
              <div className="budget-top" style={{ marginTop: 12, marginBottom: 0 }}>
                <span>총자산 (평가+현금)</span>
                <span className="num"><b>{hasLive ? fmtUsd(totalAssetUsd) : "—"}</b>
                  <span className={deltaClass(totalAssetUsd - AUM_USD)} style={{ marginLeft: 6, fontWeight: 700 }}>
                    {hasLive ? fmtPct(totalAssetUsd / AUM_USD - 1) : ""}
                  </span>
                </span>
              </div>
              {history.length >= 2 && <TrendChart points={history} base={AUM_USD} />}

              {/* 리스크 지표 — 일별 총자산에서 계산. 절대값만으론 기준이 없어 같은 기간 S&P를 옆에 병기 */}
              {history.length >= 5 && (() => {
                const stats = (vals: number[], base: number) => {
                  // 최대낙폭: 고점 대비 최대 하락
                  let peak = vals[0], mdd = 0;
                  for (const v of vals) { peak = Math.max(peak, v); mdd = Math.min(mdd, v / peak - 1); }
                  // 일별 수익률 → 연환산 변동성
                  const rets = vals.slice(1).map((v, i) => v / vals[i] - 1);
                  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
                  const vol = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)) * Math.sqrt(252);
                  // 연환산 수익률 − 무위험(미 단기채 4% 가정) / 변동성
                  const annRet = Math.pow(vals[vals.length - 1] / base, 252 / rets.length) - 1;
                  const sharpe = vol > 0 ? (annRet - 0.04) / vol : null;
                  return { mdd, vol, sharpe };
                };
                const ours = stats(history.map((p) => p.totalUsd), AUM_USD);
                // 같은 기간 S&P — spxPct(개시 직전 대비 누적 등락)로 지수 가치 시계열 복원
                const spxVals = history.filter((p) => p.spxPct != null).map((p) => 1 + p.spxPct!);
                const spx = spxVals.length >= 5 ? stats(spxVals, 1) : null;
                return (
                  <>
                    <div className="risk-row num">
                      <span>MDD <b className={ours.mdd < -0.05 ? "loss" : ""}>{(ours.mdd * 100).toFixed(1)}%</b>
                        {spx && <i className="vs">S&P {(spx.mdd * 100).toFixed(1)}%</i>}</span>
                      <span>변동성(연) <b>{(ours.vol * 100).toFixed(1)}%</b>
                        {spx && <i className="vs">S&P {(spx.vol * 100).toFixed(1)}%</i>}</span>
                      <span>샤프 <b className={ours.sharpe != null && ours.sharpe >= 1 ? "gain" : ""}>{ours.sharpe?.toFixed(2) ?? "—"}</b>
                        {spx?.sharpe != null && <i className="vs">S&P {spx.sharpe.toFixed(2)}</i>}</span>
                    </div>
                    <details className="metric-notes">
                      <summary>지표 설명</summary>
                      <div className="metric-notes-body">
                        <p><b>동일흐름</b>우리와 같은 날·같은 금액으로 S&P를 분할 매수했을 때(회색 실선) 대비. 종목 선택 성과입니다.</p>
                        <p><b>지수등락</b>개시일에 전액을 지수에 넣었을 때(점선) 대비. 현금 보유 비용까지 포함한 값입니다.</p>
                        <p><b>MDD</b>최고점 대비 최대 하락폭입니다.</p>
                        <p><b>변동성</b>하루 등락 폭의 연환산. 낮을수록 안정적입니다.</p>
                        <p><b>샤프</b>위험 대비 초과수익(무위험 4% 가정). 1 이상이면 준수하나, 운용 초기에는 연환산 탓에 과대 표시됩니다.</p>
                        <p className="foot">우리 포트는 일별 총자산, 옆의 S&P는 같은 기간 지수로 계산한 값입니다.</p>
                      </div>
                    </details>
                  </>
                );
              })()}
            </div>
          </section>

          {donutSection}
        </div>

        <div className="col-main">
          <div className="tabs" role="tablist" aria-label="포트폴리오 보기">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                data-mobile={t === "보유 비중" || undefined}
                onClick={() => pickTab(t)}
              >
                {t}
                {tabCount[t] && <span className="cnt num">{tabCount[t]}</span>}
              </button>
            ))}
          </div>

          {tab === "보유 현황" && (
            <section className="section" role="tabpanel" aria-label="보유 현황">
              <StoryBlock />
              <div className="section-head">
                <h2 className="sr-only">보유 현황</h2>
                <span className="meta num">{rows.length > 0 ? quoteNote : ""}</span>
                <label className="sort-select">
                  <span className="sr-only">정렬 기준</span>
                  <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬 기준">
                    <option value="평가금액">평가금액 높은 순</option>
                    <option value="수익률">수익률 높은 순</option>
                    <option value="당일">오늘 많이 움직인 순</option>
                  </select>
                </label>
                <div className="seg" role="group" aria-label="표시 기준">
                  {(["현재가", "평가금"] as const).map((f) => (
                    <button key={f} aria-pressed={figure === f} onClick={() => pickFigure(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {marketGroups.map((g) => (
                <div key={g.title} className="mkt-group">
                  <div className="mkt-head">
                    <span className="mkt-title">
                      {g.title}
                      <span className="mkt-note">{g.note}</span>
                    </span>
                    {g.fxUsd != null && g.buyRate != null && fx != null && (
                      <span
                        className={`mkt-fx num ${deltaClass(g.fxUsd)}`}
                        title={`매수 환율 ${g.buyRate.toFixed(1)}원 → 현재 ${fx.toFixed(1)}원. 원화가 강해지면 환차익, 약해지면 환차손입니다`}
                      >
                        환차{g.fxUsd >= 0 ? "익" : "손"} {showSigned(g.fxUsd)}
                        <span className="r">{g.buyRate.toFixed(0)}원 → {fx.toFixed(0)}원</span>
                      </span>
                    )}
                  </div>
                  <ul className="hold-list">
                    {g.items.map((r) => {
                      const hist = tradesOf(r.ticker);
                      const isOpen = expanded === r.ticker;
                      const idx = rows.indexOf(r);
                      return (
                        <Fragment key={r.ticker}>
                          <li>
                            <button
                              className="hold"
                              data-open={isOpen}
                              onClick={() => hist.length && setExpanded(isOpen ? null : r.ticker)}
                              aria-expanded={hist.length ? isOpen : undefined}
                            >
                              {figure === "현재가" && r.spark && r.spark.length >= 2 ? (
                                // 토스처럼 현재가 모드에서는 로고 대신 당일 흐름을 그린다
                                <Sparkline
                                  data={r.spark}
                                  dir={r.dayPct == null ? 0 : r.dayPct > 0 ? 1 : r.dayPct < 0 ? -1 : 0}
                                  base={r.prevClose}
                                  w={46}
                                  h={28}
                                />
                              ) : (
                                <Logo ticker={r.ticker} name={r.name} color={tickerColorVar(r.ticker, idx)} />
                              )}
                              <span className="hold-id">
                                <span className="hold-nm">
                                  {r.name}
                                  {r.currency !== "KRW" && <span className="tk-inline">{r.ticker}</span>}
                                </span>
                                <span className="hold-sub">
                                  <span className="num">
                                    {figure === "현재가"
                                      ? `내 평균 ${fmtLocalPrice(r.currency, r.avgPrice)}`
                                      : `${r.qty.toLocaleString()}주`}
                                  </span>
                                  <span className="sec-chip">
                                    <i style={{ background: sectorColorVar(r.sector) }} />
                                    {r.sector}
                                  </span>
                                </span>
                              </span>
                              <span className="hold-fig">
                                <span className="hold-main num">
                                  {figure === "현재가" ? fmtLocalPrice(r.currency, r.price) : money(r.valueUsd)}
                                </span>
                                {figure === "현재가" ? (
                                  // 당일 변동 — 장 시작 전이나 시세 대기 중엔 자리만 지킨다
                                  <span className={`hold-chg num ${deltaClass(r.dayPct)}`}>
                                    {r.dayPct != null && r.prevClose != null && r.price != null ? (
                                      <>
                                        {fmtLocalDelta(r.currency, r.price - r.prevClose)}
                                        <span className="rate"> ({fmtPct(r.dayPct)})</span>
                                        {r.over && (
                                          <span className="hold-over">
                                            <em>{r.over.label}</em> {fmtLocalPrice(r.currency, r.over.price)}
                                            <i className={deltaClass(r.over.pct)}> {fmtPct(r.over.pct)}</i>
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      "—"
                                    )}
                                  </span>
                                ) : (
                                  <span className={`hold-chg num ${deltaClass(pctOf(r))}`}>
                                    {hasPnl(r) ? (
                                      <>
                                        {pnlText(r)}
                                        <span className="rate"> ({fmtPct(pctOf(r))})</span>
                                      </>
                                    ) : (
                                      fmtPct(pctOf(r))
                                    )}
                                  </span>
                                )}
                              </span>
                              {hist.length > 0 && <span className="hold-caret" aria-hidden>›</span>}
                            </button>
                          </li>
                          {isOpen && (
                            <li>
                              <div className="hist">
                                <RangeChart
                                  symbol={HOLDINGS.positions.find((p) => p.ticker === r.ticker)?.yahoo ?? r.ticker}
                                  currency={r.currency}
                                />
                                {r.currency === "KRW" && r.fxUsd != null && r.pnlKrw != null && r.pnlUsd != null && (
                                  <div className="hist-fx">
                                    <span className="basis">
                                      <em>원화 기준</em>
                                      <b className="num">{fmtKrw(r.valueKrw)}</b>
                                      <i className={`num ${deltaClass(r.pnlPctKrw)}`}>
                                        {fmtSignedKrw(r.pnlKrw)} ({fmtPct(r.pnlPctKrw)})
                                      </i>
                                    </span>
                                    <span className="basis">
                                      <em>달러 기준</em>
                                      <b className="num">{fmtUsd(r.valueUsd)}</b>
                                      <i className={`num ${deltaClass(r.pnlPct)}`}>
                                        {fmtSignedUsd(r.pnlUsd)} ({fmtPct(r.pnlPct)})
                                      </i>
                                    </span>
                                    <span className="rr num">
                                      차이 = 환차{r.fxUsd >= 0 ? "익" : "손"} {fmtSignedUsd(r.fxUsd)}
                                      {" · "}매수 {r.buyKrwPerUsd?.toFixed(1)}원 → 현재 {fx?.toFixed(1)}원
                                    </span>
                                  </div>
                                )}
                                {hist.map((t, k) => (
                                  <div key={k} className="hist-item">
                                    <span className={`side ${t.side === "매수" ? "buy" : "sell"}`}>{t.side}</span>
                                    <span className="num hd">{fmtTradeDate(t.date)}</span>
                                    {t.meeting ? <span className="hm">{t.meeting}차</span> : <span />}
                                    <span className="num hq">{t.qty.toLocaleString()}주 @ {fmtLocalPrice(r.currency, t.price)}</span>
                                    <span className="num hu">{money(t.usd)}</span>
                                    <span className="hn">{t.note}</span>
                                  </div>
                                ))}
                                {(() => {
                                  // 7/29 — 1차 회의 결정으로 편입한 개시 포트폴리오. 이후 체결과 구분해 표시
                                  const op = openingOf(r.ticker);
                                  if (!op) return null;
                                  return (
                                    <div className="hist-item">
                                      <span className="side base">개시</span>
                                      <span className="num hd">{fmtTradeDate(OPENING_DATE)}</span>
                                      <span />
                                      <span className="num hq">{op.qty.toLocaleString()}주 @ {fmtLocalPrice(r.currency, op.avgPrice)}</span>
                                      <span className="num hu">기초 보유</span>
                                      <span className="hn">{op.note ?? "개시 포트폴리오 편입"}</span>
                                    </div>
                                  );
                                })()}
                              </div>
                            </li>
                          )}
                        </Fragment>
                      );
                    })}
                  </ul>
                </div>
              ))}

            </section>
          )}

          {tab === "매수·매도 플랜" && (
            <section className="section" role="tabpanel" aria-label="매수·매도 플랜">
              <div className="section-head">
                <h2 className="sr-only">매수·매도 플랜 진행</h2>
                <span className="meta num">
                  투입 {fmtUsd(investedUsd)} / 예산 {fmtUsd(AUM_USD)}
                </span>
              </div>
              {planBySector.map((g) => (
                <div key={g.sector} className="plan-group">
                  <div className="plan-head">
                    <span className="sec">
                      <i style={{ background: sectorColorVar(g.sector) }} />
                      {g.sector}
                    </span>
                    <span className="meta num">
                      {fmtUsd(g.boughtSum)} / {fmtUsd(g.targetSum)} ({g.targetSum > 0 ? Math.round((g.boughtSum / g.targetSum) * 100) : 0}%)
                    </span>
                  </div>
                  {g.positions.map((p) => {
                    const row = rows.find((r) => r.ticker === p.ticker);
                    const bought = row?.costUsd ?? 0;
                    const done = p.status === "매수완료";
                    // 완료 종목은 체결가 반올림 탓에 97~99%로 어긋나 보인다 — 완료면 100%로 못박는다
                    const prog = done ? 1 : p.targetUsd > 0 ? Math.min(bought / p.targetUsd, 1) : 0;
                    const gap = p.targetUsd - bought;
                    // 리밸런싱 도우미 — 잔여 금액을 지금 시세로 몇 주인지 환산한다.
                    // 매수완료(익절로 원가가 줄어든 경우 포함)는 잔여로 치지 않는다.
                    const showGap = gap > 500 && p.status !== "매수완료";
                    const pxUsd = row && row.valueUsd != null && row.qty > 0 ? row.valueUsd / row.qty : null;
                    const shares = showGap && pxUsd ? Math.floor(gap / pxUsd) : null;
                    const whyOpen = planWhy === p.ticker;
                    return (
                      <Fragment key={p.ticker}>
                        <div
                          className="plan-row"
                          data-clickable={!!p.why || undefined}
                          data-open={whyOpen || undefined}
                          role={p.why ? "button" : undefined}
                          tabIndex={p.why ? 0 : undefined}
                          onClick={() => p.why && setPlanWhy(whyOpen ? null : p.ticker)}
                          onKeyDown={(e) => {
                            if (p.why && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setPlanWhy(whyOpen ? null : p.ticker); }
                          }}
                        >
                          <span className="nm">
                            <Logo ticker={p.ticker} name={p.name} color={tickerColorVar(p.ticker, HOLDINGS.positions.indexOf(p))} size={22} />
                            <span className="plan-nm">{p.name}</span>
                            <span className="tk">{p.ticker}</span>
                            {p.why && <i className="plan-caret" aria-hidden>▾</i>}
                          </span>
                          {statusPill(p.status)}
                          {/* %는 진행 중일 때만 — 완료·미매수는 알약이 이미 말하고 있어 반복하지 않는다 */}
                          <span className="bar-wrap">
                            <span className="bar" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} 매수 진행률`}>
                              <i data-done={done} style={{ width: `${prog * 100}%` }} />
                            </span>
                            <b className={`bar-pct num${prog >= 1 ? " full" : prog === 0 ? " zero" : ""}`}>
                              {Math.round(prog * 100)}%
                            </b>
                          </span>
                          <span className="tgt num">
                            {fmtUsd(p.targetUsd)}
                            {showGap && (
                              <span className="plan-gap" title={shares != null ? "잔여 목표를 현재가로 환산한 수량" : "시세 없음 — 잔여 금액만"}>
                                잔여 {fmtUsd(gap)}{shares != null && shares > 0 ? ` ≈ ${shares.toLocaleString()}주` : ""}
                              </span>
                            )}
                          </span>
                        </div>
                        {whyOpen && p.why && <p className="plan-why">{p.why}</p>}
                      </Fragment>
                    );
                  })}
                </div>
              ))}
            </section>
          )}

          {tab === "AP·MP" && <Allocation rows={rows} unit={unit} usdkrw={fx} />}

          {tab === "매매 내역" && <TradeLog unit={unit} usdkrw={fx} />}

          {tab === "오늘의 분석" && teamMode && <DailySignals />}

          {tab === "캘린더" && teamMode && <Calendar />}

          {tab === "회의록" && teamMode && <MeetingNotes rows={rows} />}

          {tab === "보유 비중" && <div role="tabpanel" aria-label="보유 비중">{donutSection}</div>}

          {teamMode && <WeeklyReport
            rows={rows}
            quotes={quotes}
            valueUsd={totals.valueUsd}
            costUsd={totals.costUsd}
          />}

          {teamMode && <ChangeLog />}

          <footer className="footer">
            시세는 국내 종목이 네이버 실시간, 해외·환율·지표가 Yahoo Finance입니다. 거래소에 따라 최대 15~20분 지연될 수 있고 {anyOpen ? "1분" : "5분"}마다 자동 갱신됩니다.
            <br />
            수익률 산식: 종목·전체 수익률은 <b>투입 원가 대비 단순 수익률</b>(원가는 체결 시점 환율로 고정)이며, 시간가중(TWR) 방식이 아닙니다.
            총자산 추이·리스크 지표는 일별 종가 역산, S&P 대비는 <b>동일 현금흐름(PME) 방식</b>과 <b>지수 등락 단순 비교</b>를 병기합니다 — 전자는 종목 선택 효과, 후자는 현금 보유 비용까지 포함한 값입니다.
            <br />
            보유 기준일 {HOLDINGS.meta.updatedAt} · 체결 원장 <span className="mono">data/trades.json</span>
            {teamMode && (
              <>
                {" · "}
                <a href={HOLDINGS.meta.notionUrl} target="_blank" rel="noreferrer">노션에서 플랜·투자근거 보기</a>
              </>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}
