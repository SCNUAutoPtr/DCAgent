import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must } from '../http/errors';
import type {
  CabinetDetailDto,
  CabinetDto,
  DataCenterDto,
  RoomDto,
  cabinetCreateSchema,
  cabinetListSchema,
  cabinetUpdateSchema,
  dataCenterCreateSchema,
  dataCenterListSchema,
  dataCenterUpdateSchema,
  roomCreateSchema,
  roomListSchema,
  roomUpdateSchema,
} from '../contracts/hierarchy';
import type { RoomScene, SceneDevice, SceneLink } from '../contracts/scene';
import { isOnline } from '../contracts/workstations';
import { effectiveUHeight, topU } from '../contracts/rack';
import { labelService } from './labelService';
import { cabinetPath, iso, labelRef, labelSelect, roomLoc } from './shared';

const contains = (search?: string) => (search ? { contains: search, mode: 'insensitive' as const } : undefined);

// ---------- data centers ----------

type DcRow = Prisma.DataCenterGetPayload<{ include: { _count: { select: { rooms: true } } } }>;
const dcDto = (d: DcRow): DataCenterDto => ({
  id: d.id,
  name: d.name,
  location: d.location,
  roomCount: d._count.rooms,
  createdAt: iso(d.createdAt),
  updatedAt: iso(d.updatedAt),
});
const dcInclude = { _count: { select: { rooms: true } } } as const;

async function getDataCenter(db: Db, id: string) {
  return dcDto(must(await db.dataCenter.findUnique({ where: { id }, include: dcInclude }), 'data center', { id }));
}

