import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must } from '../http/errors';
import type {
  PortDependents,
  PortDetailDto,
  PortDto,
  portCreateBulkSchema,
  portCreateSchema,
  portListSchema,
  portUpdateSchema,
} from '../contracts/panels';
import { trailingNumber } from '../contracts/ifName';
import { endpointInclude, endpointPath, labelRef, labelSelect, portLocInclude, portPath } from './shared';

export const portInclude = {
  cableEndpoint: { select: { id: true, cableId: true, end: true, label: labelSelect } },
  opticalModule: { select: { id: true } },
} as const satisfies Prisma.PortInclude;
export type PortRow = Prisma.PortGetPayload<{ include: typeof portInclude }>;

export function portDto(p: PortRow): PortDto {
  return {
    id: p.id,
    panelId: p.panelId,
    number: p.number,
    sortIndex: p.sortIndex,
    ifName: p.ifName,
    portType: p.portType,
    label: p.label,
    adminState: p.adminState,
    notes: p.notes,
    xMm: p.xMm,
    yMm: p.yMm,
    wMm: p.wMm,
    hMm: p.hMm,
    rotation: p.rotation,
    connected: p.cableEndpoint !== null,
    hasModule: p.opticalModule !== null,
    endpoint: p.cableEndpoint ? { ...p.cableEndpoint, label: labelRef(p.cableEndpoint.label) } : null,
  };
}

export const portOrder = [{ sortIndex: 'asc' as const }, { number: 'asc' as const }];

/**
 * Ports matching `where` that are in use. Observations only count for template apply,
 * because they are history rather than something plugged in.
 */
