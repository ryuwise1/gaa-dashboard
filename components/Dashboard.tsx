"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Donut, { type DonutSegment } from "@/components/Donut";
import {
  HOLDINGS, SECTOR_ORDER, buildHoldingRows, buildTotals, fmtKrw, fmtLocalPrice,
  fmtPct, fmtSignedUsd, fmtUsd, sectorColorVar, symbolsToFetch, tickerColorVar,
  type HoldingRow, type QuoteMap,
} from "@/lib/portfolio";

const REFRESH_MS = 60_000;

function deltaClass(n: number | null): string {
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsToFetch().join(","))}`);
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setQuotes(data.quotes ?? {});
      setFetchedAt(data.fetchedAt ?? Date.now());
      setError(null);
    } catch {
      setError("시세를 불러오지 못했어요. 잠시 후 자동으로 다시 시도합니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && fetchedAt && Date.now() - fetchedAt > REFRESH_MS) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const rows = useMemo(() => buildHoldingRows(quotes), [quotes]);
  const totals = useMemo(() => buildTotals(rows, quotes), [rows, quotes]);
  const hasLive = rows.some((r) => r.live);

  const segments: DonutSegment[] = useMemo(() => {
    if (group === "종목") {
      return rows
        .filter((r) => (r.valueUsd ?? 0) > 0)
        .map((r, i) => ({
          key: r.ticker,
          label: r.name,
          value: r.valueUsd!,
          pct: r.weight ?? 0,
          color: tickerColorVar(r.ticker, i),
        }));
    }
    const bySector = new Map<string, number>();
    for (const r of rows) {
      if ((r.valueUsd ?? 0) > 0) bySector.set(r.sector, (bySector.get(r.sector) ?? 0) + r.valueUsd!);
    }
    const total = [...bySector.values()].reduce((s, v) => s + v, 0);
    return SECTOR_ORDER.filter((s) => bySector.has(s)).map((s) => ({
      key: s,
      label: s,
      value: bySector.get(s)!,
      pct: total > 0 ? bySector.get(s)! / total : 0,
      color: sectorColorVar(s),
    }));
  }, [rows, group]);

  const planBySector = useMemo(() => {
    const currentBy = new Map<string, number>();
    for (const r of rows) currentBy.set(r.ticker, r.costUsd ?? 0);
    return SECTOR_ORDER.map((sector) => {
      const positions = HOLDINGS.positions.filter((p) => p.sector === sector);
      if (positions.length === 0) return null;
      const targetSum = positions.reduce((s, p) => s + p.targetUsd, 0);
      const boughtSum = positions.reduce((s, p) => s + (currentBy.get(p.ticker) ?? 0), 0);
      return { sector, positions, targetSum, boughtSum };
    }).filter(Boolean) as { sector: string; positions: typeof HOLDINGS.positions; targetSum: number; boughtSum: number }[];
  }, [rows]);

  const planTotalBought = planBySector.reduce((s, g) => s + g.boughtSum, 0);

  const updatedText = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : null;

  return (
    <div className="wrap">
      <header className="topbar">
        <h1>
          글리프자운팀 포트폴리오
          <span className="team-glyph mono">GAA 26-2</span>
        </h1>
        <div className="top-actions">
          {updatedText && <span className="num">{updatedText} 기준</span>}
          <button className="refresh-btn" onClick={load} disabled={loading} aria-label="시세 새로고침">
            <span className={loading ? "spin" : undefined} aria-hidden>⟳</span> 새로고침
          </button>
        </div>
      </header>

      {error && <p className="err" role="alert">{error}</p>}

      <div className="tape" aria-label="보유 종목 시세 요약">
        {rows.map((r) => (
          <span key={r.ticker} className="tape-chip mono">
            <span className="tk">{r.ticker}</span>
            <span className="px">{fmtLocalPrice(r.currency, r.price)}</span>
            <span className={deltaClass(r.dayPct)}>{r.dayPct == null ? "—" : fmtPct(r.dayPct, 1)}</span>
          </span>
        ))}
      </div>

      <div className="grid">
        <div className="col-side">
          <section className="card" aria-label="총 평가금액">
            <div className="hero-label">보유 종목 평가금액</div>
            <div className="hero-value num">
              {totals.valueKrw != null ? fmtKrw(totals.valueKrw) : hasLive ? fmtUsd(totals.valueUsd) : <span className="skeleton">불러오는 중…</span>}
            </div>
            <div className="hero-subs num">
              <div className="row">
                <span className="k">평가손익</span>
                <span className={`v ${deltaClass(totals.pnlUsd)}`}>
                  {fmtSignedUsd(totals.pnlUsd)} ({fmtPct(totals.pnlPct)})
                </span>
              </div>
              <div className="row">
                <span className="k">오늘</span>
                <span className={`v ${deltaClass(totals.dayUsd)}`}>
                  {hasLive ? <>{fmtSignedUsd(totals.dayUsd)} ({fmtPct(totals.dayPct)})</> : "—"}
                </span>
              </div>
              <div className="row">
                <span className="k">달러 환산</span>
                <span className="v">{fmtUsd(totals.valueUsd)}</span>
              </div>
              <div className="row">
                <span className="k">환율</span>
                <span className="v">{totals.usdkrw ? `${totals.usdkrw.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}원/$` : "—"}</span>
              </div>
            </div>
          </section>

          <section className="card" aria-label="보유 비중">
            <div className="card-head">
              <h2>보유 비중</h2>
              <div className="seg-toggle" role="group" aria-label="비중 묶기 기준">
                {(["종목", "섹터"] as const).map((g) => (
                  <button key={g} aria-pressed={group === g} onClick={() => { setGroup(g); setHovered(null); }}>
                    {g}별
                  </button>
                ))}
              </div>
            </div>
            <Donut
              segments={segments}
              hovered={hovered}
              onHover={setHovered}
              centerLabel="총 보유"
              centerValue={fmtUsd(totals.valueUsd)}
            />
            <div className="legend">
              {segments.map((s) => (
                <button
                  key={s.key}
                  className="legend-row"
                  data-active={hovered === s.key}
                  onMouseEnter={() => setHovered(s.key)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(s.key)}
                  onBlur={() => setHovered(null)}
                >
                  <span className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-name">
                    {s.label}
                    {group === "종목" && <span className="tk mono">{s.key}</span>}
                  </span>
                  <span className="legend-val num">{fmtUsd(s.value)}</span>
                  <span className="legend-pct num">{(s.pct * 100).toFixed(1)}%</span>
                </button>
              ))}
            </div>
          </section>
        </div>

        <div className="col-main">
          <section className="card" aria-label="보유 현황">
            <div className="card-head">
              <h2>보유 현황</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }} className="num">{rows.length}종목</span>
            </div>
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr>
                    <th>종목</th>
                    <th>현재가</th>
                    <th className="hide-sm">평단가</th>
                    <th>평가금액</th>
                    <th>평가손익</th>
                    <th className="hide-sm">오늘</th>
                    <th>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.ticker}>
                      <td>
                        <span className="cell-name">
                          <span className="dot" style={{ background: tickerColorVar(r.ticker, i) }} />
                          <span>
                            <span className="nm">{r.name}</span>{" "}
                            <span className="tk mono">{r.ticker}</span>
                            <span className="cell-sub num">{r.qty.toLocaleString()}주</span>
                          </span>
                        </span>
                      </td>
                      <td className="num">
                        {fmtLocalPrice(r.currency, r.price)}
                        {!r.live && <span className="cell-sub">평단 기준</span>}
                      </td>
                      <td className="num hide-sm">{fmtLocalPrice(r.currency, r.avgPrice)}</td>
                      <td className="num">
                        {fmtUsd(r.valueUsd)}
                        {totals.usdkrw && r.valueUsd != null && (
                          <span className="cell-sub">{fmtKrw(r.valueUsd * totals.usdkrw)}</span>
                        )}
                      </td>
                      <td className={`num ${deltaClass(r.pnlUsd)}`}>
                        {fmtSignedUsd(r.pnlUsd)}
                        <span className="cell-sub" style={{ color: "inherit", opacity: 0.85 }}>{fmtPct(r.pnlPct)}</span>
                      </td>
                      <td className={`num hide-sm ${deltaClass(r.dayPct)}`}>{r.dayPct == null ? "—" : fmtPct(r.dayPct)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{r.weight == null ? "—" : (r.weight * 100).toFixed(1) + "%"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card" aria-label="매수·매도 플랜">
            <div className="card-head">
              <h2>매수·매도 플랜 진행</h2>
              <span style={{ fontSize: 12, color: "var(--muted)" }} className="num">
                {fmtUsd(planTotalBought)} / {fmtUsd(HOLDINGS.meta.targetTotalUsd)} 매수
              </span>
            </div>
            {planBySector.map((g) => (
              <div key={g.sector}>
                <div className="plan-sector">
                  <span className="sec">
                    <span className="dot" style={{ background: sectorColorVar(g.sector) }} />
                    {g.sector}
                  </span>
                  <span className="meta num">
                    {fmtUsd(g.boughtSum)} / {fmtUsd(g.targetSum)} ({g.targetSum > 0 ? Math.round((g.boughtSum / g.targetSum) * 100) : 0}%)
                  </span>
                </div>
                {g.positions.map((p) => {
                  const bought = rows.find((r) => r.ticker === p.ticker)?.costUsd ?? 0;
                  const prog = p.targetUsd > 0 ? Math.min(bought / p.targetUsd, 1) : 0;
                  return (
                    <div key={p.ticker} className="plan-row">
                      <span className="nm">
                        {p.name}
                        <span className="tk mono">{p.ticker}</span>
                      </span>
                      {statusPill(p.status)}
                      <span className="bar" role="progressbar" aria-valuenow={Math.round(prog * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} 매수 진행률`}>
                        <i style={{ width: `${prog * 100}%` }} />
                      </span>
                      <span className="tgt num">
                        목표 {(p.targetWeight * 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}% · {fmtUsd(p.targetUsd)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </section>

          <footer className="footer">
            시세 출처: Yahoo Finance — 거래소에 따라 최대 15~20분 지연될 수 있어요 · 60초마다 자동 갱신
            <br />
            보유 수량·평단가 기준일 {HOLDINGS.meta.updatedAt} — 매매 후에는 <span className="mono">/포트업데이트</span>로 반영 ·{" "}
            <a href={HOLDINGS.meta.notionUrl} target="_blank" rel="noreferrer">노션에서 플랜·투자근거 보기</a>
          </footer>
        </div>
      </div>
    </div>
  );
}