export const dataCenterService = {
  async list(db: Db, input: z.infer<typeof dataCenterListSchema>) {
    const rows = await db.dataCenter.findMany({
      where: input.search ? { OR: [{ name: contains(input.search) }, { location: contains(input.search) }] } : {},
      include: dcInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(dcDto);
  },
  get: getDataCenter,
  async create(db: Db, input: z.infer<typeof dataCenterCreateSchema>) {
    const d = await db.dataCenter.create({ data: input });
    return getDataCenter(db, d.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof dataCenterUpdateSchema>) {
    must(await db.dataCenter.findUnique({ where: { id } }), 'data center', { id });
    await db.dataCenter.update({ where: { id }, data });
    return getDataCenter(db, id);
  },
  async delete(db: Db, id: string) {
    const d = must(await db.dataCenter.findUnique({ where: { id }, include: { rooms: { select: { id: true, name: true } } } }), 'data center', { id });
    if (d.rooms.length) throw new AppError('NOT_EMPTY', 'data center still has rooms', { rooms: d.rooms });
    await db.dataCenter.delete({ where: { id } });
    return { ok: true as const };
  },
};

// ---------- rooms ----------

const roomInclude = {
  dataCenter: { select: { name: true } },
  label: labelSelect,
  _count: { select: { cabinets: true, devices: true, workstations: true } },
} as const;
type RoomRow = Prisma.RoomGetPayload<{ include: typeof roomInclude }>;

/** Workstations with a floor-plan position per room: the seat map can only draw those. */
async function seatLayoutCounts(db: Db, roomIds: string[]): Promise<Map<string, number>> {
  if (!roomIds.length) return new Map();
  const rows = await db.workstation.groupBy({ by: ['roomId'], where: { roomId: { in: roomIds }, fpX: { not: null } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.roomId, r._count._all]));
}

const roomDto = (r: RoomRow, seats: Map<string, number>): RoomDto => ({
  id: r.id,
  name: r.name,
  floor: r.floor,
  notes: r.notes,
  dataCenterId: r.dataCenterId,
  dataCenterName: r.dataCenter.name,
  widthM: r.widthM,
  depthM: r.depthM,
  label: labelRef(r.label),
  cabinetCount: r._count.cabinets,
  deviceCount: r._count.devices,
  workstationCount: r._count.workstations,
  seatLayoutCount: seats.get(r.id) ?? 0,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

async function getRoom(db: Db, id: string) {
  const r = must(await db.room.findUnique({ where: { id }, include: roomInclude }), 'room', { id });
  return roomDto(r, await seatLayoutCounts(db, [r.id]));
}

async function roomScene(db: Db, roomId: string): Promise<RoomScene> {
  const deviceInclude = {
    deviceModel: { select: { id: true, name: true, depthMm: true } },
    panels: {
      orderBy: { name: 'asc' as const },
      select: { id: true, name: true, face: true, _count: { select: { ports: true } } },
    },
  } as const;
  const room = must(
    await db.room.findUnique({
      where: { id: roomId },
      include: {
        cabinets: { include: { label: labelSelect, devices: { include: deviceInclude, orderBy: { uPosition: 'asc' } } }, orderBy: { name: 'asc' } },
        devices: { include: deviceInclude, orderBy: { name: 'asc' } },
        workstations: { orderBy: { name: 'asc' } },
      },
    }),
    'room',
    { roomId },
  );
  const panelIds = [...room.cabinets.flatMap((c) => c.devices), ...room.devices].flatMap((d) => d.panels.map((p) => p.id));
  const connected = panelIds.length
    ? await db.port.groupBy({ by: ['panelId'], where: { panelId: { in: panelIds }, cableEndpoint: { isNot: null } }, _count: { _all: true } })
    : [];
  const connectedBy = new Map(connected.map((c) => [c.panelId, c._count._all]));
  const { links, externalLinkCount } = await sceneLinks(db, panelIds);
  type D = (typeof room.devices)[number];
  const device = (d: D): SceneDevice => ({
    id: d.id,
    name: d.name,
    type: d.type,
    uPosition: d.uPosition,
    uHeight: d.uHeight,
    deviceModel: d.deviceModel,
    panels: d.panels.map((p) => ({ id: p.id, name: p.name, face: p.face, portCount: p._count.ports, connectedCount: connectedBy.get(p.id) ?? 0 })),
  });
  return {
    room: { id: room.id, name: room.name, widthM: room.widthM, depthM: room.depthM },
    cabinets: room.cabinets.map((c) => ({
      id: c.id,
      name: c.name,
      label: labelRef(c.label),
      fpX: c.fpX,
      fpY: c.fpY,
      fpW: c.fpW,
      fpD: c.fpD,
      fpRotation: c.fpRotation,
      heightU: c.heightU,
      devices: c.devices.map(device),
    })),
    looseDevices: room.devices.map(device),
    workstations: room.workstations.map((w) => ({
      id: w.id,
      name: w.name,
      fpX: w.fpX,
      fpY: w.fpY,
      fpW: w.fpW,
      fpD: w.fpD,
      online: isOnline(w.lastSeenAt, w.lastCheckedAt),
      adminState: w.adminState,
    })),
    links,
    externalLinkCount,
  };
}

/** Cables touching the given panels: fully inside the room become links, the others are only counted. */
async function sceneLinks(db: Db, panelIds: string[]): Promise<{ links: SceneLink[]; externalLinkCount: number }> {
  if (!panelIds.length) return { links: [], externalLinkCount: 0 };
  const inRoom = new Set(panelIds);
  const cables = await db.cable.findMany({
    where: { endpoints: { some: { port: { panelId: { in: panelIds } } } } },
    select: {
      id: true,
      medium: true,
      endpoints: { orderBy: { end: 'asc' }, select: { port: { select: { panelId: true, panel: { select: { deviceId: true, face: true } } } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const links: SceneLink[] = [];
  let externalLinkCount = 0;
  for (const c of cables) {
    const ports = c.endpoints.map((e) => e.port).filter((p): p is NonNullable<typeof p> => p !== null);
    if (ports.length !== 2) continue;
    if (!ports.every((p) => inRoom.has(p.panelId))) {
      externalLinkCount++;
      continue;
    }
    const [a, b] = ports.map((p) => p.panel);
    links.push({ cableId: c.id, medium: c.medium, aDeviceId: a.deviceId, aFace: a.face, bDeviceId: b.deviceId, bFace: b.face });
  }
  return { links, externalLinkCount };
}

export const roomService = {
  async list(db: Db, input: z.infer<typeof roomListSchema>) {
    const rows = await db.room.findMany({
      where: {
        dataCenterId: input.dataCenterId,
        ...(input.search ? { OR: [{ name: contains(input.search) }, { floor: contains(input.search) }, { notes: contains(input.search) }] } : {}),
      },
      include: roomInclude,
      orderBy: { name: 'asc' },
    });
    const seats = await seatLayoutCounts(db, rows.map((r) => r.id));
    return rows.map((r) => roomDto(r, seats));
  },
  get: getRoom,
  async create(db: Db, { labelShortId, ...data }: z.infer<typeof roomCreateSchema>) {
    must(await db.dataCenter.findUnique({ where: { id: data.dataCenterId } }), 'data center', { id: data.dataCenterId });
    const r = await db.room.create({ data });
    if (labelShortId !== undefined) await labelService.bind(db, labelShortId, { kind: 'ROOM', id: r.id });
    return getRoom(db, r.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof roomUpdateSchema>) {
    must(await db.room.findUnique({ where: { id } }), 'room', { id });
    await db.room.update({ where: { id }, data });
    return getRoom(db, id);
  },
  async delete(db: Db, id: string) {
    const r = must(
      await db.room.findUnique({
        where: { id },
        include: {
          cabinets: { select: { id: true, name: true } },
          devices: { select: { id: true, name: true } },
          workstations: { select: { id: true, name: true }, take: 20 },
          _count: { select: { workstations: true } },
        },
      }),
      'room',
      { id },
    );
    if (r.cabinets.length || r.devices.length || r._count.workstations) {
      throw new AppError('NOT_EMPTY', 'room is not empty', {
        cabinets: r.cabinets,
        devices: r.devices,
        workstations: r.workstations,
        workstationCount: r._count.workstations,
      });
    }
    await db.room.delete({ where: { id } });
    return { ok: true as const };
  },
  scene: roomScene,
};

// ---------- cabinets ----------

const cabinetInclude = {
  room: { select: { name: true } },
  label: labelSelect,
  devices: { select: { uHeight: true, uPosition: true } },
} as const;
type CabinetRow = Prisma.CabinetGetPayload<{ include: typeof cabinetInclude }>;

const cabinetDto = (c: CabinetRow): CabinetDto => ({
  id: c.id,
  name: c.name,
  positionCode: c.positionCode,
  heightU: c.heightU,
  notes: c.notes,
  roomId: c.roomId,
  roomName: c.room.name,
  fpX: c.fpX,
  fpY: c.fpY,
  fpW: c.fpW,
  fpD: c.fpD,
  fpRotation: c.fpRotation,
  label: labelRef(c.label),
  deviceCount: c.devices.length,
  usedU: c.devices.reduce((s, d) => s + (d.uPosition === null ? 0 : effectiveUHeight(d.uHeight)), 0),
  createdAt: iso(c.createdAt),
  updatedAt: iso(c.updatedAt),
});

async function getCabinet(db: Db, id: string): Promise<CabinetDetailDto> {
  const c = must(
    await db.cabinet.findUnique({
      where: { id },
      include: {
        ...cabinetInclude,
        room: roomLoc,
        devices: { orderBy: [{ uPosition: 'desc' }, { name: 'asc' }], select: { id: true, name: true, type: true, uPosition: true, uHeight: true, sysname: true } },
      },
    }),
    'cabinet',
    { id },
  );
  return {
    ...cabinetDto({ ...c, room: { name: c.room.name } }),
    devices: c.devices,
    path: cabinetPath(c),
  };
}

export const cabinetService = {
  async list(db: Db, input: z.infer<typeof cabinetListSchema>) {
    const rows = await db.cabinet.findMany({
      where: {
        roomId: input.roomId,
        ...(input.search ? { OR: [{ name: contains(input.search) }, { positionCode: contains(input.search) }, { notes: contains(input.search) }] } : {}),
      },
      include: cabinetInclude,
      orderBy: { name: 'asc' },
    });
    return rows.map(cabinetDto);
  },
  get: getCabinet,
  async create(db: Db, { labelShortId, ...data }: z.infer<typeof cabinetCreateSchema>) {
    must(await db.room.findUnique({ where: { id: data.roomId } }), 'room', { id: data.roomId });
    const c = await db.cabinet.create({ data });
    await labelService.assign(db, { kind: 'CABINET', id: c.id }, labelShortId);
    return getCabinet(db, c.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof cabinetUpdateSchema>) {
    const c = must(await db.cabinet.findUnique({ where: { id }, include: { devices: { select: { uPosition: true, uHeight: true, name: true } } } }), 'cabinet', { id });
    if (data.heightU !== undefined) {
      const over = c.devices.filter((d) => d.uPosition !== null && topU(d.uPosition, d.uHeight) > data.heightU!);
      if (over.length) throw new AppError('U_OUT_OF_RANGE', 'devices would sit above the new height', { devices: over.map((d) => d.name) });
    }
    if (data.roomId && data.roomId !== c.roomId) must(await db.room.findUnique({ where: { id: data.roomId } }), 'room', { id: data.roomId });
    await db.cabinet.update({ where: { id }, data });
    return getCabinet(db, id);
  },
  async delete(db: Db, id: string) {
    const c = must(await db.cabinet.findUnique({ where: { id }, include: { devices: { select: { id: true, name: true } } } }), 'cabinet', { id });
    if (c.devices.length) throw new AppError('NOT_EMPTY', 'cabinet still has devices', { devices: c.devices });
    await db.cabinet.delete({ where: { id } });
    return { ok: true as const };
  },
};