export async function portDependents(db: Db, where: Prisma.PortWhereInput, withObservations = false): Promise<PortDependents[]> {
  const rows = await db.port.findMany({
    where: {
      AND: [
        where,
        {
          OR: [
            { cableEndpoint: { isNot: null } },
            { opticalModule: { isNot: null } },
            { ipAddress: { isNot: null } },
            { attachedWorkstations: { some: {} } },
            ...(withObservations ? [{ observations: { some: {} } }] : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      number: true,
      cableEndpoint: { select: { id: true } },
      opticalModule: { select: { id: true } },
      ipAddress: { select: { id: true } },
      _count: { select: { attachedWorkstations: true, observations: true } },
    },
    orderBy: portOrder,
  });
  return rows.map((p) => {
    const reasons: PortDependents['reasons'] = [];
    if (p.cableEndpoint) reasons.push('CABLE');
    if (p.opticalModule) reasons.push('MODULE');
    if (p.ipAddress) reasons.push('IP');
    if (p._count.attachedWorkstations) reasons.push('WORKSTATION');
    if (withObservations && p._count.observations) reasons.push('OBSERVATION');
    return { portId: p.id, number: p.number, reasons };
  });
}

/**
 * Delete ports matching `where`. Without force, any dependent blocks the delete.
 * With force, cable ends are unplugged (they stay, unparked) and IP bindings are released;
 * optical modules always have to be removed by hand first.
 */
export async function deletePorts(db: Db, where: Prisma.PortWhereInput, force: boolean) {
  const deps = await portDependents(db, where);
  const blocking = force ? deps.filter((d) => d.reasons.includes('MODULE')) : deps;
  if (blocking.length) throw new AppError('PORT_HAS_DEPENDENTS', 'ports are in use', { ports: blocking });
  if (force && deps.length) {
    const ids = deps.map((d) => d.portId);
    await db.cableEndpoint.updateMany({ where: { portId: { in: ids } }, data: { portId: null } });
    await db.ipAddress.updateMany({ where: { portId: { in: ids } }, data: { portId: null } });
    await db.workstation.updateMany({ where: { attachedPortId: { in: ids } }, data: { attachedPortId: null } });
  }
  return db.port.deleteMany({ where });
}

async function get(db: Db, id: string): Promise<PortDetailDto> {
  const p = must(
    await db.port.findUnique({
      where: { id },
      include: {
        ...portInclude,
        ...portLocInclude,
        cableEndpoint: {
          include: {
            label: labelSelect,
            cable: { include: { endpoints: { include: endpointInclude } } },
          },
        },
        opticalModule: { select: { id: true, serialNo: true, model: true, vendor: true, status: true } },
        ipAddress: { select: { id: true, address: true, status: true, subnetId: true } },
        attachedWorkstations: { select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } },
      },
    }),
    'port',
    { id },
  );
  const ep = p.cableEndpoint;
  const peer = ep?.cable.endpoints.find((e) => e.id !== ep.id) ?? null;
  const cableName = ep?.cable.label ?? 'cable';
  return {
    ...portDto({
      ...p,
      cableEndpoint: ep ? { id: ep.id, cableId: ep.cableId, end: ep.end, label: ep.label } : null,
      opticalModule: p.opticalModule ? { id: p.opticalModule.id } : null,
    }),
    path: portPath(p),
    cable: ep ? { id: ep.cable.id, medium: ep.cable.medium, label: ep.cable.label, color: ep.cable.color, lengthM: ep.cable.lengthM } : null,
    peer: peer
      ? {
          endpointId: peer.id,
          end: peer.end,
          label: labelRef(peer.label),
          portId: peer.portId,
          parkedPanelId: peer.parkedPanelId,
          path: endpointPath(peer, cableName),
        }
      : null,
    opticalModule: p.opticalModule,
    ipAddress: p.ipAddress,
    attachedWorkstations: p.attachedWorkstations,
  };
}

async function nextSortIndex(db: Db, panelId: string) {
  const max = await db.port.aggregate({ where: { panelId }, _max: { sortIndex: true } });
  return (max._max.sortIndex ?? 0) + 1;
}

export const portService = {
  async list(db: Db, input: z.infer<typeof portListSchema>) {
    const f = input.filter;
    const rows = await db.port.findMany({
      where: {
        panelId: input.panelId,
        adminState: f.adminState,
        portType: f.portType,
        ...(f.connected === true ? { cableEndpoint: { isNot: null } } : f.connected === false ? { cableEndpoint: { is: null } } : {}),
      },
      include: portInclude,
      orderBy: portOrder,
    });
    return rows.map(portDto);
  },
  get,
  async create(db: Db, input: z.infer<typeof portCreateSchema>) {
    must(await db.panel.findUnique({ where: { id: input.panelId } }), 'panel', { id: input.panelId });
    const sortIndex = input.sortIndex ?? trailingNumber(input.number) ?? (await nextSortIndex(db, input.panelId));
    const p = await db.port.create({ data: { ...input, sortIndex } });
    return get(db, p.id);
  },
  async createBulk(db: Db, input: z.infer<typeof portCreateBulkSchema>) {
    must(await db.panel.findUnique({ where: { id: input.panelId } }), 'panel', { id: input.panelId });
    const data = Array.from({ length: input.count }, (_, i) => {
      const n = input.startNumber + i;
      return {
        panelId: input.panelId,
        number: `${input.prefix}${n}`,
        sortIndex: n,
        portType: input.portType,
        ifName: input.ifNamePattern ? input.ifNamePattern.replace(/\{n\}/g, String(n)) : null,
      };
    });
    const res = await db.port.createMany({ data });
    return { created: res.count };
  },
  async update(db: Db, { id, ...data }: z.infer<typeof portUpdateSchema>) {
    must(await db.port.findUnique({ where: { id } }), 'port', { id });
    await db.port.update({ where: { id }, data });
    return get(db, id);
  },
  async setAdminState(db: Db, id: string, adminState: PortDto['adminState']) {
    must(await db.port.findUnique({ where: { id } }), 'port', { id });
    await db.port.update({ where: { id }, data: { adminState } });
    return get(db, id);
  },
  async delete(db: Db, id: string, force: boolean) {
    must(await db.port.findUnique({ where: { id } }), 'port', { id });
    await deletePorts(db, { id }, force);
    return { ok: true as const };
  },
};
