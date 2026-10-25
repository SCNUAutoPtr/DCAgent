import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must, toAppError } from '../http/errors';
import type { CableEnd } from '../contracts/enums';
import type {
  CableDto,
  CableEndInput,
  DanglingByDevice,
  EndpointDto,
  PanelConnection,
  cableConnectEndSchema,
  cableCreateSchema,
  cableDisconnectEndSchema,
  cableListSchema,
  cableUpdateSchema,
} from '../contracts/cables';
import type { Paged } from '../contracts/common';
import { labelService } from './labelService';
import { endpointInclude, endpointPath, iso, labelRef, deviceRoom } from './shared';

const cableInclude = {
  endpoints: { include: endpointInclude, orderBy: { end: 'asc' as const } },
} as const satisfies Prisma.CableInclude;
type CableRow = Prisma.CableGetPayload<{ include: typeof cableInclude }>;
type EndpointRow = CableRow['endpoints'][number];

const cableName = (c: { label: string | null }) => c.label ?? 'cable';

export function endpointDto(e: EndpointRow, name: string): EndpointDto {
  const panel = e.port?.panel ?? e.parkedPanel ?? null;
  const device = panel?.device ?? null;
  const room = device ? deviceRoom(device) : null;
  return {
    id: e.id,
    cableId: e.cableId,
    end: e.end,
    connector: e.connector,
    notes: e.notes,
    label: labelRef(e.label),
    portId: e.portId,
    parkedPanelId: e.parkedPanelId,
    port: e.port ? { id: e.port.id, number: e.port.number, ifName: e.port.ifName } : null,
    panel: panel ? { id: panel.id, name: panel.name } : null,
    device: device ? { id: device.id, name: device.name } : null,
    cabinet: device?.cabinet ? { id: device.cabinet.id, name: device.cabinet.name } : null,
    room: room ? { id: room.id, name: room.name } : null,
    path: endpointPath(e, name),
  };
}

