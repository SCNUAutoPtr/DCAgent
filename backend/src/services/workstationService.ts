import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must } from '../http/errors';
import { env } from '../config/env';
import type { Paged } from '../contracts/common';
import {
  isOnline,
  type WorkstationDto,
  workstationCreateSchema,
  workstationListSchema,
  workstationUpdateSchema,
} from '../contracts/workstations';
import type { WorkstationAdminState } from '../contracts/enums';
import { iso, isoOrNull } from './shared';

export const workstationInclude = {
  room: { select: { name: true } },
  ipAddress: { select: { id: true, address: true, macAddress: true, subnetId: true } },
  attachedPort: { select: { id: true, number: true, ifName: true, panel: { select: { device: { select: { id: true, name: true, sysname: true } } } } } },
} as const satisfies Prisma.WorkstationInclude;
export type WorkstationRow = Prisma.WorkstationGetPayload<{ include: typeof workstationInclude }>;

export function workstationDto(w: WorkstationRow, now = Date.now()): WorkstationDto {
  const staleMs = env.ONLINE_STALE_MINUTES * 60_000;
  return {
    id: w.id,
    name: w.name,
    code: w.code,
    roomId: w.roomId,
    roomName: w.room.name,
    cpu: w.cpu,
    memory: w.memory,
    storage: w.storage,
    gpu: w.gpu,
    os: w.os,
    adminState: w.adminState,
    assignedTo: w.assignedTo,
    fpX: w.fpX,
    fpY: w.fpY,
    fpW: w.fpW,
    fpD: w.fpD,
    notes: w.notes,
    online: isOnline(w.lastSeenAt, w.lastCheckedAt),
    stale: !w.lastCheckedAt || now - w.lastCheckedAt.getTime() > staleMs,
    lastSeenAt: isoOrNull(w.lastSeenAt),
    lastCheckedAt: isoOrNull(w.lastCheckedAt),
    ip: w.ipAddress,
    attachedPort: w.attachedPort
      ? {
          id: w.attachedPort.id,
          number: w.attachedPort.number,
          ifName: w.attachedPort.ifName,
          deviceId: w.attachedPort.panel.device.id,
          deviceName: w.attachedPort.panel.device.name,
          sysname: w.attachedPort.panel.device.sysname,
        }
      : null,
    createdAt: iso(w.createdAt),
    updatedAt: iso(w.updatedAt),
  };
}

async function get(db: Db, id: string) {
  return workstationDto(must(await db.workstation.findUnique({ where: { id }, include: workstationInclude }), 'workstation', { id }));
}

const normMac = (mac: string | null | undefined) =>
  mac ? mac.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().match(/../g)!.join(':') : null;

/** Replace the workstation's address; the subnet is the one containing it unless given. */
async function setIp(db: Db, workstationId: string, ip: { address: string; subnetId?: string; macAddress?: string | null } | null) {
  await db.ipAddress.deleteMany({ where: { workstationId } });
  if (!ip) return;
  let subnetId = ip.subnetId;
  if (!subnetId) {
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT id FROM "IpSubnet" WHERE set_masklen("network", "prefixLen") >> ${ip.address}::inet ORDER BY "prefixLen" DESC LIMIT 1`;
    if (!rows.length) throw new AppError('IP_OUT_OF_SUBNET', 'no subnet contains this address', { address: ip.address });
    subnetId = rows[0].id;
  }
  await db.ipAddress.create({ data: { subnetId, address: ip.address, macAddress: normMac(ip.macAddress), workstationId, status: 'ALLOCATED' } });
}

export const workstationService = {
  async list(db: Db, input: z.infer<typeof workstationListSchema>): Promise<Paged<WorkstationDto>> {
    const s = input.search ? { contains: input.search, mode: 'insensitive' as const } : undefined;
    const where: Prisma.WorkstationWhereInput = {
      roomId: input.roomId,
      ...(s ? { OR: [{ name: s }, { code: s }, { assignedTo: s }, { notes: s }] } : {}),
    };
    const [rows, total] = await Promise.all([
      db.workstation.findMany({ where, include: workstationInclude, orderBy: { name: 'asc' }, take: input.take, skip: input.skip }),
      db.workstation.count({ where }),
    ]);
    const now = Date.now();
    return { items: rows.map((w) => workstationDto(w, now)), total };
  },
  get,
  async byCode(db: Db, code: string) {
    return workstationDto(must(await db.workstation.findUnique({ where: { code }, include: workstationInclude }), 'workstation', { code }));
  },
  async create(db: Db, { ip, ...data }: z.infer<typeof workstationCreateSchema>) {
    must(await db.room.findUnique({ where: { id: data.roomId } }), 'room', { id: data.roomId });
    const w = await db.workstation.create({ data });
    if (ip) await setIp(db, w.id, ip);
    return get(db, w.id);
  },
  async update(db: Db, { id, ip, ...data }: z.infer<typeof workstationUpdateSchema>) {
    must(await db.workstation.findUnique({ where: { id } }), 'workstation', { id });
    if (data.attachedPortId) must(await db.port.findUnique({ where: { id: data.attachedPortId }, select: { id: true } }), 'port', { id: data.attachedPortId });
    await db.workstation.update({ where: { id }, data });
    if (ip !== undefined) await setIp(db, id, ip);
    return get(db, id);
  },
  async setAdminState(db: Db, id: string, adminState: WorkstationAdminState) {
    must(await db.workstation.findUnique({ where: { id } }), 'workstation', { id });
    await db.workstation.update({ where: { id }, data: { adminState } });
    return get(db, id);
  },
  /** The workstation's own address goes with it. */
  async delete(db: Db, id: string) {
    must(await db.workstation.findUnique({ where: { id } }), 'workstation', { id });
    await db.ipAddress.deleteMany({ where: { workstationId: id } });
    await db.workstation.delete({ where: { id } });
    return { ok: true as const };
  },
};
