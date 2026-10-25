import { Tooltip, Typography, theme } from 'antd';

export interface BarItem {
  key: string;
  label: string;
  value: number;
  color: string;
  /** text shown at the end of the row; defaults to the value */
  display?: string;
  /** bar length in 0..1; defaults to value / max */
  ratio?: number;
  tooltip?: string;
  onClick?: () => void;
}

/** Horizontal bars with direct labels: label | bar | value. */
export default function BarList({ items }: { items: BarItem[] }) {
  const { token } = theme.useToken();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div>
      {items.map((it, idx) => {
        const ratio = it.ratio ?? it.value / max;
        return (
          <Tooltip key={it.key} title={it.tooltip ?? `${it.label}: ${it.value.toLocaleString()}`} placement="topLeft">
            <div
              className="dash-bar-row"
              onClick={it.onClick}
              style={{ cursor: it.onClick ? 'pointer' : 'default' }}
            >
              <Typography.Text ellipsis style={{ color: token.colorTextSecondary, fontSize: 13 }}>
                {it.label}
              </Typography.Text>
              <div className="dash-bar-track" style={{ background: token.colorFillTertiary }}>
                <div
                  className="dash-bar-fill"
                  style={{ width: `${Math.max(ratio > 0 ? 2 : 0, ratio * 100)}%`, background: it.color, animationDelay: `${idx * 60}ms` }}
                />
              </div>
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{it.display ?? it.value.toLocaleString()}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