function cableDto(c: CableRow): CableDto {
  return {
    id: c.id,
    medium: c.medium,
    label: c.label,
    lengthM: c.lengthM,
    color: c.color,
    notes: c.notes,
    state: c.endpoints.some((e) => e.portId) ? 'IN_USE' : 'STOCK',
    endpoints: c.endpoints.map((e) => endpointDto(e, cableName(c))),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

async function get(db: Db, id: string): Promise<CableDto> {
  return cableDto(must(await db.cable.findUnique({ where: { id }, include: cableInclude }), 'cable', { id }));
}

/** Port occupancy is decided by the unique index on CableEndpoint.portId, never by a prior read. */
async function occupy<T>(op: Promise<T>, portId: string): Promise<T> {
  try {
    return await op;
  } catch (e) {
    const err = toAppError(e);
    if (err.code === 'PORT_OCCUPIED') throw new AppError('PORT_OCCUPIED', 'port already has a cable plugged in', { portId });
    throw e;
  }
}

async function checkPort(db: Db, portId: string) {
  must(await db.port.findUnique({ where: { id: portId }, select: { id: true } }), 'port', { id: portId });
}

async function createEnd(db: Db, cableId: string, end: CableEnd, input: CableEndInput) {
  if (input.portId) await checkPort(db, input.portId);
  if (input.parkedPanelId) must(await db.panel.findUnique({ where: { id: input.parkedPanelId }, select: { id: true } }), 'panel', { id: input.parkedPanelId });
  const ep = await occupy(
    db.cableEndpoint.create({
      data: {
        cableId,
        end,
        connector: input.connector ?? null,
        notes: input.notes,
        portId: input.portId ?? null,
        parkedPanelId: input.parkedPanelId ?? null,
      },
    }),
    input.portId ?? '',
  );
  await labelService.assign(db, { kind: 'CABLE_ENDPOINT', id: ep.id }, input.labelShortId);
}

async function findEndpoint(db: Db, ref: { endpointId?: string; labelShortId?: number }) {
  if (ref.endpointId) {
    return must(await db.cableEndpoint.findUnique({ where: { id: ref.endpointId }, include: { port: true } }), 'cable endpoint', { id: ref.endpointId });
  }
  const label = await db.label.findUnique({ where: { shortId: ref.labelShortId! }, select: { cableEndpointId: true } });
  if (!label?.cableEndpointId) throw new AppError('NOT_FOUND', 'no cable end carries this label', { shortId: ref.labelShortId });
  return must(await db.cableEndpoint.findUnique({ where: { id: label.cableEndpointId }, include: { port: true } }), 'cable endpoint');
}

export const cableService = {
  get,
  async list(db: Db, input: z.infer<typeof cableListSchema>): Promise<Paged<CableDto>> {
    const f = input.filter;
    const and: Prisma.CableWhereInput[] = [];
    if (f.medium) and.push({ medium: f.medium });
    if (f.state === 'IN_USE') and.push({ endpoints: { some: { portId: { not: null } } } });
    if (f.state === 'STOCK') and.push({ endpoints: { none: { portId: { not: null } } } });
    if (f.search) {
      const s = { contains: f.search, mode: 'insensitive' as const };
      const n = /^\d+$/.test(f.search) ? Number(f.search) : null;
      and.push({
        OR: [
          { label: s },
          { notes: s },
          { endpoints: { some: { port: { OR: [{ number: s }, { ifName: s }, { panel: { device: { name: s } } }] } } } },
          ...(n !== null && n <= 2_147_483_647 ? [{ endpoints: { some: { label: { shortId: n } } } }] : []),
        ],
      });
    }
    const where = { AND: and };
    const [rows, total] = await Promise.all([
      db.cable.findMany({ where, include: cableInclude, orderBy: { createdAt: 'desc' }, take: input.take, skip: input.skip }),
      db.cable.count({ where }),
    ]);
    return { items: rows.map(cableDto), total };
  },

  /** Creates the cable and both ends (A and B) with their labels in one transaction. */
  async create(db: Db, { ends, ...data }: z.infer<typeof cableCreateSchema>) {
    const cable = await db.cable.create({ data });
    await createEnd(db, cable.id, 'A', ends.A);
    await createEnd(db, cable.id, 'B', ends.B);
    return get(db, cable.id);
  },

  async update(db: Db, { id, ends, ...data }: z.infer<typeof cableUpdateSchema>) {
    must(await db.cable.findUnique({ where: { id } }), 'cable', { id });
    await db.cable.update({ where: { id }, data });
    for (const e of ends ?? []) {
      await db.cableEndpoint.update({ where: { cableId_end: { cableId: id, end: e.end } }, data: { connector: e.connector, notes: e.notes } });
    }
    return get(db, id);
  },

  /** Plug an existing end (by id or label) into a port; an end already plugged elsewhere moves. */
  async connectEnd(db: Db, input: z.infer<typeof cableConnectEndSchema>) {
    const ep = await findEndpoint(db, input);
    await checkPort(db, input.portId);
    if (ep.portId === input.portId) return get(db, ep.cableId);
    await occupy(db.cableEndpoint.update({ where: { id: ep.id }, data: { portId: input.portId, parkedPanelId: null } }), input.portId);
    return get(db, ep.cableId);
  },

  async disconnectEnd(db: Db, input: z.infer<typeof cableDisconnectEndSchema>) {
    const ep = await findEndpoint(db, input);
    if (!ep.portId) throw new AppError('INVALID_STATE', 'cable end is not plugged into a port', { endpointId: ep.id });
    const park = input.parkPanelId === undefined ? ep.port!.panelId : input.parkPanelId;
    if (park) must(await db.panel.findUnique({ where: { id: park }, select: { id: true } }), 'panel', { id: park });
    await db.cableEndpoint.update({ where: { id: ep.id }, data: { portId: null, parkedPanelId: park } });
    return get(db, ep.cableId);
  },

  /** Ends are removed with the cable; their labels are released (or voided when scrapping). */
  async delete(db: Db, id: string, voidLabels: boolean) {
    const c = must(await db.cable.findUnique({ where: { id }, include: { endpoints: { include: { label: true } } } }), 'cable', { id });
    const shortIds = c.endpoints.flatMap((e) => (e.label ? [e.label.shortId] : []));
    await db.cable.delete({ where: { id } });
    if (voidLabels && shortIds.length) {
      await db.label.updateMany({ where: { shortId: { in: shortIds } }, data: { state: 'VOID', notes: `cable scrapped ${new Date().toISOString().slice(0, 10)}` } });
    }
    return { ok: true as const, releasedLabels: voidLabels ? [] : shortIds, voidedLabels: voidLabels ? shortIds : [] };
  },

  /** Every plugged port of a panel with its peer, in one query. Loopbacks within the panel are included. */
  async panelConnections(db: Db, panelId: string): Promise<PanelConnection[]> {
    must(await db.panel.findUnique({ where: { id: panelId }, select: { id: true } }), 'panel', { id: panelId });
    const local = await db.cableEndpoint.findMany({
      where: { port: { panelId } },
      include: { ...endpointInclude, cable: { include: { endpoints: { include: endpointInclude } } } },
      orderBy: { port: { sortIndex: 'asc' } },
    });
    return local.map((e) => {
      const name = cableName(e.cable);
      const peer = e.cable.endpoints.find((x) => x.id !== e.id) ?? null;
      return {
        portId: e.portId!,
        portNumber: e.port!.number,
        cable: { id: e.cable.id, medium: e.cable.medium, label: e.cable.label },
        local: endpointDto(e, name),
        peer: peer ? endpointDto(peer, name) : null,
        loopback: peer?.port?.panelId === panelId,
      };
    });
  },

  async danglingByDevice(db: Db, deviceId: string): Promise<DanglingByDevice> {
    must(await db.device.findUnique({ where: { id: deviceId }, select: { id: true } }), 'device', { id: deviceId });
    const eps = await db.cableEndpoint.findMany({
      where: { portId: null, parkedPanel: { deviceId } },
      include: { ...endpointInclude, cable: { select: { label: true } } },
      orderBy: { createdAt: 'asc' },
    });
    const panels = new Map<string, DanglingByDevice['panels'][number]>();
    for (const e of eps) {
      const p = e.parkedPanel!;
      if (!panels.has(p.id)) panels.set(p.id, { panelId: p.id, panelName: p.name, endpoints: [] });
      panels.get(p.id)!.endpoints.push(endpointDto(e, cableName(e.cable)));
    }
    return { total: eps.length, panels: [...panels.values()] };
  },
};

