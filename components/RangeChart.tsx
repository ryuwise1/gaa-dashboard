"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fmtLocalPrice, fmtPct, type Currency } from "@/lib/portfolio";

type Range = "1w" | "1m" | "3m";
const LABEL: Record<Range, string> = { "1w": "1주", "1m": "1달", "3m": "3달" };
const WD = ["일", "월", "화", "수", "목", "금", "토"];

interface SparkResp {
  spark: number[]; times: number[]; first: number; last: number;
  /** 일봉 구간(1m·3m)에만 실리는 기술적 지표 */
  ma20?: (number | null)[]; ma60?: (number | null)[]; rsi?: number | null;
}

// 같은 종목·기간을 다시 펼칠 때 재요청하지 않게 세션 안에서 기억한다
const memo = new Map<string, SparkResp>();

/** 시각 라벨 — 1주는 분봉이라 시각까지, 1달·3달은 날짜만 (KST) */
function stampLabel(epoch: number, range: Range): string {
  const d = new Date(epoch * 1000);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric",
    ...(range === "1w" ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).formatToParts(d);
  const get = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
  const wd = WD[new Date(iso + "T00:00:00Z").getUTCDay()];
  const md = `${get("month")}/${get("day")} (${wd})`;
  return range === "1w" ? `${md} ${get("hour")}:${get("minute")}` : md;
}

/**
 * 종목 행을 펼쳤을 때 나오는 기간 차트.
 * 총자산 추이와 같은 방식으로 마우스를 올리면 그 시점의 값이 위 정보줄에 뜬다.
 */
