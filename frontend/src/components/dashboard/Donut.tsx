import { Tooltip } from 'antd';
import type { ReactNode } from 'react';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  track: string;
  /** separates adjacent arcs; the card surface colour */
  gap?: number;
  center?: ReactNode;
}

/** Ring chart in plain SVG. Each arc has its own tooltip; the legend lives with the caller. */
export default function Donut({ segments, size = 168, thickness = 16, track, gap = 2, center }: Props) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  let offset = 0;

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={thickness} />
        {total > 0 &&
          visible.map((s) => {
            const len = (s.value / total) * c;
            const dash = Math.max(0, len - (visible.length > 1 ? gap : 0));
            const el = (
              <Tooltip key={s.key} title={`${s.label}: ${s.value.toLocaleString()} (${((s.value / total) * 100).toFixed(1)}%)`}>
                <circle
                  className="dash-donut-arc"
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  style={{ cursor: 'default' }}
                />
              </Tooltip>
            );
            offset += len;
            return el;
          })}
      </svg>
      {center && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          {center}
        </div>
      )}
    </div>
  );
}
