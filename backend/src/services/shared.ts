// Shared include shapes, path builders and small DTO helpers.
import type { Prisma } from '@prisma/client';
import type { LabelRef, PathNode } from '../contracts/common';

export const iso = (d: Date) => d.toISOString();
export const isoOrNull = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function labelRef(l: { shortId: number; state: LabelRef['state'] } | null | undefined): LabelRef | null {
  return l ? { shortId: l.shortId, state: l.state } : null;
}

export const labelSelect = { select: { shortId: true, state: true } } as const;

// ---------- location includes ----------

export const roomLoc = { include: { dataCenter: true } } as const;
export const deviceLocInclude = {
  cabinet: { include: { room: roomLoc } },
  room: roomLoc,
} as const satisfies Prisma.DeviceInclude;
export const panelLocInclude = { device: { include: deviceLocInclude } } as const satisfies Prisma.PanelInclude;
export const portLocInclude = { panel: { include: panelLocInclude } } as const satisfies Prisma.PortInclude;
export const endpointInclude = {
  label: labelSelect,
  port: { include: portLocInclude },
  parkedPanel: { include: panelLocInclude },
} as const satisfies Prisma.CableEndpointInclude;

// ---------- structural shapes ----------

interface Named {
  id: string;
  name: string;
}
export interface RoomLike extends Named {
  dataCenter: Named;
}
export interface CabinetLike extends Named {
  room: RoomLike;
}
export interface DeviceLike extends Named {
  cabinet: CabinetLike | null;
  room: RoomLike | null;
}
export interface PanelLike extends Named {
  device: DeviceLike;
}
export interface PortLike {
  id: string;
  number: string;
  panel: PanelLike;
}

export function roomPath(r: RoomLike): PathNode[] {
  return [
    { kind: 'DATACENTER', id: r.dataCenter.id, name: r.dataCenter.name },
    { kind: 'ROOM', id: r.id, name: r.name },
  ];
}

export function cabinetPath(c: CabinetLike): PathNode[] {
  return [...roomPath(c.room), { kind: 'CABINET', id: c.id, name: c.name }];
}

export function deviceRoom(d: DeviceLike): RoomLike | null {
  return d.cabinet?.room ?? d.room ?? null;
}

export function devicePath(d: DeviceLike): PathNode[] {
  const base = d.cabinet ? cabinetPath(d.cabinet) : d.room ? roomPath(d.room) : [];
  return [...base, { kind: 'DEVICE', id: d.id, name: d.name }];
}

export function panelPath(p: PanelLike): PathNode[] {
  return [...devicePath(p.device), { kind: 'PANEL', id: p.id, name: p.name }];
}

export function portPath(p: PortLike): PathNode[] {
  return [...panelPath(p.panel), { kind: 'PORT', id: p.id, name: p.number }];
}

export interface EndpointLike {
  id: string;
  cableId: string;
  end: string;
  port: PortLike | null;
  parkedPanel: PanelLike | null;
}

export function endpointPath(e: EndpointLike, cableName: string): PathNode[] {
  const base = e.port ? portPath(e.port) : e.parkedPanel ? panelPath(e.parkedPanel) : [];
  return [
    ...base,
    { kind: 'CABLE', id: e.cableId, name: cableName },
    { kind: 'CABLE_ENDPOINT', id: e.id, name: e.end },
  ];
}

export function locationText(path: PathNode[]): string {
  return path
    .filter((n) => n.kind !== 'DATACENTER')
    .map((n) => n.name)
    .join(' / ');
}
