import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, must } from '../http/errors';
import type { LabelKind, LabelState } from '../contracts/enums';
import { LABEL_KINDS, LABEL_STATES } from '../contracts/enums';
import {
  formatShortId,
  parseRangeExpr,
  type LabelDto,
  type LabelGenerateResult,
  type LabelResolveResult,
  type LabelStats,
  type LabelTarget,
  type LabelVoidResult,
  type MissingLabelItem,
  type PrintTaskDto,
  labelGenerateSchema,
  labelListSchema,
  labelMissingSchema,
  labelRebindSchema,
  labelVoidSchema,
  printTaskCompleteSchema,
  printTaskCreateSchema,
  printTaskListSchema,
} from '../contracts/labels';
import type { Paged } from '../contracts/common';
import { cabinetPath, endpointPath, isoOrNull, iso, panelLocInclude, panelPath, portLocInclude, roomLoc, roomPath } from './shared';

const FK: Record<LabelKind, 'roomId' | 'cabinetId' | 'panelId' | 'cableEndpointId'> = {
  ROOM: 'roomId',
  CABINET: 'cabinetId',
  PANEL: 'panelId',
  CABLE_ENDPOINT: 'cableEndpointId',
};

const UNBOUND = { roomId: null, cabinetId: null, panelId: null, cableEndpointId: null } as const;

const bindingInclude = {
  room: { select: { id: true, name: true } },
  cabinet: { select: { id: true, name: true } },
  panel: { select: { id: true, name: true } },
  cableEndpoint: { select: { id: true, end: true, cable: { select: { label: true } } } },
} as const;

type LabelWithBinding = Prisma.LabelGetPayload<{ include: typeof bindingInclude }>;

function binding(l: LabelWithBinding): LabelDto['bound'] {
  if (l.room) return { kind: 'ROOM', id: l.room.id, name: l.room.name };
  if (l.cabinet) return { kind: 'CABINET', id: l.cabinet.id, name: l.cabinet.name };
  if (l.panel) return { kind: 'PANEL', id: l.panel.id, name: l.panel.name };
  if (l.cableEndpoint) {
    return { kind: 'CABLE_ENDPOINT', id: l.cableEndpoint.id, name: `${l.cableEndpoint.cable.label ?? 'cable'} ${l.cableEndpoint.end}` };
  }
  return null;
}

