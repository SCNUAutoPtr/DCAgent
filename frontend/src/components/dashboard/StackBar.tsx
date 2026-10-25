import { Tooltip, theme } from 'antd';

export interface StackPart {
  key: string;
  label: string;
  value: number;
  color: string;
}

/** One 100% bar split into parts, with a legend underneath (label + value, so colour is never alone). */
export default function StackBar({ parts }: { parts: StackPart[] }) {
  const { token } = theme.useToken();
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: token.colorFillTertiary, gap: total ? 2 : 0 }}>
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => (
              <Tooltip key={p.key} title={`${p.label}: ${p.value} (${((p.value / total) * 100).toFixed(1)}%)`}>
                <div className="dash-bar-fill" style={{ flex: p.value, background: p.color, borderRadius: 0 }} />
              </Tooltip>
            ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 10 }}>
        {parts.map((p) => (
          <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: token.colorTextSecondary }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color }} />
            {p.label}
            <span style={{ color: token.colorText, fontVariantNumeric: 'tabular-nums' }}>{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
