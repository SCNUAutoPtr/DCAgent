import { useMemo, useState } from 'react';
import { Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import type { PortAdminState, PortType } from '@contracts/enums';
import { formatShortId } from '@contracts/shortId';
import { PORT_ICONS } from '@/constants/portIcons';
import { PORT_TYPE_INFO } from '@/constants/portTypes';
import { layoutPorts, panelSizeMm, type PortGeometry } from '@/utils/panelLayoutGenerator';
import { PORT_STATE_COLORS, portVisualState, type PortVisualState } from './portState';
import './PanelView.css';

/** What PanelView needs of a port; PortDto satisfies it, template drafts too (state fields optional). */
export interface PanelViewPort {
  id: string;
  number: string;
  portType: PortType;
  ifName?: string | null;
  label?: string | null;
  xMm: number | null;
  yMm: number | null;
  wMm: number | null;
  hMm: number | null;
  rotation: number;
  adminState?: PortAdminState;
  connected?: boolean;
  hasModule?: boolean;
  endpoint?: { label: { shortId: number } | null } | null;
}

interface PanelViewProps<P extends PanelViewPort> {
  panel: { name: string; widthMm: number | null; heightMm: number | null };
  ports: P[];
  onPortClick?: (port: P) => void;
  onPortContextMenu?: (port: P, e: React.MouseEvent) => void;
  highlightedPortIds?: string[];
  /** pixels per millimetre */
  scale?: number;
  labelMode?: 'always' | 'hover';
  showHeader?: boolean;
  showLegend?: boolean;
}

/** Read-only front view of a panel: SVG in millimetres, ports coloured by derived state. */
export function PanelView<P extends PanelViewPort>({
  panel,
  ports,
  onPortClick,
  onPortContextMenu,
  highlightedPortIds = [],
  scale = 1,
  labelMode = 'hover',
  showHeader = true,
  showLegend = true,
}: PanelViewProps<P>) {
  const { t } = useTranslation('panel');
  const [hovered, setHovered] = useState<string | null>(null);
  const { w, h } = panelSizeMm(panel);
  const laid = useMemo(() => layoutPorts(ports, w, h), [ports, w, h]);

  const renderPort = (port: P & PortGeometry) => {
    const { xMm: x, yMm: y, wMm: pw, hMm: ph } = port;
    const state = portVisualState(port);
    const highlighted = highlightedPortIds.includes(port.id);
    const info = PORT_TYPE_INFO[port.portType];
    const cx = x + pw / 2;
    const cy = y + ph / 2;
    const showLabel = labelMode === 'always' || hovered === port.id;
    const labelAbove = y > h / 2;
    const plug = port.endpoint?.label ? formatShortId(port.endpoint.label.shortId) : null;
    return (
      <Tooltip
        key={port.id}
        title={
          <div>
            <div>
              <strong>{port.label || port.number}</strong>
            </div>
            <div>
              {t('view.number')}: {port.number}
            </div>
            {port.ifName && (
              <div>
                {t('view.ifName')}: {port.ifName}
              </div>
            )}
            <div>
              {t('view.type')}: {info.label} ({t(`portTypes.${port.portType}`)})
            </div>
            <div>
              {t('view.state')}: {t(`view.portStates.${state}`)}
            </div>
            {plug && (
              <div>
                {t('view.plug')}: <strong>{plug}</strong>
              </div>
            )}
            {port.hasModule && (
              <div>
                {t('view.module')}: {t('view.yes')}
              </div>
            )}
          </div>
        }
      >
        <g
          className="panel-view-port"
          data-testid={`panel-port-${port.number}`}
          data-state={state}
          transform={`rotate(${port.rotation} ${cx} ${cy})`}
        >
          {highlighted && (
            <rect x={x - 3} y={y - 3} width={pw + 6} height={ph + 6} rx={2} fill="none" stroke="#1890ff" strokeWidth={2} className="panel-view-highlight" />
          )}
          <svg x={x} y={y} width={pw} height={ph} viewBox={`0 0 ${info.w} ${info.h}`} preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
            <g dangerouslySetInnerHTML={{ __html: PORT_ICONS[port.portType] }} />
          </svg>
          <rect x={x} y={y} width={pw} height={ph} rx={1} fill="none" stroke={highlighted ? '#1890ff' : PORT_STATE_COLORS[state]} strokeWidth={highlighted ? 1.5 : 1} />
          {port.hasModule && <circle cx={x + pw - 1.5} cy={y + 1.5} r={1.2} fill="#fadb14" stroke="#ad8b00" strokeWidth={0.3} />}
          {showLabel && (
            <text x={cx} y={labelAbove ? y - 1.5 : y + ph + 4.5} textAnchor="middle" fontSize={4} fontWeight="bold" fill="#333" className="panel-view-label">
              {port.number}
            </text>
          )}
          <rect
            x={x}
            y={y}
            width={pw}
            height={ph}
            fill="transparent"
            style={{ cursor: onPortClick ? 'pointer' : 'default' }}
            data-testid={`panel-port-hitbox-${port.number}`}
            onClick={() => onPortClick?.(port)}
            onContextMenu={onPortContextMenu ? (e) => onPortContextMenu(port, e) : undefined}
            onMouseEnter={() => setHovered(port.id)}
            onMouseLeave={() => setHovered(null)}
          />
        </g>
      </Tooltip>
    );
  };

  return (
    <div className="panel-view" data-testid="panel-view">
      {showHeader && (
        <div className="panel-view-header">
          <strong>{panel.name}</strong>
          <span className="panel-view-meta">
            {t('view.size', { w, h })}
            {ports.length === 0 && ` · ${t('view.noPorts')}`}
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} width={w * scale} height={h * scale} className="panel-view-svg">
        <rect x={0} y={0} width={w} height={h} fill="#f5f5f5" />
        {laid.map(renderPort)}
      </svg>
      {showLegend && (
        <div className="panel-view-legend">
          {(Object.keys(PORT_STATE_COLORS) as PortVisualState[]).map((s) => (
            <span key={s} className="panel-view-legend-item">
              <span className="panel-view-legend-swatch" style={{ borderColor: PORT_STATE_COLORS[s] }} />
              {t(`view.portStates.${s}`)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
