import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, invalid, must } from '../http/errors';
import { MODULE_STATUSES, TRANSCEIVER_FORMS } from '../contracts/enums';
import type { ModuleStatus, MovementType, TransceiverForm } from '../contracts/enums';
import {
  MODULE_FITS,
  type ModuleDto,
  type ModuleMovementDto,
  type ModuleStatistics,
  moduleCreateSchema,
  moduleListSchema,
  moduleUpdateSchema,
} from '../contracts/opticalModules';
import type { Paged } from '../contracts/common';
import { iso, isoOrNull } from './shared';

const moduleInclude = {
  currentPort: { select: { id: true, number: true, panelId: true, panel: { select: { name: true, device: { select: { id: true, name: true } } } } } },
} as const satisfies Prisma.OpticalModuleInclude;
type ModuleRow = Prisma.OpticalModuleGetPayload<{ include: typeof moduleInclude }>;

function dto(m: ModuleRow): ModuleDto {
  const p = m.currentPort;
  return {
    id: m.id,
    serialNo: m.serialNo,
    model: m.model,
    vendor: m.vendor,
    moduleType: m.moduleType,
    wavelength: m.wavelength,
    distance: m.distance,
    ddmSupport: m.ddmSupport,
    supplier: m.supplier,
    purchaseDate: isoOrNull(m.purchaseDate),
    price: m.price,
    warrantyExpiry: isoOrNull(m.warrantyExpiry),
    status: m.status,
    currentPortId: m.currentPortId,
    currentPort: p ? { id: p.id, number: p.number, panelId: p.panelId, panelName: p.panel.name, deviceId: p.panel.device.id, deviceName: p.panel.device.name } : null,
    notes: m.notes,
    createdAt: iso(m.createdAt),
    updatedAt: iso(m.updatedAt),
  };
}

async function get(db: Db, id: string) {
  return dto(must(await db.opticalModule.findUnique({ where: { id }, include: moduleInclude }), 'optical module', { id }));
}

async function load(db: Db, id: string) {
  return must(await db.opticalModule.findUnique({ where: { id } }), 'optical module', { id });
}

/** Target port must exist, be empty and accept the module form. */
async function checkTarget(db: Db, portId: string, form: TransceiverForm) {
  const port = must(await db.port.findUnique({ where: { id: portId }, include: { opticalModule: { select: { id: true } } } }), 'port', { id: portId });
  if (port.opticalModule) throw new AppError('INVALID_STATE', 'port already holds a module', { portId });
  if (!(MODULE_FITS[port.portType] ?? []).includes(form)) throw invalid(`module ${form} does not fit a ${port.portType} port`, { portType: port.portType, moduleType: form });
}

/** "device panel port" of a port right now; stored on the movement so the history outlives the port. */
async function portPathText(db: Db, portId: string | null): Promise<string | null> {
  if (!portId) return null;
  const p = await db.port.findUnique({ where: { id: portId }, select: { number: true, panel: { select: { name: true, device: { select: { name: true } } } } } });
  return p ? `${p.panel.device.name} ${p.panel.name} ${p.number}` : null;
}

async function log(db: Db, moduleId: string, movementType: MovementType, fromPortId: string | null, toPortId: string | null, op: { operator?: string | null; notes?: string | null }) {
  await db.moduleMovement.create({
    data: {
      moduleId,
      movementType,
      fromPortId,
      fromPortPath: await portPathText(db, fromPortId),
      toPortId,
      toPortPath: await portPathText(db, toPortId),
      operator: op.operator ?? null,
      notes: op.notes ?? null,
    },
  });
}

