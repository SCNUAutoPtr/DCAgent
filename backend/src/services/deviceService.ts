import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, invalid, must } from '../http/errors';
import type {
  DeviceDetailDto,
  DeviceDto,
  DeviceModelDto,
  deviceCreateSchema,
  deviceListSchema,
  deviceModelCreateSchema,
  deviceModelListSchema,
  deviceModelUpdateSchema,
  deviceMoveSchema,
  deviceUpdateSchema,
} from '../contracts/devices';
import { deviceLocInclude, devicePath, deviceRoom, iso } from './shared';
import { portDependents } from './portService';
import { topU } from '../contracts/rack';

const contains = (search?: string) => (search ? { contains: search, mode: 'insensitive' as const } : undefined);

// ---------- device models ----------

const modelInclude = { _count: { select: { devices: true, templates: true } } } as const;
const modelDto = (m: Prisma.DeviceModelGetPayload<{ include: typeof modelInclude }>): DeviceModelDto => ({
  id: m.id,
  vendor: m.vendor,
  name: m.name,
  deviceType: m.deviceType,
  uHeight: m.uHeight,
  depthMm: m.depthMm,
  notes: m.notes,
  deviceCount: m._count.devices,
  templateCount: m._count.templates,
});

async function getModel(db: Db, id: string) {
  return modelDto(must(await db.deviceModel.findUnique({ where: { id }, include: modelInclude }), 'device model', { id }));
}

export const deviceModelService = {
  async list(db: Db, input: z.infer<typeof deviceModelListSchema>) {
    const rows = await db.deviceModel.findMany({
      where: {
        deviceType: input.deviceType,
        ...(input.search ? { OR: [{ name: contains(input.search) }, { vendor: contains(input.search) }] } : {}),
      },
      include: modelInclude,
      orderBy: [{ vendor: 'asc' }, { name: 'asc' }],
    });
    return rows.map(modelDto);
  },
  get: getModel,
  async create(db: Db, input: z.infer<typeof deviceModelCreateSchema>) {
    const m = await db.deviceModel.create({ data: input });
    return getModel(db, m.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof deviceModelUpdateSchema>) {
    must(await db.deviceModel.findUnique({ where: { id } }), 'device model', { id });
    await db.deviceModel.update({ where: { id }, data });
    return getModel(db, id);
  },
  async delete(db: Db, id: string) {
    must(await db.deviceModel.findUnique({ where: { id } }), 'device model', { id });
    await db.deviceModel.delete({ where: { id } });
    return { ok: true as const };
  },
};

// ---------- devices ----------

const deviceInclude = {
  ...deviceLocInclude,
  deviceModel: { select: { id: true, vendor: true, name: true, uHeight: true, depthMm: true } },
  ipAddresses: { select: { id: true, address: true, status: true, description: true }, orderBy: { address: 'asc' as const } },
  _count: { select: { panels: true } },
} as const;
type DeviceRow = Prisma.DeviceGetPayload<{ include: typeof deviceInclude }>;

function deviceDto(d: DeviceRow): DeviceDto {
  const room = deviceRoom(d);
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    deviceModelId: d.deviceModelId,
    deviceModel: d.deviceModel,
    serialNo: d.serialNo,
    sysname: d.sysname,
    cabinetId: d.cabinetId,
    cabinetName: d.cabinet?.name ?? null,
    roomId: d.roomId,
    locationRoomId: room?.id ?? null,
    locationRoomName: room?.name ?? null,
    uPosition: d.uPosition,
    uHeight: d.uHeight,
    notes: d.notes,
    panelCount: d._count.panels,
    ipAddresses: d.ipAddresses,
    createdAt: iso(d.createdAt),
    updatedAt: iso(d.updatedAt),
  };
}

async function getDevice(db: Db, id: string): Promise<DeviceDetailDto> {
  const d = must(await db.device.findUnique({ where: { id }, include: deviceInclude }), 'device', { id });
  const panels = await db.panel.findMany({
    where: { deviceId: id },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, type: true, face: true, _count: { select: { ports: true } } },
  });
  const connected = await db.port.groupBy({
    by: ['panelId'],
    where: { panelId: { in: panels.map((p) => p.id) }, cableEndpoint: { isNot: null } },
    _count: { _all: true },
  });
  const by = new Map(connected.map((c) => [c.panelId, c._count._all]));
  return {
    ...deviceDto(d),
    path: devicePath(d),
    panels: panels.map((p) => ({ id: p.id, name: p.name, type: p.type, face: p.face, portCount: p._count.ports, connectedCount: by.get(p.id) ?? 0 })),
  };
}

/** U range inside the cabinet; overlap with other devices is enforced by the device_u_overlap exclusion. */
async function checkPlacement(db: Db, p: { cabinetId: string | null; roomId: string | null; uPosition: number | null; uHeight: number | null }) {
  if (p.cabinetId) {
    const cab = must(await db.cabinet.findUnique({ where: { id: p.cabinetId }, select: { heightU: true } }), 'cabinet', { id: p.cabinetId });
    if (p.uPosition !== null && topU(p.uPosition, p.uHeight) > cab.heightU) {
      throw new AppError('U_OUT_OF_RANGE', 'device does not fit into the cabinet', { uPosition: p.uPosition, uHeight: p.uHeight, heightU: cab.heightU });
    }
  } else {
    must(await db.room.findUnique({ where: { id: p.roomId! }, select: { id: true } }), 'room', { id: p.roomId });
    if (p.uPosition !== null) throw invalid('only devices in a cabinet have a U position');
  }
}

