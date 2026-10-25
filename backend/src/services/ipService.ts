import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must } from '../http/errors';
import {
  type IpAddressDto,
  type IpConflict,
  type IpStatistics,
  type SubnetDto,
  type SubnetUsage,
  calculateSubnet,
  ipAllocateSchema,
  ipBatchAllocateSchema,
  ipInCidr,
  ipListSchema,
  ipUpdateSchema,
  parseCidr,
  subnetCapacity,
  subnetCreateSchema,
  subnetListSchema,
  subnetUpdateSchema,
} from '../contracts/ip';
import type { IpStatus } from '../contracts/enums';
import type { Paged } from '../contracts/common';
import { iso } from './shared';


export function usageOf(prefixLen: number, counts: Partial<Record<IpStatus, number>>): SubnetUsage {
  const capacity = subnetCapacity(prefixLen);
  const allocated = counts.ALLOCATED ?? 0;
  const reserved = counts.RESERVED ?? 0;
  const blocked = counts.BLOCKED ?? 0;
  const usable = Math.max(0, capacity - reserved - blocked);
  return {
    capacity,
    allocated,
    reserved,
    blocked,
    free: Math.max(0, capacity - allocated - reserved - blocked),
    utilization: usable > 0 ? Math.round((allocated / usable) * 10_000) / 100 : 0,
  };
}

async function statusCounts(db: Db, subnetIds: string[]) {
  const rows = subnetIds.length
    ? await db.ipAddress.groupBy({ by: ['subnetId', 'status'], where: { subnetId: { in: subnetIds } }, _count: { _all: true } })
    : [];
  const out = new Map<string, Partial<Record<IpStatus, number>>>();
  for (const r of rows) {
    const m = out.get(r.subnetId) ?? {};
    m[r.status] = r._count._all;
    out.set(r.subnetId, m);
  }
  return out;
}

const subnetInclude = { room: { select: { name: true } } } as const;
type SubnetRow = Prisma.IpSubnetGetPayload<{ include: typeof subnetInclude }>;

function subnetDto(s: SubnetRow, counts: Partial<Record<IpStatus, number>>): SubnetDto {
  return {
    id: s.id,
    name: s.name,
    network: `${s.network}/${s.prefixLen}`,
    cidr: s.prefixLen,
    gateway: s.gateway,
    vlan: s.vlan,
    dnsServers: s.dnsServers,
    description: s.description,
    roomId: s.roomId,
    roomName: s.room?.name ?? null,
    usage: usageOf(s.prefixLen, counts),
    createdAt: iso(s.createdAt),
    updatedAt: iso(s.updatedAt),
  };
}

async function getSubnet(db: Db, id: string): Promise<SubnetDto> {
  const s = must(await db.ipSubnet.findUnique({ where: { id }, include: subnetInclude }), 'subnet', { id });
  return subnetDto(s, (await statusCounts(db, [id])).get(id) ?? {});
}

function splitCidr(cidr: string) {
  const c = parseCidr(cidr)!;
  return { network: c.network, prefixLen: c.prefix };
}

function checkGateway(network: string, gateway: string | null | undefined) {
  if (gateway && !ipInCidr(gateway, parseCidr(network)!)) throw new AppError('IP_OUT_OF_SUBNET', 'gateway is outside the subnet', { gateway, network });
}