function toDto(l: LabelWithBinding): LabelDto {
  return {
    shortId: l.shortId,
    display: formatShortId(l.shortId),
    state: l.state,
    batchNo: l.batchNo,
    notes: l.notes,
    printTaskId: l.printTaskId,
    printedAt: isoOrNull(l.printedAt),
    firstBoundAt: isoOrNull(l.firstBoundAt),
    boundAt: isoOrNull(l.boundAt),
    bound: binding(l),
    createdAt: iso(l.createdAt),
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Serialises allocation of new numbers within the database. */
async function lockAllocation(db: Db) {
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dcagent.label.allocate'))`;
}

async function nextNumbers(db: Db, n: number): Promise<number[]> {
  const max = await db.label.aggregate({ _max: { shortId: true } });
  const start = (max._max.shortId ?? 0) + 1;
  return Array.from({ length: n }, (_, i) => start + i);
}

/** Bind a label to an entity. A number unknown to the system is registered first (labels printed elsewhere). */
async function bind(db: Db, shortId: number, target: LabelTarget): Promise<number> {
  await db.label.createMany({ data: [{ shortId, batchNo: `manual_${today()}` }], skipDuplicates: true });
  const current = must(await db.label.findUnique({ where: { shortId } }), 'label', { shortId });
  const now = new Date();
  const res = await db.label.updateMany({
    where: { shortId, state: { not: 'VOID' }, ...UNBOUND },
    data: { [FK[target.kind]]: target.id, boundAt: now, firstBoundAt: current.firstBoundAt ?? now },
  });
  if (res.count !== 1) {
    throw new AppError('LABEL_NOT_AVAILABLE', `label ${formatShortId(shortId)} is void or already bound`, { shortId, state: current.state });
  }
  return shortId;
}

/** Labels never bound before, GENERATED, ascending; new numbers are created when the pool runs dry. */
async function autoAllocate(db: Db, n: number): Promise<number[]> {
  await lockAllocation(db);
  const rows = await db.$queryRaw<{ shortId: number }[]>`
    SELECT "shortId" FROM "Label"
    WHERE "state" = 'GENERATED' AND "firstBoundAt" IS NULL
      AND num_nonnulls("roomId", "cabinetId", "panelId", "cableEndpointId") = 0
    ORDER BY "shortId" LIMIT ${n} FOR UPDATE SKIP LOCKED`;
  const picked = rows.map((r) => r.shortId);
  if (picked.length < n) {
    const fresh = await nextNumbers(db, n - picked.length);
    await db.label.createMany({ data: fresh.map((shortId) => ({ shortId, batchNo: `auto_${today()}` })) });
    picked.push(...fresh);
  }
  return picked;
}

/** Give an entity its label: the requested number, or an automatically allocated one. */
async function assign(db: Db, target: LabelTarget, shortId?: number): Promise<number> {
  const n = shortId ?? (await autoAllocate(db, 1))[0];
  return bind(db, n, target);
}

async function entityExists(db: Db, target: LabelTarget): Promise<boolean> {
  const where = { where: { id: target.id }, select: { id: true } };
  switch (target.kind) {
    case 'ROOM':
      return !!(await db.room.findUnique(where));
    case 'CABINET':
      return !!(await db.cabinet.findUnique(where));
    case 'PANEL':
      return !!(await db.panel.findUnique(where));
    case 'CABLE_ENDPOINT':
      return !!(await db.cableEndpoint.findUnique(where));
  }
}

async function rebind(db: Db, input: z.infer<typeof labelRebindSchema>): Promise<LabelDto> {
  if (!(await entityExists(db, input.target))) throw new AppError('NOT_FOUND', `${input.target.kind} not found`, input.target);
  const fk = FK[input.target.kind];
  const old = await db.label.findFirst({ where: { [fk]: input.target.id } });
  if (old?.shortId === input.shortId) throw new AppError('INVALID_STATE', 'entity already carries this label', { shortId: old.shortId });
  if (old) {
    await db.label.update({
      where: { shortId: old.shortId },
      data: {
        [fk]: null,
        ...(input.oldPolicy === 'VOID' ? { state: 'VOID' as const, notes: `void on rebind ${today()}` } : {}),
      },
    });
  }
  await bind(db, input.shortId, input.target);
  return get(db, input.shortId);
}

async function get(db: Db, shortId: number): Promise<LabelDto> {
  return toDto(must(await db.label.findUnique({ where: { shortId }, include: bindingInclude }), 'label', { shortId }));
}

async function list(db: Db, input: z.infer<typeof labelListSchema>): Promise<Paged<LabelDto>> {
  const and: Prisma.LabelWhereInput[] = [];
  if (input.state) and.push({ state: input.state });
  if (input.kind) and.push({ [FK[input.kind]]: { not: null } });
  if (input.bound === true) and.push({ OR: Object.values(FK).map((k) => ({ [k]: { not: null } })) });
  if (input.bound === false) and.push(UNBOUND);
  if (input.range) and.push({ shortId: { in: parseRangeExpr(input.range) } });
  const where: Prisma.LabelWhereInput = { AND: and };
  const [rows, total] = await Promise.all([
    db.label.findMany({ where, include: bindingInclude, orderBy: { shortId: 'desc' }, take: input.take, skip: input.skip }),
    db.label.count({ where }),
  ]);
  return { items: rows.map(toDto), total };
}

async function stats(db: Db): Promise<LabelStats> {
  const [byStateRows, room, cabinet, panel, endpoint, allocatable, toPrint, total] = await Promise.all([
    db.label.groupBy({ by: ['state'], _count: { _all: true } }),
    db.label.count({ where: { roomId: { not: null } } }),
    db.label.count({ where: { cabinetId: { not: null } } }),
    db.label.count({ where: { panelId: { not: null } } }),
    db.label.count({ where: { cableEndpointId: { not: null } } }),
    db.label.count({ where: { state: 'GENERATED', firstBoundAt: null, ...UNBOUND } }),
    db.label.count({ where: { state: 'GENERATED', OR: Object.values(FK).map((k) => ({ [k]: { not: null } })) } }),
    db.label.count(),
  ]);
  const byState = Object.fromEntries(LABEL_STATES.map((s) => [s, 0])) as Record<LabelState, number>;
  for (const r of byStateRows) byState[r.state] = r._count._all;
  const bound = room + cabinet + panel + endpoint;
  return {
    total,
    byState,
    bound,
    unbound: total - bound,
    allocatable,
    toPrint,
    byKind: { ROOM: room, CABINET: cabinet, PANEL: panel, CABLE_ENDPOINT: endpoint },
  };
}

async function generate(db: Db, input: z.infer<typeof labelGenerateSchema>): Promise<LabelGenerateResult> {
  await lockAllocation(db);
  const batchNo = input.batchNo ?? `batch_${today()}`;
  const wanted = input.count !== undefined ? await nextNumbers(db, input.count) : parseRangeExpr(input.rangeExpr!);
  const existing = (await db.label.findMany({ where: { shortId: { in: wanted } }, select: { shortId: true } })).map((r) => r.shortId);
  const have = new Set(existing);
  const created = wanted.filter((n) => !have.has(n));
  await db.label.createMany({ data: created.map((shortId) => ({ shortId, batchNo })) });
  return { created, existing };
}

async function voidLabels(db: Db, input: z.infer<typeof labelVoidSchema>): Promise<LabelVoidResult> {
  const ids = input.shortIds ?? parseRangeExpr(input.rangeExpr!);
  const rows = await db.label.findMany({ where: { shortId: { in: ids } } });
  const byId = new Map(rows.map((r) => [r.shortId, r]));
  const result: LabelVoidResult = { voided: [], failed: [] };
  for (const id of ids) {
    const l = byId.get(id);
    if (!l) result.failed.push({ shortId: id, reason: 'NOT_FOUND' });
    else if (l.state === 'VOID') result.failed.push({ shortId: id, reason: 'ALREADY_VOID' });
    else if (l.roomId || l.cabinetId || l.panelId || l.cableEndpointId) result.failed.push({ shortId: id, reason: 'BOUND' });
    else result.voided.push(id);
  }
  if (result.voided.length) {
    await db.label.updateMany({
      where: { shortId: { in: result.voided }, ...UNBOUND },
      data: { state: 'VOID', notes: input.reason ?? 'void' },
    });
  }
  return result;
}

async function resolve(db: Db, shortId: number): Promise<LabelResolveResult> {
  const l = await db.label.findUnique({
    where: { shortId },
    include: {
      room: roomLoc,
      cabinet: { include: { room: roomLoc } },
      panel: { include: panelLocInclude },
      cableEndpoint: {
        include: { cable: { select: { label: true } }, port: { include: portLocInclude }, parkedPanel: { include: panelLocInclude } },
      },
    },
  });
  const base = { shortId, display: formatShortId(shortId) };
  if (!l) return { ...base, state: null, bound: null };
  let bound: LabelResolveResult['bound'] = null;
  if (l.room) bound = { kind: 'ROOM', id: l.room.id, path: roomPath(l.room) };
  else if (l.cabinet) bound = { kind: 'CABINET', id: l.cabinet.id, path: cabinetPath(l.cabinet) };
  else if (l.panel) bound = { kind: 'PANEL', id: l.panel.id, path: panelPath(l.panel) };
  else if (l.cableEndpoint) {
    bound = { kind: 'CABLE_ENDPOINT', id: l.cableEndpoint.id, path: endpointPath(l.cableEndpoint, l.cableEndpoint.cable.label ?? 'cable') };
  }
  return { ...base, state: l.state, bound };
}

async function missing(db: Db, input: z.infer<typeof labelMissingSchema>): Promise<MissingLabelItem[]> {
  const kinds = input.kind ? [input.kind] : LABEL_KINDS.filter((k) => k !== 'ROOM');
  const out: MissingLabelItem[] = [];
  for (const kind of kinds) {
    if (kind === 'ROOM') {
      for (const r of await db.room.findMany({ where: { label: null }, include: { dataCenter: true }, orderBy: { name: 'asc' } })) {
        out.push({ kind, id: r.id, name: r.name, path: roomPath(r) });
      }
    } else if (kind === 'CABINET') {
      for (const c of await db.cabinet.findMany({ where: { label: null }, include: { room: roomLoc } })) {
        out.push({ kind, id: c.id, name: c.name, path: cabinetPath(c) });
      }
    } else if (kind === 'PANEL') {
      for (const p of await db.panel.findMany({ where: { label: null }, include: panelLocInclude })) {
        out.push({ kind, id: p.id, name: p.name, path: panelPath(p) });
      }
    } else {
      const eps = await db.cableEndpoint.findMany({
        where: { label: null },
        include: { cable: { select: { label: true } }, port: { include: portLocInclude }, parkedPanel: { include: panelLocInclude } },
      });
      for (const e of eps) out.push({ kind, id: e.id, name: `${e.cable.label ?? 'cable'} ${e.end}`, path: endpointPath(e, e.cable.label ?? 'cable') });
    }
  }
  return out;
}

// ---------- print tasks ----------

function taskDto(t: Prisma.PrintTaskGetPayload<{ include: { _count: { select: { labels: true } } } }>): PrintTaskDto {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    notes: t.notes,
    createdBy: t.createdBy,
    count: t._count.labels,
    createdAt: iso(t.createdAt),
    completedAt: isoOrNull(t.completedAt),
  };
}

const taskInclude = { _count: { select: { labels: true } } } as const;

async function listPrintTasks(db: Db, input: z.infer<typeof printTaskListSchema>): Promise<Paged<PrintTaskDto>> {
  const where = input.status ? { status: input.status } : {};
  const [rows, total] = await Promise.all([
    db.printTask.findMany({ where, include: taskInclude, orderBy: { createdAt: 'desc' }, take: input.take, skip: input.skip }),
    db.printTask.count({ where }),
  ]);
  return { items: rows.map(taskDto), total };
}

/** New numbers (count), or existing labels (shortIds / rangeExpr) that are not VOID. */
async function createPrintTask(db: Db, input: z.infer<typeof printTaskCreateSchema>): Promise<PrintTaskDto & { shortIds: number[] }> {
  let shortIds: number[];
  if (input.count !== undefined) {
    shortIds = (await generate(db, { count: input.count, batchNo: input.name })).created;
  } else {
    shortIds = input.shortIds ? [...new Set(input.shortIds)].sort((a, b) => a - b) : parseRangeExpr(input.rangeExpr!);
    const rows = await db.label.findMany({ where: { shortId: { in: shortIds } }, select: { shortId: true, state: true } });
    const known = new Map(rows.map((r) => [r.shortId, r.state]));
    const bad = shortIds.filter((n) => known.get(n) === undefined || known.get(n) === 'VOID');
    if (bad.length) throw new AppError('LABEL_NOT_AVAILABLE', 'labels missing or void', { shortIds: bad });
  }
  const task = await db.printTask.create({ data: { name: input.name, notes: input.notes, createdBy: input.createdBy } });
  await db.label.updateMany({ where: { shortId: { in: shortIds } }, data: { printTaskId: task.id } });
  const full = must(await db.printTask.findUnique({ where: { id: task.id }, include: taskInclude }), 'print task');
  return { ...taskDto(full), shortIds };
}

export interface PrintTaskCsvRow {
  shortId: number;
  display: string;
  state: LabelState;
  bound: string;
}

async function printTaskRows(db: Db, id: string): Promise<{ task: PrintTaskDto; rows: PrintTaskCsvRow[] }> {
  const task = must(await db.printTask.findUnique({ where: { id }, include: taskInclude }), 'print task', { id });
  const labels = await db.label.findMany({ where: { printTaskId: id }, include: bindingInclude, orderBy: { shortId: 'asc' } });
  return {
    task: taskDto(task),
    rows: labels.map((l) => {
      const b = binding(l);
      return { shortId: l.shortId, display: formatShortId(l.shortId), state: l.state, bound: b ? `${b.kind}:${b.name}` : '' };
    }),
  };
}

async function completePrintTask(db: Db, input: z.infer<typeof printTaskCompleteSchema>): Promise<PrintTaskDto> {
  must(await db.printTask.findUnique({ where: { id: input.id } }), 'print task', { id: input.id });
  const now = new Date();
  await db.printTask.update({ where: { id: input.id }, data: { status: input.status, completedAt: now } });
  if (input.status === 'COMPLETED') {
    await db.label.updateMany({ where: { printTaskId: input.id, state: 'GENERATED' }, data: { state: 'PRINTED', printedAt: now } });
  }
  return taskDto(must(await db.printTask.findUnique({ where: { id: input.id }, include: taskInclude }), 'print task'));
}

export function toCsv(rows: Record<string, string | number>[], columns: string[]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.join(','), ...rows.map((r) => columns.map((c) => esc(r[c] ?? '')).join(','))].join('\n') + '\n';
}

export const labelService = {
  FK,
  bind,
  assign,
  autoAllocate,
  rebind,
  get,
  list,
  stats,
  generate,
  void: voidLabels,
  resolve,
  missing,
  listPrintTasks,
  createPrintTask,
  printTaskRows,
  completePrintTask,
};
