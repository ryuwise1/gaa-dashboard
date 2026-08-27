"use client";

import { useId } from "react";

/**
 * 당일 흐름을 보여주는 작은 선. 값의 절대 수준이 아니라 모양만 읽는 용도라
 * 축·눈금 없이 최소~최대를 세로로 꽉 채운다.
 * 색은 전일 종가 대비 방향을 따라간다 (한국 관례: 상승 빨강 / 하락 파랑).
 */
export default function Sparkline({
  data,
  dir,
  base,
  w = 58,
  h = 30,
}: {
  data: number[];
  /** 1 상승 · -1 하락 · 0 보합 */
  dir: number;
  /** 전일 종가 — 기준선을 그린다 */
  base?: number | null;
  w?: number;
  h?: number;
}) {
  const id = useId().replace(/:/g, "");

  if (!data || data.length < 2) {
    return <span className="spark spark-none" style={{ width: w, height: h }} aria-hidden />;
  }

  const lo = Math.min(...data, ...(base != null ? [base] : []));
  const hi = Math.max(...data, ...(base != null ? [base] : []));
  const span = hi - lo || 1;
  const pad = 3;
  const y = (v: number) => h - pad - ((v - lo) / span) * (h - pad * 2);
  const x = (i: number) => (i / (data.length - 1)) * w;

  const line = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const stroke = dir > 0 ? "var(--gain)" : dir < 0 ? "var(--loss)" : "var(--muted)";

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden focusable="false">
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.26" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {base != null && (
        <line
          x1="0" x2={w} y1={y(base).toFixed(1)} y2={y(base).toFixed(1)}
          stroke="var(--hairline-2)" strokeWidth="1" strokeDasharray="2 2"
        />
      )}
      <path d={area} fill={`url(#g${id})`} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={w} cy={y(data[data.length - 1])} r="1.8" fill={stroke} />
    </svg>
  );
}
