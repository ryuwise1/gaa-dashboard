"use client";

export interface DonutSegment {
  key: string;
  label: string;
  sub?: string;
  value: number; // USD
  pct: number; // 0..1
  color: string;
}

interface Props {
  segments: DonutSegment[];
  hovered: string | null;
  onHover: (key: string | null) => void;
  centerLabel: string;
  centerValue: string;
}

const SIZE = 240;
const R = 88;
const STROKE = 30;
const C = 2 * Math.PI * R;
const GAP = 2.5; // 조각 사이 표면 간격(px)

export default function Donut({ segments, hovered, onHover, centerLabel, centerValue }: Props) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const active = segments.find((s) => s.key === hovered) ?? null;

  let offset = 0;
  const arcs = segments.map((seg) => {
    const len = total > 0 ? (seg.value / total) * C : 0;
    const arc = { ...seg, len, offset };
    offset += len;
    return arc;
  });

  return (
    <div className="donut-box">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`보유 비중 도넛 차트: ${segments.map((s) => `${s.label} ${(s.pct * 100).toFixed(1)}%`).join(", ")}`}
        onMouseLeave={() => onHover(null)}
      >
        <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
          {arcs.map((a) => {
            const dim = hovered !== null && hovered !== a.key;
            return (
              <circle
                key={a.key}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth={hovered === a.key ? STROKE + 4 : STROKE}
                strokeDasharray={`${Math.max(a.len - GAP, 0.5)} ${C - Math.max(a.len - GAP, 0.5)}`}
                strokeDashoffset={-a.offset - GAP / 2}
                opacity={dim ? 0.28 : 1}
                style={{ transition: "opacity .15s, stroke-width .15s" }}
                onMouseEnter={() => onHover(a.key)}
              />
            );
          })}
        </g>
        {active ? (
          <>
            <text x="50%" y="44%" textAnchor="middle" className="donut-center-label">
              {active.label}
            </text>
            <text x="50%" y="54%" textAnchor="middle" className="donut-center-value num">
              {(active.pct * 100).toFixed(1)}%
            </text>
            <text x="50%" y="62%" textAnchor="middle" className="donut-center-sub">
              ${Math.round(active.value).toLocaleString("en-US")}
            </text>
          </>
        ) : (
          <>
            <text x="50%" y="45%" textAnchor="middle" className="donut-center-label">
              {centerLabel}
            </text>
            <text x="50%" y="56%" textAnchor="middle" className="donut-center-value num">
              {centerValue}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
