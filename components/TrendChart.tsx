"use client";

import { useMemo, useRef, useState } from "react";

export interface TrendPoint {
  date: string;
  totalUsd: number;
  /** 우리와 같은 날·같은 금액으로 S&P 500을 분할 매수했다면 (PME) — 회색 비교선 */
  benchUsd?: number | null;
  /** 지수 자체의 누적 등락률 — 일시투입 관점 */
  spxPct?: number | null;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const WD = ["일", "월", "화", "수", "목", "금", "토"];

function label(p: TrendPoint): string {
  const [y, m, d] = p.date.split("-").map(Number);
  return `${m}/${d} (${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]})`;
}

/**
 * 총자산 추이 — 마우스를 올리면 그 날의 값·AUM 대비·전일 대비를 위 정보줄에 띄운다.
 * x축은 거래일 인덱스 등간격이라 커서 위치 → 인덱스 환산이 단순하다.
 */
export default function TrendChart({
  points,
  base,
  h = 56,
}: {
  points: TrendPoint[];
  /** AUM — 점선 기준선 */
  base: number;
  h?: number;
}) {
  const W = 300;
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { line, area, benchLine, idxLine, x, y } = useMemo(() => {
    const vals = points.map((p) => p.totalUsd);
    const bvals = points.map((p) => p.benchUsd).filter((v): v is number => v != null);
    // 지수등락 선 — AUM 전액을 개시일에 지수에 넣었다면
    const ivals = points.map((p) => (p.spxPct != null ? base * (1 + p.spxPct) : null));
    const lo = Math.min(...vals, ...bvals, ...ivals.filter((v): v is number => v != null), base);
    const hi = Math.max(...vals, ...bvals, ...ivals.filter((v): v is number => v != null), base);
    const span = hi - lo || 1;
    const pad = 4;
    const y = (v: number) => h - pad - ((v - lo) / span) * (h - pad * 2);
    const x = (i: number) => (i / (points.length - 1)) * W;
    const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.totalUsd).toFixed(1)}`).join(" ");
    // null 구간을 건너뛰며 잇는 보조선
    const path = (vs: (number | null | undefined)[]) => {
      let d = "", pen = false;
      vs.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
        pen = true;
      });
      return d.trim();
    };
    return {
      line,
      area: `${line} L${W} ${h} L0 ${h} Z`,
      benchLine: path(points.map((p) => p.benchUsd)),
      idxLine: path(ivals),
      x, y,
    };
  }, [points, base, h]);

  const move = (clientX: number) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    setHover(Math.round(t * (points.length - 1)));
  };

  const cur = hover != null ? points[hover] : points[points.length - 1];
  const prev = hover != null ? points[hover - 1] : points[points.length - 2];
  const dd = prev ? cur.totalUsd - prev.totalUsd : null;
  const vsAum = cur.totalUsd / base - 1;
  // S&P 대비 두 관점을 병기한다 — 한쪽만 보여주면 유리한 숫자를 고른 걸로 보인다.
  // ① PME(동일 현금흐름): 종목 선택 효과  ② 지수 등락 대비: 현금 드래그까지 포함한 펀드 전체
  const alpha = cur.benchUsd != null ? vsAum - (cur.benchUsd / base - 1) : null;
  const vsIndex = cur.spxPct != null ? vsAum - cur.spxPct : null;
  const tone = (n: number) => (n > 0 ? "gain" : n < 0 ? "loss" : "flat");
  const up = points[points.length - 1].totalUsd >= base;
  const stroke = up ? "var(--gain)" : "var(--loss)";

  return (
    <div className="trend" title="일별 종가로 역산한 총자산 (평가+현금)">
      <div className="trend-info num" data-hover={hover != null}>
        <span className="d">{label(cur)}</span>
        <b>{fmt(cur.totalUsd)}</b>
        <span className={tone(vsAum)}>누적 {vsAum >= 0 ? "+" : "−"}{Math.abs(vsAum * 100).toFixed(1)}%</span>
        {dd != null && prev != null && (
          <span className={tone(dd)}>
            전일 {dd >= 0 ? "+" : "−"}{fmt(Math.abs(dd))} ({dd >= 0 ? "+" : "−"}{Math.abs((dd / prev.totalUsd) * 100).toFixed(2)}%)
          </span>
        )}
        {(alpha != null || vsIndex != null) && (
          <span className="trend-vs">
            S&P 대비
            {alpha != null && (
              <i className={tone(alpha)} title="동일 현금흐름(PME) — 우리와 같은 날·같은 금액으로 지수를 분할 매수한 가정(회색 선) 대비. 종목 선택 효과">
                동일흐름 {alpha >= 0 ? "+" : "−"}{Math.abs(alpha * 100).toFixed(1)}%p
              </i>
            )}
            {vsIndex != null && (
              <i className={tone(vsIndex)} title="지수 등락률과의 단순 비교 — 현금을 들고 있던 비용(현금 드래그)까지 포함한 펀드 전체 관점">
                지수등락 {vsIndex >= 0 ? "+" : "−"}{Math.abs(vsIndex * 100).toFixed(1)}%p
              </i>
            )}
          </span>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${h}`}
        preserveAspectRatio="none"
        onMouseMove={(e) => move(e.clientX)}
        onMouseLeave={() => setHover(null)}
        onTouchStart={(e) => move(e.touches[0].clientX)}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={() => setHover(null)}
        role="img"
        aria-label="총자산 추이"
      >
        <defs>
          <linearGradient id="trendfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" x2={W} y1={y(base)} y2={y(base)} stroke="var(--hairline-2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        {idxLine && (
          <path d={idxLine} fill="none" stroke="var(--muted)" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        )}
        {benchLine && (
          <path d={benchLine} fill="none" stroke="var(--muted)" strokeWidth="1.1" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
        )}
        <path d={area} fill="url(#trendfill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {hover != null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1="0" y2={h} stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
            <circle cx={x(hover)} cy={y(points[hover].totalUsd)} r="3" fill={stroke} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>

      <div className="trend-cap num">
        <span>{points[0].date.slice(5).replace("-", "/")} 시작</span>
        <span>{hover != null ? "놓으면 최신으로" : "선 위에 마우스를 올리면 일별 상세"}</span>
        <span>{points[points.length - 1].date.slice(5).replace("-", "/")}</span>
      </div>
      {(alpha != null || vsIndex != null) && (
        <div className="trend-legend num">
          <span><i className="sw ours" style={{ background: stroke }} />우리 총자산</span>
          <span><i className="sw bench" />S&P 동일흐름</span>
          <span><i className="sw idx" />S&P 지수등락</span>
        </div>
      )}
    </div>
  );
}