export default function RangeChart({ symbol, currency }: { symbol: string; currency: Currency }) {
  const [range, setRange] = useState<Range>("1m");
  const [data, setData] = useState<SparkResp | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "fail">("loading");
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const key = `${symbol}:${range}`;
    setHover(null);
    const hit = memo.get(key);
    if (hit) { setData(hit); setState("ok"); return; }
    setState("loading");
    fetch(`/api/spark?symbol=${encodeURIComponent(symbol)}&range=${range}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SparkResp) => { memo.set(key, d); setData(d); setState("ok"); })
      .catch(() => setState("fail"));
  }, [symbol, range]);

  const W = 320;
  const H = 64;

  const geom = useMemo(() => {
    if (!data || data.spark.length < 2) return null;
    const vals = data.spark;
    // 이동평균선까지 스케일에 포함해야 선이 차트 밖으로 나가지 않는다
    const maVals = [...(data.ma20 ?? []), ...(data.ma60 ?? [])].filter((n): n is number => n != null);
    const lo = Math.min(...vals, ...maVals);
    const hi = Math.max(...vals, ...maVals);
    const span = hi - lo || 1;
    const pad = 4;
    const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);
    const x = (i: number) => (i / (vals.length - 1)) * W;
    const line = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
    // 이동평균 경로 — null(워밍업) 구간은 건너뛰고 이어 그린다
    const maPath = (ma?: (number | null)[]) => {
      if (!ma) return "";
      let p = "", pen = false;
      ma.forEach((v, i) => {
        if (v == null) { pen = false; return; }
        p += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
        pen = true;
      });
      return p.trim();
    };
    return { line, area: `${line} L${W} ${H} L0 ${H} Z`, ma20: maPath(data.ma20), ma60: maPath(data.ma60), x, y };
  }, [data]);

  const move = (clientX: number) => {
    const el = svgRef.current;
    if (!el || !data) return;
    const r = el.getBoundingClientRect();
    const t = Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    setHover(Math.round(t * (data.spark.length - 1)));
  };

  const chg = data ? (data.last - data.first) / data.first : null;
  const dir = chg == null ? 0 : chg > 0 ? 1 : chg < 0 ? -1 : 0;
  const stroke = dir > 0 ? "var(--gain)" : dir < 0 ? "var(--loss)" : "var(--muted)";

  // 정보줄 — 호버 중이면 그 시점, 아니면 마지막 시점
  const idx = hover ?? (data ? data.spark.length - 1 : 0);
  const curV = data?.spark[idx] ?? null;
  const curT = data?.times[idx] ?? null;
  const curPct = data && curV != null ? (curV - data.first) / data.first : null;
  const tone = (n: number | null) => (n == null || n === 0 ? "flat" : n > 0 ? "gain" : "loss");

  return (
    <div className="range-chart">
      <div className="rc-head">
        <div className="seg" role="group" aria-label="차트 기간">
          {(Object.keys(LABEL) as Range[]).map((k) => (
            <button key={k} aria-pressed={range === k} onClick={() => setRange(k)}>{LABEL[k]}</button>
          ))}
        </div>
        {data && curV != null && (
          <span className="rc-sum num">
            <em className="rc-date">{curT ? stampLabel(curT, range) : ""}</em>
            <b>{fmtLocalPrice(currency, curV)}</b>
            <i className={tone(curPct)}> 기간 시작 대비 {fmtPct(curPct, 1)}</i>
          </span>
        )}
      </div>

      {state === "loading" && <div className="rc-empty">차트 불러오는 중…</div>}
      {state === "fail" && <div className="rc-empty">차트를 불러오지 못했습니다</div>}

      {state === "ok" && data && geom && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          onMouseMove={(e) => move(e.clientX)}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => move(e.touches[0].clientX)}
          onTouchMove={(e) => move(e.touches[0].clientX)}
          onTouchEnd={() => setHover(null)}
          role="img"
          aria-label="기간 차트"
        >
          <defs>
            <linearGradient id={`rc-${symbol.replace(/[^a-zA-Z0-9]/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.2" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line
            x1="0" x2={W} y1={geom.y(data.first)} y2={geom.y(data.first)}
            stroke="var(--hairline-2)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke"
          />
          <path d={geom.area} fill={`url(#rc-${symbol.replace(/[^a-zA-Z0-9]/g, "")})`} />
          {geom.ma60 && (
            <path d={geom.ma60} fill="none" stroke="var(--loss)" strokeWidth="1" strokeOpacity="0.7" vectorEffect="non-scaling-stroke" />
          )}
          {geom.ma20 && (
            <path d={geom.ma20} fill="none" stroke="var(--status-buying)" strokeWidth="1" strokeOpacity="0.85" vectorEffect="non-scaling-stroke" />
          )}
          <path d={geom.line} fill="none" stroke={stroke} strokeWidth="1.5"
            strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {hover != null && (
            <>
              <line x1={geom.x(hover)} x2={geom.x(hover)} y1="0" y2={H}
                stroke="var(--muted)" strokeWidth="1" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
              <circle cx={geom.x(hover)} cy={geom.y(data.spark[hover])} r="3"
                fill={stroke} stroke="var(--bg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
      )}
      {/* 기술적 지표 요약 — 일봉 구간에서만 */}
      {state === "ok" && data && (data.ma20 || data.rsi != null) && (
        <div className="rc-ta num">
          <span className="k"><i className="sw" style={{ background: stroke }} />주가</span>
          <span className="k"><i className="sw start" />기간 시작가</span>
          <span className="k"><i className="sw ma20" />MA20 <em className="sub">20일 평균</em></span>
          <span className="k"><i className="sw ma60" />MA60 <em className="sub">60일 평균</em></span>
          {data.rsi != null && (
            <span className={`k rsi${data.rsi >= 70 ? " hot" : data.rsi <= 30 ? " cold" : ""}`}>
              RSI(14) <b>{data.rsi}</b>
              {data.rsi >= 70 ? " 과매수" : data.rsi <= 30 ? " 과매도" : " 중립"}
            </span>
          )}
          {(() => {
            // 골든/데드 크로스 감지 — 표시 구간 안에서 MA20이 MA60을 가로질렀는지
            const a = data.ma20, b = data.ma60;
            if (!a || !b) return null;
            for (let i = a.length - 1; i > 0; i--) {
              if (a[i] == null || b[i] == null || a[i - 1] == null || b[i - 1] == null) continue;
              const now = (a[i]! - b[i]!) > 0, prev = (a[i - 1]! - b[i - 1]!) > 0;
              if (now !== prev) return <span className={`k cross ${now ? "hot" : "cold"}`}>{now ? "골든크로스 ↑" : "데드크로스 ↓"}</span>;
            }
            return null;
          })()}
        </div>
      )}

      {state === "ok" && (
        <div className="trend-cap num">
          <span>{data?.times[0] ? stampLabel(data.times[0], range) : ""}</span>
          <span>{hover != null ? "놓으면 최신으로" : "선 위에 마우스를 올리면 시점별 상세"}</span>
          <span>{data?.times[data.times.length - 1] ? stampLabel(data.times[data.times.length - 1], range) : ""}</span>
        </div>
      )}
    </div>
  );
}
