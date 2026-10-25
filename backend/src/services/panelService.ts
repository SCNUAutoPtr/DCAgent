import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { must } from '../http/errors';
import type { PanelDetailDto, PanelDto, panelCreateSchema, panelListSchema, panelUpdateSchema } from '../contracts/panels';
import { labelService } from './labelService';
import { deletePorts, portDto, portInclude, portOrder } from './portService';
import { iso, labelRef, labelSelect, panelLocInclude, panelPath } from './shared';

const panelInclude = {
  device: { select: { name: true } },
  label: labelSelect,
  template: { select: { revision: true } },
  _count: { select: { ports: true, parkedEndpoints: true } },
} as const satisfies Prisma.PanelInclude;
type PanelRow = Prisma.PanelGetPayload<{ include: typeof panelInclude }>;

function panelDto(p: PanelRow, connectedCount: number): PanelDto {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    face: p.face,
    notes: p.notes,
    deviceId: p.deviceId,
    deviceName: p.device.name,
    templateId: p.templateId,
    templateRevision: p.templateRevision,
    templateOutdated: !!p.template && p.templateRevision !== p.template.revision,
    widthMm: p.widthMm,
    heightMm: p.heightMm,
    label: labelRef(p.label),
    portCount: p._count.ports,
    connectedCount,
    parkedCount: p._count.parkedEndpoints,
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
  };
}

async function connectedCounts(db: Db, panelIds: string[]) {
  if (!panelIds.length) return new Map<string, number>();
  const rows = await db.port.groupBy({ by: ['panelId'], where: { panelId: { in: panelIds }, cableEndpoint: { isNot: null } }, _count: { _all: true } });
  return new Map(rows.map((r) => [r.panelId, r._count._all]));
}

async function get(db: Db, id: string): Promise<PanelDetailDto> {
  const p = must(
    await db.panel.findUnique({ where: { id }, include: { ...panelInclude, ...panelLocInclude, ports: { include: portInclude, orderBy: portOrder } } }),
    'panel',
    { id },
  );
  const ports = p.ports.map(portDto);
  return {
    ...panelDto({ ...p, device: { name: p.device.name } }, ports.filter((x) => x.connected).length),
    ports,
    path: panelPath(p),
  };
}

export const panelService = {
  async list(db: Db, input: z.infer<typeof panelListSchema>) {
    const where: Prisma.PanelWhereInput = {
      type: input.type,
      ...(input.deviceId ? { deviceId: input.deviceId } : {}),
      ...(input.cabinetId ? { device: { cabinetId: input.cabinetId } } : {}),
      ...(input.roomId ? { device: { OR: [{ roomId: input.roomId }, { cabinet: { roomId: input.roomId } }] } } : {}),
    };
    if (input.includePorts) {
      const rows = await db.panel.findMany({
        where,
        include: { ...panelInclude, ports: { include: portInclude, orderBy: portOrder } },
        orderBy: [{ device: { name: 'asc' } }, { name: 'asc' }],
      });
      return rows.map((p) => {
        const ports = p.ports.map(portDto);
        return { ...panelDto(p, ports.filter((x) => x.connected).length), ports };
      });
    }
    const rows = await db.panel.findMany({ where, include: panelInclude, orderBy: [{ device: { name: 'asc' } }, { name: 'asc' }] });
    const counts = await connectedCounts(db, rows.map((r) => r.id));
    return rows.map((p) => panelDto(p, counts.get(p.id) ?? 0));
  },
  get,
  async create(db: Db, { labelShortId, ...data }: z.infer<typeof panelCreateSchema>) {
    must(await db.device.findUnique({ where: { id: data.deviceId } }), 'device', { id: data.deviceId });
    const p = await db.panel.create({ data });
    await labelService.assign(db, { kind: 'PANEL', id: p.id }, labelShortId);
    return get(db, p.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof panelUpdateSchema>) {
    must(await db.panel.findUnique({ where: { id } }), 'panel', { id });
    await db.panel.update({ where: { id }, data });
    return get(db, id);
  },
  /** Ports in use block the delete (see deletePorts). Parked cable ends stay, unparked. The label is released, not reused. */
  async delete(db: Db, id: string, force: boolean) {
    must(await db.panel.findUnique({ where: { id } }), 'panel', { id });
    await deletePorts(db, { panelId: id }, force);
    await db.panel.delete({ where: { id } });
    return { ok: true as const };
  },
};