async function create(db: Db, input: z.infer<typeof deviceCreateSchema>) {
  let uHeight = input.uHeight;
  if (input.deviceModelId) {
    const model = must(await db.deviceModel.findUnique({ where: { id: input.deviceModelId } }), 'device model', { id: input.deviceModelId });
    uHeight ??= model.uHeight;
  }
  const placement = { cabinetId: input.cabinetId ?? null, roomId: input.roomId ?? null, uPosition: input.uPosition ?? null, uHeight: uHeight ?? null };
  await checkPlacement(db, placement);
  const d = await db.device.create({
    data: {
      name: input.name,
      type: input.type,
      deviceModelId: input.deviceModelId ?? null,
      serialNo: input.serialNo,
      sysname: input.sysname,
      notes: input.notes,
      ...placement,
    },
  });
  return d.id;
}

export const deviceService = {
  async list(db: Db, input: z.infer<typeof deviceListSchema>) {
    const where: Prisma.DeviceWhereInput = {
      type: input.type,
      ...(input.cabinetId ? { cabinetId: input.cabinetId } : {}),
      ...(input.roomId ? { OR: [{ roomId: input.roomId }, { cabinet: { roomId: input.roomId } }] } : {}),
      ...(input.search
        ? {
            AND: [
              {
                OR: [
                  { name: contains(input.search) },
                  { sysname: contains(input.search) },
                  { serialNo: contains(input.search) },
                  { notes: contains(input.search) },
                  { deviceModel: { name: contains(input.search) } },
                ],
              },
            ],
          }
        : {}),
    };
    const rows = await db.device.findMany({ where, include: deviceInclude, orderBy: [{ name: 'asc' }] });
    return rows.map(deviceDto);
  },
  get: getDevice,
  async create(db: Db, input: z.infer<typeof deviceCreateSchema>) {
    return getDevice(db, await create(db, input));
  },
  async bulkCreate(db: Db, devices: z.infer<typeof deviceCreateSchema>[]) {
    const ids: string[] = [];
    for (const d of devices) ids.push(await create(db, d));
    return { created: ids.length, ids };
  },
  async update(db: Db, { id, ...data }: z.infer<typeof deviceUpdateSchema>) {
    const d = must(await db.device.findUnique({ where: { id } }), 'device', { id });
    if (data.deviceModelId) must(await db.deviceModel.findUnique({ where: { id: data.deviceModelId } }), 'device model', { id: data.deviceModelId });
    const uPosition = data.uPosition === undefined ? d.uPosition : data.uPosition;
    const uHeight = data.uHeight === undefined ? d.uHeight : data.uHeight;
    await checkPlacement(db, { cabinetId: d.cabinetId, roomId: d.roomId, uPosition, uHeight });
    await db.device.update({ where: { id }, data: { ...data, uPosition } });
    return getDevice(db, id);
  },
  async move(db: Db, input: z.infer<typeof deviceMoveSchema>) {
    const d = must(await db.device.findUnique({ where: { id: input.id } }), 'device', { id: input.id });
    const placement = { cabinetId: input.cabinetId ?? null, roomId: input.roomId ?? null, uPosition: input.uPosition ?? null, uHeight: d.uHeight };
    await checkPlacement(db, placement);
    await db.device.update({ where: { id: d.id }, data: placement });
    return getDevice(db, d.id);
  },
  /**
   * Not empty -> NOT_EMPTY unless force. Not empty means: panels, port observation history, or
   * management IP addresses. Force deletes the history and unbinds the addresses explicitly (the
   * observation foreign key is RESTRICT, nothing goes silently), and still refuses ports with dependents.
   */
  async delete(db: Db, id: string, force: boolean) {
    const d = must(
      await db.device.findUnique({
        where: { id },
        include: {
          panels: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
          ipAddresses: { select: { id: true, address: true }, orderBy: { address: 'asc' } },
          _count: { select: { observations: true } },
        },
      }),
      'device',
      { id },
    );
    const observations = d._count.observations;
    if (!force && (d.panels.length || d.ipAddresses.length || observations)) {
      throw new AppError('NOT_EMPTY', 'device still has panels, observation history or IP addresses', {
        panels: d.panels,
        ipAddresses: d.ipAddresses.map((a) => ({ id: a.id, name: a.address })),
        observations,
      });
    }
    const deps = await portDependents(db, { panel: { deviceId: id } });
    if (deps.length) throw new AppError('PORT_HAS_DEPENDENTS', 'ports of this device are in use', { ports: deps });
    await db.portObservation.deleteMany({ where: { deviceId: id } });
    // unbind like a forced panel delete does: the address record (hostname, MAC, notes) stays in IP management
    await db.ipAddress.updateMany({ where: { deviceId: id }, data: { deviceId: null } });
    await db.device.delete({ where: { id } });
    return { ok: true as const };
  },
};
