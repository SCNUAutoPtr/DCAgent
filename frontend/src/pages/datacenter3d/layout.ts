// Pure layout maths for the 3D room view. No three.js here so it can be unit tested with plain node
// (scripts/datacenter3d-layout.test.mts).
//
// Room coordinates (contracts/scene.ts): metres, origin at the room's top-left corner, x to the right,
// y into the room. In the 3D world room x -> world x, room y -> world z, up is world y.
// (fpX,fpY) is the top-left corner of the cabinet's footprint as drawn on the floor plan; for 90/270
// the footprint is d x w. fpRotation 0 = front faces +y on the plan (world +z, towards the default camera), 90 = front faces -x.
import type { CableMedium, DeviceType } from '@contracts/enums';
import type { SceneCabinet, SceneDevice, SceneWorkstation } from '@contracts/scene';
import { effectiveUHeight, topU } from '@contracts/rack';
import {
  DEFAULT_CABINET_DEPTH_M,
  DEFAULT_CABINET_WIDTH_M,
  DEFAULT_WORKSTATION_DEPTH_M,
  DEFAULT_WORKSTATION_WIDTH_M,
  U_HEIGHT_MM,
} from '@contracts/scene';

export const U_M = U_HEIGHT_MM / 1000;
/** plinth below U1 and roof above the top U */
export const CABINET_BASE_M = 0.06;
export const CABINET_TOP_M = 0.06;
/** gap between the cabinet's front edge and the device fronts */
export const RAIL_INSET_M = 0.03;
const GRID_PER_ROW = 8;
const GRID_AISLE_M = 1.2;
const ROOM_MARGIN_M = 1;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CabinetPlacement {
  id: string;
  /** footprint centre in world x/z */
  cx: number;
  cz: number;
  /** cabinet width and depth in its own frame (before rotation) */
  w: number;
  d: number;
  heightM: number;
  /** degrees, 0/90/180/270 */
  rotation: number;
  /** true when the cabinet had no floor plan position and was put on the auto grid */
  auto: boolean;
}

export const cabinetHeightM = (heightU: number) => CABINET_BASE_M + heightU * U_M + CABINET_TOP_M;

const isSideways = (rotation: number) => rotation === 90 || rotation === 270;

/**
 * Places every cabinet: by floor plan coordinates when it has them, otherwise on a grid below everything
 * already on the plan (positioned cabinets and the workstations passed as obstacles).
 */
export function placeCabinets(
  cabinets: SceneCabinet[],
  room: { widthM: number | null; depthM: number | null },
  obstacles: SceneWorkstation[] = [],
): { placements: Map<string, CabinetPlacement>; roomW: number; roomD: number } {
  const placements = new Map<string, CabinetPlacement>();
  let maxX = 0;
  let maxZ = 0;
  for (const o of obstacles) {
    if (o.fpX == null || o.fpY == null) continue;
    maxX = Math.max(maxX, o.fpX + (o.fpW ?? DEFAULT_WORKSTATION_WIDTH_M));
    maxZ = Math.max(maxZ, o.fpY + (o.fpD ?? DEFAULT_WORKSTATION_DEPTH_M));
  }
  const grow = (p: CabinetPlacement) => {
    const [fw, fd] = isSideways(p.rotation) ? [p.d, p.w] : [p.w, p.d];
    maxX = Math.max(maxX, p.cx + fw / 2);
    maxZ = Math.max(maxZ, p.cz + fd / 2);
  };

  const pending: SceneCabinet[] = [];
  for (const c of cabinets) {
    if (c.fpX == null || c.fpY == null) {
      pending.push(c);
      continue;
    }
    const w = c.fpW ?? DEFAULT_CABINET_WIDTH_M;
    const d = c.fpD ?? DEFAULT_CABINET_DEPTH_M;
    const [fw, fd] = isSideways(c.fpRotation) ? [d, w] : [w, d];
    const p: CabinetPlacement = {
      id: c.id,
      cx: c.fpX + fw / 2,
      cz: c.fpY + fd / 2,
      w,
      d,
      heightM: cabinetHeightM(c.heightU),
      rotation: c.fpRotation,
      auto: false,
    };
    placements.set(c.id, p);
    grow(p);
  }

  // auto grid: rows of cabinets side by side, an aisle between rows, below whatever is positioned
  const top = maxZ > 0 ? maxZ + GRID_AISLE_M + 0.3 : ROOM_MARGIN_M;
  const cellW = Math.max(DEFAULT_CABINET_WIDTH_M, ...pending.map((c) => c.fpW ?? DEFAULT_CABINET_WIDTH_M));
  const cellD = Math.max(DEFAULT_CABINET_DEPTH_M, ...pending.map((c) => c.fpD ?? DEFAULT_CABINET_DEPTH_M));
  pending.forEach((c, i) => {
    const col = i % GRID_PER_ROW;
    const row = Math.floor(i / GRID_PER_ROW);
    const p: CabinetPlacement = {
      id: c.id,
      cx: ROOM_MARGIN_M + col * cellW + cellW / 2,
      cz: top + row * (cellD + GRID_AISLE_M) + cellD / 2,
      w: c.fpW ?? DEFAULT_CABINET_WIDTH_M,
      d: c.fpD ?? DEFAULT_CABINET_DEPTH_M,
      heightM: cabinetHeightM(c.heightU),
      rotation: 0,
      auto: true,
    };
    placements.set(c.id, p);
    grow(p);
  });

  return {
    placements,
    roomW: Math.max(room.widthM ?? 0, maxX + ROOM_MARGIN_M),
    roomD: Math.max(room.depthM ?? 0, maxZ + ROOM_MARGIN_M),
  };
}

