import type { PortType } from '@contracts/enums';
import { PORT_SIZE_MM } from '@contracts/portSizes';
import { U_HEIGHT_MM } from '@contracts/scene';

/** A 19" 1U front plate. */
export const DEFAULT_PANEL_MM = { w: 482.6, h: U_HEIGHT_MM };

export interface PortGeometry {
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotation: number;
}

export interface LayoutInput {
  portType: PortType;
  xMm: number | null;
  yMm: number | null;
  wMm: number | null;
  hMm: number | null;
  rotation: number;
}

export function panelSizeMm(panel: { widthMm: number | null; heightMm: number | null }) {
  return { w: panel.widthMm ?? DEFAULT_PANEL_MM.w, h: panel.heightMm ?? DEFAULT_PANEL_MM.h };
}

const hasGeometry = (p: LayoutInput) => p.xMm !== null && p.yMm !== null && p.wMm !== null && p.hMm !== null;

const SIDE_MARGIN = 20;
const GAP = 2;

/**
 * Fills in geometry for ports that have none (migrated data has no layout), sized by port type.
 * More than 8 such ports: switch style, two rows with odd numbers on top. Otherwise one centred row.
 * Ports that already have geometry keep it. Input order is the display order (sortIndex).
 */
export function layoutPorts<T extends LayoutInput>(ports: T[], panelW: number, panelH: number): (T & PortGeometry)[] {
  const auto = ports.filter((p) => !hasGeometry(p));
  const rows = auto.length > 8 ? 2 : 1;
  const cols = Math.ceil(auto.length / rows);
  const cellW = Math.max(0, ...auto.map((p) => PORT_SIZE_MM[p.portType].w));
  const cellH = Math.max(0, ...auto.map((p) => PORT_SIZE_MM[p.portType].h));
  const avail = panelW - 2 * SIDE_MARGIN;
  const pitchX = cols > 1 ? Math.min(cellW + GAP, (avail - cellW) / (cols - 1)) : 0;
  const rowW = cols > 0 ? (cols - 1) * pitchX + cellW : 0;
  const startX = (panelW - rowW) / 2;
  const rowGap = rows > 1 ? Math.max(1, Math.min(GAP * 2, panelH - 2 * cellH - 4)) : 0;
  const totalH = rows * cellH + (rows - 1) * rowGap;
  const startY = Math.max(0, (panelH - totalH) / 2);

  let i = 0;
  return ports.map((p) => {
    if (hasGeometry(p)) return { ...p, xMm: p.xMm!, yMm: p.yMm!, wMm: p.wMm!, hMm: p.hMm!, rotation: p.rotation };
    const idx = i++;
    const col = rows === 2 ? Math.floor(idx / 2) : idx;
    const row = rows === 2 ? idx % 2 : 0;
    const size = PORT_SIZE_MM[p.portType];
    return {
      ...p,
      xMm: startX + col * pitchX + (cellW - size.w) / 2,
      yMm: startY + row * (cellH + rowGap) + (cellH - size.h) / 2,
      wMm: size.w,
      hMm: size.h,
      rotation: p.rotation,
    };
  });
}