export const opticalModuleService = {
  async list(db: Db, input: z.infer<typeof moduleListSchema>): Promise<Paged<ModuleDto>> {
    const s = input.search ? { contains: input.search, mode: 'insensitive' as const } : undefined;
    const where: Prisma.OpticalModuleWhereInput = {
      status: input.status,
      moduleType: input.moduleType,
      ...(s ? { OR: [{ serialNo: s }, { model: s }, { vendor: s }, { notes: s }] } : {}),
    };
    const [rows, total] = await Promise.all([
      db.opticalModule.findMany({ where, include: moduleInclude, orderBy: { createdAt: 'desc' }, take: input.take, skip: input.skip }),
      db.opticalModule.count({ where }),
    ]);
    return { items: rows.map(dto), total };
  },
  get,
  async bySerial(db: Db, serialNo: string) {
    return dto(must(await db.opticalModule.findUnique({ where: { serialNo }, include: moduleInclude }), 'optical module', { serialNo }));
  },
  async create(db: Db, { operator, ...data }: z.infer<typeof moduleCreateSchema>) {
    const m = await db.opticalModule.create({ data: { ...data, status: 'IN_STOCK' } });
    await log(db, m.id, 'PURCHASE', null, null, { operator, notes: data.notes });
    return get(db, m.id);
  },
  async update(db: Db, { id, ...data }: z.infer<typeof moduleUpdateSchema>) {
    const m = await load(db, id);
    if (data.status && (m.status === 'INSTALLED' || m.status === 'SCRAPPED')) {
      throw new AppError('INVALID_STATE', `status of an ${m.status} module cannot be set directly`, { status: m.status });
    }
    if (data.moduleType && m.currentPortId) await checkTargetForm(db, m.currentPortId, data.moduleType);
    await db.opticalModule.update({ where: { id }, data });
    return get(db, id);
  },
  async install(db: Db, input: { id: string; portId: string; operator?: string | null; notes?: string | null }) {
    const m = await load(db, input.id);
    if (m.status === 'INSTALLED') throw new AppError('INVALID_STATE', 'module is installed, uninstall or transfer it', { portId: m.currentPortId });
    if (m.status === 'SCRAPPED') throw new AppError('INVALID_STATE', 'module is scrapped');
    await checkTarget(db, input.portId, m.moduleType);
    await db.opticalModule.update({ where: { id: m.id }, data: { status: 'INSTALLED', currentPortId: input.portId } });
    await log(db, m.id, 'INSTALL', null, input.portId, input);
    return get(db, m.id);
  },
  async uninstall(db: Db, input: { id: string; operator?: string | null; notes?: string | null }) {
    const m = await load(db, input.id);
    if (m.status !== 'INSTALLED') throw new AppError('INVALID_STATE', 'module is not installed');
    await db.opticalModule.update({ where: { id: m.id }, data: { status: 'IN_STOCK', currentPortId: null } });
    await log(db, m.id, 'UNINSTALL', m.currentPortId, null, input);
    return get(db, m.id);
  },
  async transfer(db: Db, input: { id: string; toPortId: string; operator?: string | null; notes?: string | null }) {
    const m = await load(db, input.id);
    if (m.status !== 'INSTALLED') throw new AppError('INVALID_STATE', 'only an installed module can be transferred');
    if (m.currentPortId === input.toPortId) throw invalid('module is already in this port');
    await checkTarget(db, input.toPortId, m.moduleType);
    await db.opticalModule.update({ where: { id: m.id }, data: { currentPortId: input.toPortId } });
    await log(db, m.id, 'TRANSFER', m.currentPortId, input.toPortId, input);
    return get(db, m.id);
  },
  async scrap(db: Db, input: { id: string; operator?: string | null; notes?: string | null }) {
    const m = await load(db, input.id);
    if (m.status === 'SCRAPPED') throw new AppError('INVALID_STATE', 'module is already scrapped');
    await db.opticalModule.update({ where: { id: m.id }, data: { status: 'SCRAPPED', currentPortId: null } });
    await log(db, m.id, 'SCRAP', m.currentPortId, null, input);
    return get(db, m.id);
  },
  async history(db: Db, id: string): Promise<ModuleMovementDto[]> {
    await load(db, id);
    const rows = await db.moduleMovement.findMany({ where: { moduleId: id }, orderBy: { createdAt: 'desc' } });
    // where the module was at the time of the movement (the port may be renamed or deleted since)
    return rows.map((r) => ({
      id: r.id,
      movementType: r.movementType,
      fromPortId: r.fromPortId,
      toPortId: r.toPortId,
      fromPort: r.fromPortPath,
      toPort: r.toPortPath,
      operator: r.operator,
      notes: r.notes,
      createdAt: iso(r.createdAt),
    }));
  },
  async delete(db: Db, id: string) {
    const m = await load(db, id);
    if (m.status === 'INSTALLED') throw new AppError('INVALID_STATE', 'uninstall the module before deleting it');
    await db.opticalModule.delete({ where: { id } });
    return { ok: true as const };
  },
  async statistics(db: Db): Promise<ModuleStatistics> {
    const [byS, byT, total] = await Promise.all([
      db.opticalModule.groupBy({ by: ['status'], _count: { _all: true } }),
      db.opticalModule.groupBy({ by: ['moduleType'], _count: { _all: true } }),
      db.opticalModule.count(),
    ]);
    const byStatus = Object.fromEntries(MODULE_STATUSES.map((s) => [s, 0])) as Record<ModuleStatus, number>;
    const byType = Object.fromEntries(TRANSCEIVER_FORMS.map((s) => [s, 0])) as Record<TransceiverForm, number>;
    for (const r of byS) byStatus[r.status] = r._count._all;
    for (const r of byT) byType[r.moduleType] = r._count._all;
    return { total, byStatus, byType };
  },
};

async function checkTargetForm(db: Db, portId: string, form: TransceiverForm) {
  const port = must(await db.port.findUnique({ where: { id: portId }, select: { portType: true } }), 'port', { id: portId });
  if (!(MODULE_FITS[port.portType] ?? []).includes(form)) throw invalid(`module ${form} does not fit a ${port.portType} port`);
}