export const subnetService = {
  async list(db: Db, input: z.infer<typeof subnetListSchema>) {
    const s = input.search ? { contains: input.search, mode: 'insensitive' as const } : undefined;
    const rows = await db.ipSubnet.findMany({
      where: { roomId: input.roomId, ...(s ? { OR: [{ name: s }, { description: s }] } : {}) },
      include: subnetInclude,
      orderBy: [{ network: 'asc' }, { prefixLen: 'asc' }],
    });
    const counts = await statusCounts(db, rows.map((r) => r.id));
    return rows.map((r) => subnetDto(r, counts.get(r.id) ?? {}));
  },
  get: getSubnet,
  /** Only the subnet row is written; free addresses have no rows. */
  async create(db: Db, { network, ...input }: z.infer<typeof subnetCreateSchema>) {
    checkGateway(network, input.gateway);
    if (input.roomId) must(await db.room.findUnique({ where: { id: input.roomId } }), 'room', { id: input.roomId });
    const s = await db.ipSubnet.create({ data: { ...input, ...splitCidr(network) } });
    return getSubnet(db, s.id);
  },
  async update(db: Db, { id, network, ...data }: z.infer<typeof subnetUpdateSchema>) {
    const cur = must(await db.ipSubnet.findUnique({ where: { id } }), 'subnet', { id });
    checkGateway(network ?? `${cur.network}/${cur.prefixLen}`, data.gateway === undefined ? cur.gateway : data.gateway);
    await db.ipSubnet.update({ where: { id }, data: { ...data, ...(network ? splitCidr(network) : {}) } });
    return getSubnet(db, id);
  },
  async delete(db: Db, id: string, force: boolean) {
    must(await db.ipSubnet.findUnique({ where: { id } }), 'subnet', { id });
    const n = await db.ipAddress.count({ where: { subnetId: id } });
    if (n && !force) throw new AppError('NOT_EMPTY', 'subnet still has addresses', { addresses: n });
    await db.ipAddress.deleteMany({ where: { subnetId: id } });
    await db.ipSubnet.delete({ where: { id } });
    return { ok: true as const };
  },
  calculate(network: string) {
    return calculateSubnet(parseCidr(network)!);
  },
  async statistics(db: Db): Promise<IpStatistics> {
    const subnets = await db.ipSubnet.findMany({ select: { id: true, prefixLen: true } });
    const counts = await statusCounts(db, subnets.map((s) => s.id));
    const total: IpStatistics = { totalSubnets: subnets.length, capacity: 0, allocated: 0, reserved: 0, blocked: 0, free: 0, utilization: 0 };
    for (const s of subnets) {
      const u = usageOf(s.prefixLen, counts.get(s.id) ?? {});
      total.capacity += u.capacity;
      total.allocated += u.allocated;
      total.reserved += u.reserved;
      total.blocked += u.blocked;
      total.free += u.free;
    }
    const usable = total.capacity - total.reserved - total.blocked;
    total.utilization = usable > 0 ? Math.round((total.allocated / usable) * 10_000) / 100 : 0;
    return total;
  },
};

// ---------- addresses ----------

const ipInclude = {
  port: { select: { id: true, number: true, panel: { select: { deviceId: true, device: { select: { name: true } } } } } },
  device: { select: { id: true, name: true } },
  workstation: { select: { id: true, name: true } },
} as const;
type IpRow = Prisma.IpAddressGetPayload<{ include: typeof ipInclude }>;