/** three.js rotation.y of a cabinet group: the local front (-z) points to world +z at 0 and turns clockwise on the plan as fpRotation grows. */
export const cabinetYaw = (rotation: number) => Math.PI - (rotation * Math.PI) / 180;

/** A point in the cabinet's own frame (x across, y up from the floor, z front=-d/2 .. rear=+d/2) to world. */
export function toWorld(p: CabinetPlacement, x: number, y: number, z: number): Vec3 {
  const t = cabinetYaw(p.rotation);
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  return { x: p.cx + x * cos + z * sin, y, z: p.cz - x * sin + z * cos };
}

export interface DeviceBox {
  /** bottom of the device above the floor */
  y0: number;
  h: number;
  /** the box spans the rails, front aligned */
  w: number;
  depth: number;
  zCenter: number;
}

/** Box of a racked device in the cabinet frame; null when it has no U position or does not fit. */
export function deviceBox(p: CabinetPlacement, heightU: number, d: SceneDevice): DeviceBox | null {
  if (d.uPosition == null || d.uPosition < 1 || topU(d.uPosition, d.uHeight) > heightU) return null;
  const maxDepth = p.d - 2 * RAIL_INSET_M;
  const modelDepth = d.deviceModel?.depthMm ? d.deviceModel.depthMm / 1000 : p.d * 0.7;
  const depth = Math.min(Math.max(modelDepth, 0.1), maxDepth);
  return {
    y0: CABINET_BASE_M + (d.uPosition - 1) * U_M,
    h: effectiveUHeight(d.uHeight) * U_M - 0.004,
    w: p.w - 0.08,
    depth,
    zCenter: -p.d / 2 + RAIL_INSET_M + depth / 2,
  };
}

export function portUsage(d: SceneDevice): { total: number; connected: number; ratio: number | null } {
  const total = d.panels.reduce((s, p) => s + p.portCount, 0);
  const connected = d.panels.reduce((s, p) => s + p.connectedCount, 0);
  return { total, connected, ratio: total ? connected / total : null };
}

export function uUsage(c: SceneCabinet): { used: number; total: number; ratio: number } {
  const used = c.devices.filter((d) => d.uPosition != null).reduce((s, d) => s + effectiveUHeight(d.uHeight), 0);
  return { used, total: c.heightU, ratio: c.heightU ? used / c.heightU : 0 };
}

/** Control point of the quadratic arc between two cable ends: above both, higher for longer runs. */
export function arcControl(a: Vec3, b: Vec3): Vec3 {
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  return { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 0.25 + dist * 0.25, z: (a.z + b.z) / 2 };
}

// ---------- colours ----------

export const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  SERVER: '#4f8cff',
  SWITCH: '#2ec4b6',
  ROUTER: '#f4a261',
  FIREWALL: '#e5484d',
  STORAGE: '#a78bfa',
  PDU: '#f5c542',
  OTHER: '#8d99ae',
};

export const MEDIUM_COLORS: Record<CableMedium, string> = {
  CAT5E: '#38bdf8',
  CAT6: '#38bdf8',
  CAT6A: '#22d3ee',
  CAT7: '#22d3ee',
  FIBER_SM: '#facc15',
  FIBER_MM: '#fb923c',
  DAC: '#cbd5e1',
  AOC: '#e879f9',
  POWER: '#f87171',
  OTHER: '#94a3b8',
};

export const NO_DATA_COLOR = '#5c6370';
const LOW = [0x2e, 0xcc, 0x71];
const MID = [0xf1, 0xc4, 0x0f];
const HIGH = [0xe7, 0x4c, 0x3c];

const hex = (rgb: number[]) => `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);

/** green (idle) -> yellow -> red (full); grey when there is nothing to measure */
export function occupancyColor(ratio: number | null): string {
  if (ratio == null) return NO_DATA_COLOR;
  const r = Math.min(Math.max(ratio, 0), 1);
  return r < 0.5 ? hex(mix(LOW, MID, r * 2)) : hex(mix(MID, HIGH, (r - 0.5) * 2));
}

export type ColorMode = 'type' | 'occupancy';

export const BACKGROUND = '#0b1020';

export function deviceColor(d: SceneDevice, mode: ColorMode): string {
  return mode === 'type' ? DEVICE_TYPE_COLORS[d.type] : occupancyColor(portUsage(d).ratio);
}
