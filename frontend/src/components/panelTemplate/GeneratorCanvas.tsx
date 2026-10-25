import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TemplatePortDraft } from '@contracts/panelGenerator';
import { PORT_ICONS } from '@/constants/portIcons';
import { PORT_TYPE_INFO } from '@/constants/portTypes';

export interface DragResult {
  /** sortIndex - 1 of the dragged port */
  index: number;
  dxMm: number;
  dyMm: number;
  /** shift held: move the port's whole group */
  group: boolean;
}

interface GeneratorCanvasProps {
  widthMm: number;
  heightMm: number;
  ports: TemplatePortDraft[];
  /** generator group of each port (same order as ports) */
  groupIndex: number[];
  /** pixels per millimetre */
  scale?: number;
  onDragEnd?: (r: DragResult) => void;
}

const SNAP_MM = 0.5;
const snap = (v: number) => Math.round(v / SNAP_MM) * SNAP_MM;

/** Live preview of generated ports in millimetres. Ports can be dragged; the parent turns the move into generator changes. */
export function GeneratorCanvas({ widthMm, heightMm, ports, groupIndex, scale = 2, onDragEnd }: GeneratorCanvasProps) {
  const { t } = useTranslation('panel');
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ index: number; startX: number; startY: number; dx: number; dy: number; group: boolean } | null>(null);
  const pxPerMm = () => (svgRef.current ? svgRef.current.getBoundingClientRect().width / widthMm : scale);

  const onPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (!onDragEnd) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ index, startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, group: e.shiftKey });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const k = pxPerMm();
    setDrag({ ...drag, dx: snap((e.clientX - drag.startX) / k), dy: snap((e.clientY - drag.startY) / k) });
  };
  const onPointerUp = () => {
    if (!drag) return;
    if (drag.dx || drag.dy) onDragEnd?.({ index: drag.index, dxMm: drag.dx, dyMm: drag.dy, group: drag.group });
    setDrag(null);
  };

  /** ports of the dragged group move together while shift-dragging */
  const moving = (i: number) => !!drag && (i === drag.index || (drag.group && groupIndex[i] === groupIndex[drag.index]));

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #f0f0f0', borderRadius: 4, padding: 8, background: '#fafafa' }}>
      <svg
        ref={svgRef}
        data-testid="generator-canvas"
        viewBox={`-2 -2 ${widthMm + 4} ${heightMm + 4}`}
        width={(widthMm + 4) * scale}
        height={(heightMm + 4) * scale}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ touchAction: 'none', userSelect: 'none' }}
      >
        <rect x={0} y={0} width={widthMm} height={heightMm} fill="#e8e8e8" stroke="#8c8c8c" strokeWidth={0.4} />
        {ports.map((p, i) => {
          const off = moving(i) ? { dx: drag!.dx, dy: drag!.dy } : { dx: 0, dy: 0 };
          const x = p.xMm + off.dx;
          const y = p.yMm + off.dy;
          const out = x < 0 || y < 0 || x + p.wMm > widthMm || y + p.hMm > heightMm;
          const info = PORT_TYPE_INFO[p.portType];
          return (
            <g
              key={p.number}
              data-testid={`generator-port-${p.number}`}
              transform={`rotate(${p.rotation} ${x + p.wMm / 2} ${y + p.hMm / 2})`}
              style={{ cursor: onDragEnd ? 'move' : 'default' }}
              onPointerDown={onPointerDown(i)}
            >
              <title>{`${p.number}${p.ifName ? ` / ${p.ifName}` : ''} (${info.label})${out ? ` - ${t('generator.outside')}` : ''}`}</title>
              <svg x={x} y={y} width={p.wMm} height={p.hMm} viewBox={`0 0 ${info.w} ${info.h}`} preserveAspectRatio="none" style={{ pointerEvents: 'none' }}>
                <g dangerouslySetInnerHTML={{ __html: PORT_ICONS[p.portType] }} />
              </svg>
              <rect x={x} y={y} width={p.wMm} height={p.hMm} fill="transparent" stroke={out ? '#f5222d' : moving(i) ? '#1890ff' : 'none'} strokeWidth={0.6} />
              <text x={x + p.wMm / 2} y={y + p.hMm + 3} textAnchor="middle" fontSize={2.6} fill="#262626" style={{ pointerEvents: 'none' }}>
                {p.number}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