function ipDto(a: IpRow): IpAddressDto {
  let owner: IpAddressDto['owner'] = null;
  if (a.port) owner = { kind: 'PORT', id: a.port.id, name: `${a.port.panel.device.name} ${a.port.number}`, deviceId: a.port.panel.deviceId };
  else if (a.device) owner = { kind: 'DEVICE', id: a.device.id, name: a.device.name, deviceId: a.device.id };
  else if (a.workstation) owner = { kind: 'WORKSTATION', id: a.workstation.id, name: a.workstation.name, deviceId: null };
  return {
    id: a.id,
    subnetId: a.subnetId,
    address: a.address,
    status: a.status,
    portId: a.portId,
    deviceId: a.deviceId,
    workstationId: a.workstationId,
    owner,
    hostname: a.hostname,
    macAddress: a.macAddress,
    description: a.description,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

async function getIp(db: Db, id: string) {
  return ipDto(must(await db.ipAddress.findUnique({ where: { id }, include: ipInclude }), 'ip address', { id }));
}

/** First free host addresses of a subnet (network, broadcast and gateway excluded), computed in SQL. */
async function nextAvailable(db: Db, subnetId: string, count: number): Promise<string[]> {
  must(await db.ipSubnet.findUnique({ where: { id: subnetId }, select: { id: true } }), 'subnet', { id: subnetId });
  const rows = await db.$queryRaw<{ address: string }[]>`
    SELECT host(s."network" + g) AS address
    FROM "IpSubnet" s,
         LATERAL generate_series(
           CASE WHEN s."prefixLen" >= 31 THEN 0 ELSE 1 END::bigint,
           (2::bigint ^ (32 - s."prefixLen"))::bigint - CASE WHEN s."prefixLen" >= 31 THEN 1 ELSE 2 END
         ) AS g
    WHERE s.id = ${subnetId}
      AND (s."gateway" IS NULL OR s."network" + g <> s."gateway")
      AND NOT EXISTS (SELECT 1 FROM "IpAddress" a WHERE a."subnetId" = s.id AND a."address" = s."network" + g)
    ORDER BY g
    LIMIT ${count}`;
  return rows.map((r) => r.address);
}

async function checkOwner(db: Db, o: { portId?: string | null; deviceId?: string | null; workstationId?: string | null }) {
  if (o.portId) must(await db.port.findUnique({ where: { id: o.portId }, select: { id: true } }), 'port', { id: o.portId });
  if (o.deviceId) must(await db.device.findUnique({ where: { id: o.deviceId }, select: { id: true } }), 'device', { id: o.deviceId });
  if (o.workstationId) must(await db.workstation.findUnique({ where: { id: o.workstationId }, select: { id: true } }), 'workstation', { id: o.workstationId });
}

export const ipAddressService = {
  async list(db: Db, input: z.infer<typeof ipListSchema>): Promise<Paged<IpAddressDto>> {
    const s = input.search ? { contains: input.search, mode: 'insensitive' as const } : undefined;
    const where: Prisma.IpAddressWhereInput = {
      subnetId: input.subnetId,
      status: input.status,
      ...(s ? { OR: [{ hostname: s }, { description: s }, { macAddress: s }] } : {}),
    };
    const [rows, total] = await Promise.all([
      db.ipAddress.findMany({ where, include: ipInclude, orderBy: { address: 'asc' }, take: input.take, skip: input.skip }),
      db.ipAddress.count({ where }),
    ]);
    return { items: rows.map(ipDto), total };
  },
  get: getIp,
  async getByAddress(db: Db, address: string, subnetId?: string) {
    const rows = await db.ipAddress.findMany({ where: { address, subnetId }, include: ipInclude });
    if (!rows.length) throw new AppError('NOT_FOUND', 'ip address not found', { address });
    return rows.map(ipDto);
  },
  nextAvailable,
  async allocate(db: Db, input: z.infer<typeof ipAllocateSchema>) {
    await checkOwner(db, input);
    const address = input.address ?? (await nextAvailable(db, input.subnetId, 1))[0];
    if (!address) throw new AppError('IP_CONFLICT', 'subnet is full', { subnetId: input.subnetId });
    const a = await db.ipAddress.create({
      data: {
        subnetId: input.subnetId,
        address,
        status: input.status,
        portId: input.portId ?? null,
        deviceId: input.deviceId ?? null,
        workstationId: input.workstationId ?? null,
        hostname: input.hostname,
        macAddress: input.macAddress ?? null,
        description: input.description,
      },
    });
    return getIp(db, a.id);
  },
  async batchAllocate(db: Db, input: z.infer<typeof ipBatchAllocateSchema>) {
    const addresses = await nextAvailable(db, input.subnetId, input.count);
    if (addresses.length < input.count) throw new AppError('IP_CONFLICT', 'not enough free addresses', { free: addresses.length });
    await db.ipAddress.createMany({
      data: addresses.map((address) => ({ subnetId: input.subnetId, address, status: input.status, description: input.description })),
    });
    return { addresses };
  },
  async update(db: Db, { id, ...data }: z.infer<typeof ipUpdateSchema>) {
    must(await db.ipAddress.findUnique({ where: { id } }), 'ip address', { id });
    await checkOwner(db, data);
    // setting one owner replaces the others
    const owners = ['portId', 'deviceId', 'workstationId'] as const;
    const given = owners.find((k) => data[k]);
    const patch: Prisma.IpAddressUncheckedUpdateInput = { status: data.status, hostname: data.hostname, macAddress: data.macAddress, description: data.description };
    if (given) for (const k of owners) patch[k] = k === given ? data[k] : null;
    else for (const k of owners) if (data[k] === null) patch[k] = null;
    await db.ipAddress.update({ where: { id }, data: patch });
    return getIp(db, id);
  },
  /** Releasing an address deletes its row: a free address has no row. */
  async release(db: Db, id: string) {
    must(await db.ipAddress.findUnique({ where: { id } }), 'ip address', { id });
    await db.ipAddress.delete({ where: { id } });
    return { ok: true as const };
  },
  async checkConflicts(db: Db, subnetId?: string): Promise<IpConflict[]> {
    const dupAddr = await db.$queryRaw<{ value: string; ids: string[] }[]>`
      SELECT host("address") AS value, array_agg(id ORDER BY id) AS ids FROM "IpAddress"
      ${subnetId ? Prisma.sql`WHERE "address" IN (SELECT "address" FROM "IpAddress" WHERE "subnetId" = ${subnetId})` : Prisma.empty}
      GROUP BY "address" HAVING count(*) > 1`;
    const dupMac = await db.$queryRaw<{ value: string; ids: string[] }[]>`
      SELECT upper("macAddress") AS value, array_agg(id ORDER BY id) AS ids FROM "IpAddress"
      WHERE "macAddress" IS NOT NULL ${subnetId ? Prisma.sql`AND upper("macAddress") IN (SELECT upper("macAddress") FROM "IpAddress" WHERE "subnetId" = ${subnetId})` : Prisma.empty}
      GROUP BY upper("macAddress") HAVING count(*) > 1`;
    return [
      ...dupAddr.map((r) => ({ kind: 'ADDRESS_IN_MULTIPLE_SUBNETS' as const, value: r.value, ipAddressIds: r.ids })),
      ...dupMac.map((r) => ({ kind: 'DUPLICATE_MAC' as const, value: r.value, ipAddressIds: r.ids })),
    ];
  },
};

