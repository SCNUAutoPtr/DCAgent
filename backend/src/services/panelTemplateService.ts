import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, invalid, must } from '../http/errors';
import { MODULE_FITS } from '../contracts/moduleFits';
import {
  type ApplyConflict,
  type ApplyDiff,
  type BatchPreview,
  type BatchResult,
  type ImportResult,
  type PanelGenerator,
  type PanelTemplateDto,
  type TemplateDoc,
  type TemplatePortDraft,
  batchApplySchema,
  createPanelFromTemplateSchema,
  expandIfName,
  generatePorts,
  generatorSchema,
  isGeneratorError,
  templateCreateSchema,
  templateDocSchema,
  templateListSchema,
  templatePortSchema,
  templateUpdateSchema,
} from '../contracts/panelTemplates';
import { labelService } from './labelService';
import { panelService } from './panelService';
import { portDependents } from './portService';
import type { PortDependents } from '../contracts/panels';
import { iso } from './shared';

/** template-kit/examples at the repository root: the system presets. */
const PRESETS_DIR = path.resolve(__dirname, '..', '..', '..', 'template-kit', 'examples');

const include = {
  deviceModel: { select: { id: true, vendor: true, name: true, deviceType: true } },
  ports: { orderBy: { sortIndex: 'asc' as const } },
  _count: { select: { panels: true } },
} as const satisfies Prisma.PanelTemplateInclude;
type Row = Prisma.PanelTemplateGetPayload<{ include: typeof include }>;

function parseGenerator(json: unknown): PanelGenerator | null {
  if (json === null || json === undefined) return null;
  const r = generatorSchema.safeParse(json);
  return r.success ? r.data : null;
}

const draftOf = (p: Row['ports'][number]): TemplatePortDraft => ({
  number: p.number,
  sortIndex: p.sortIndex,
  portType: p.portType,
  ifName: p.ifName,
  xMm: p.xMm,
  yMm: p.yMm,
  wMm: p.wMm,
  hMm: p.hMm,
  rotation: p.rotation,
});

function dto(t: Row, withPorts: boolean): PanelTemplateDto {
  return {
    id: t.id,
    name: t.name,
    type: t.type,
    face: t.face,
    deviceModelId: t.deviceModelId,
    deviceModel: t.deviceModel ? { id: t.deviceModel.id, vendor: t.deviceModel.vendor, name: t.deviceModel.name } : null,
    widthMm: t.widthMm,
    heightMm: t.heightMm,
    generator: parseGenerator(t.generator),
    revision: t.revision,
    description: t.description,
    portCount: t.ports.length,
    panelCount: t._count.panels,
    ...(withPorts ? { ports: t.ports.map((p) => ({ id: p.id, ...draftOf(p) })) } : {}),
    createdAt: iso(t.createdAt),
    updatedAt: iso(t.updatedAt),
  };
}

async function load(db: Db, id: string) {
  return must(await db.panelTemplate.findUnique({ where: { id }, include }), 'panel template', { id });
}

/** Ports of a template: generated from the generator, or the explicit list (checked for duplicates). */
function draftsFrom(generator: PanelGenerator | null | undefined, ports: z.infer<typeof templatePortSchema>[] | undefined, heightMm: number): TemplatePortDraft[] | undefined {
  if (generator) {
    try {
      return generatePorts(generator, { panelHeightMm: heightMm });
    } catch (e) {
      if (isGeneratorError(e)) throw invalid(e.message, { issues: e.issues });
      throw e;
    }
  }
  if (!ports) return undefined;
  const numbers = new Set<string>();
  const ifNames = new Set<string>();
  for (const p of ports) {
    if (numbers.has(p.number)) throw invalid(`duplicate port number ${p.number}`, { issues: [{ kind: 'DUPLICATE_NUMBER', value: p.number }] });
    numbers.add(p.number);
    if (p.ifName) {
      if (ifNames.has(p.ifName)) throw invalid(`duplicate interface name ${p.ifName}`, { issues: [{ kind: 'DUPLICATE_IFNAME', value: p.ifName }] });
      ifNames.add(p.ifName);
    }
  }
  return [...ports].sort((a, b) => a.sortIndex - b.sortIndex).map((p, i) => ({ ...p, sortIndex: i + 1, ifName: p.ifName || null }));
}

/** JSON with sorted keys: jsonb does not keep key order, so compare through this. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

const samePorts = (a: TemplatePortDraft[], b: TemplatePortDraft[]) => stable(a) === stable(b);

async function replacePorts(db: Db, templateId: string, ports: TemplatePortDraft[]) {
  await db.panelTemplatePort.deleteMany({ where: { templateId } });
  await db.panelTemplatePort.createMany({ data: ports.map((p) => ({ ...p, templateId })) });
}

const jsonOrNull = (g: PanelGenerator | null) => (g ? (g as unknown as Prisma.InputJsonValue) : Prisma.DbNull);

// ---------- diff ----------

const COMPARED = ['portType', 'sortIndex', 'ifName', 'xMm', 'yMm', 'wMm', 'hMm', 'rotation'] as const;

interface Plan extends ApplyDiff {
  /** full new values of matched ports that change */
  updates: { portId: string; data: Omit<TemplatePortDraft, 'number'> }[];
  /** kept ports moved behind the template ports, in their previous order */
  resort: { portId: string; sortIndex: number }[];
}

const wantedPorts = (t: Row): TemplatePortDraft[] => t.ports.map((p) => ({ ...draftOf(p), ifName: expandIfName(p.ifName, p.number) }));

/**
 * Match by number. Never touches adminState, label, notes or connections of matched ports.
 * A port the template does not have is deleted only when nothing would be lost: it is kept when it is
 * in use (cable, module, IP, workstation, observations) or carries data someone typed in (adminState
 * other than NORMAL, a label, notes). Module movement history survives a delete through the path
 * snapshot on ModuleMovement.
 * Conflicts (refused as a whole): a kept port holds an interface name the template wants,
 * or a matched port carries a module that does not fit its new port type.
 */
async function plan(db: Db, t: Row, panelId: string): Promise<Plan> {
  const ports = await db.port.findMany({
    where: { panelId },
    include: { opticalModule: { select: { moduleType: true } } },
    orderBy: [{ sortIndex: 'asc' }, { number: 'asc' }],
  });
  const byNumber = new Map(ports.map((p) => [p.number, p]));
  const wanted = wantedPorts(t);
  const wantedNumbers = new Set(wanted.map((w) => w.number));
  const out: Plan = { templateId: t.id, panelId, revision: t.revision, create: [], update: [], delete: [], kept: [], conflicts: [], updates: [], resort: [] };

  for (const w of wanted) {
    const cur = byNumber.get(w.number);
    if (!cur) {
      out.create.push(w);
      continue;
    }
    const changes = COMPARED.filter((k) => cur[k] !== w[k]);
    if (!changes.length) continue;
    if (cur.opticalModule && cur.portType !== w.portType && !(MODULE_FITS[w.portType] ?? []).includes(cur.opticalModule.moduleType)) {
      out.conflicts.push({ kind: 'MODULE_DOES_NOT_FIT', portId: cur.id, number: cur.number, value: w.portType });
    }
    out.update.push({ portId: cur.id, number: cur.number, changes: [...changes] });
    const { number: _n, ...data } = w;
    out.updates.push({ portId: cur.id, data });
  }

  const extra = ports.filter((p) => !wantedNumbers.has(p.number));
  if (extra.length) {
    const deps = await portDependents(db, { id: { in: extra.map((p) => p.id) } }, true);
    const busy = new Map(deps.map((d) => [d.portId, d]));
    const wantedIfNames = new Set(wanted.map((w) => w.ifName).filter((n): n is string => !!n));
    let next = wanted.length;
    for (const p of extra) {
      const reasons: PortDependents['reasons'] = [...(busy.get(p.id)?.reasons ?? [])];
      if (p.adminState !== 'NORMAL') reasons.push('ADMIN_STATE');
      if (p.label) reasons.push('LABEL');
      if (p.notes) reasons.push('NOTES');
      if (!reasons.length) {
        out.delete.push({ portId: p.id, number: p.number });
        continue;
      }
      out.kept.push({ portId: p.id, number: p.number, reasons });
      if (p.ifName && wantedIfNames.has(p.ifName)) {
        out.conflicts.push({ kind: 'IFNAME_TAKEN', portId: p.id, number: p.number, value: p.ifName });
      }
      next += 1;
      if (p.sortIndex !== next) out.resort.push({ portId: p.id, sortIndex: next });
    }
  }
  return out;
}

const publicDiff = ({ updates: _u, resort: _r, ...d }: Plan): ApplyDiff => d;

async function execute(db: Db, t: Row, panelId: string, p: Plan) {
  if (p.delete.length) await db.port.deleteMany({ where: { id: { in: p.delete.map((x) => x.portId) } } });
  // free interface names first so two ports can swap them without hitting @@unique([panelId, ifName])
  const renamed = p.update.filter((u) => u.changes.includes('ifName')).map((u) => u.portId);
  if (renamed.length) await db.port.updateMany({ where: { id: { in: renamed } }, data: { ifName: null } });
  for (const u of p.updates) await db.port.update({ where: { id: u.portId }, data: u.data });
  for (const r of p.resort) await db.port.update({ where: { id: r.portId }, data: { sortIndex: r.sortIndex } });
  if (p.create.length) await db.port.createMany({ data: p.create.map((c) => ({ ...c, panelId })) });
  await db.panel.update({ where: { id: panelId }, data: { templateId: t.id, templateRevision: t.revision, widthMm: t.widthMm, heightMm: t.heightMm } });
}

function checkRevision(t: Row, expected: number) {
  if (t.revision !== expected) {
    throw new AppError('TEMPLATE_REVISION_MISMATCH', 'template changed since the preview', { expected, actual: t.revision });
  }
}

function refuse(conflicts: (ApplyConflict & { deviceId?: string; panelId?: string })[]): never {
  throw new AppError('TEMPLATE_CONFLICT', 'template conflicts with ports in use', {
    conflicts: conflicts.map((c) => ({ ...c, name: `${c.number}: ${c.value}` })),
  });
}

async function createPanelFrom(db: Db, t: Row, input: { deviceId: string; name?: string; face?: Row['face']; labelShortId?: number }) {
  must(await db.device.findUnique({ where: { id: input.deviceId }, select: { id: true } }), 'device', { id: input.deviceId });
  const panel = await db.panel.create({
    data: {
      deviceId: input.deviceId,
      name: input.name ?? t.name,
      type: t.type,
      face: input.face ?? t.face,
      templateId: t.id,
      templateRevision: t.revision,
      widthMm: t.widthMm,
      heightMm: t.heightMm,
    },
  });
  await labelService.assign(db, { kind: 'PANEL', id: panel.id }, input.labelShortId);
  if (t.ports.length) await db.port.createMany({ data: wantedPorts(t).map((p) => ({ ...p, panelId: panel.id })) });
  return panel.id;
}

/** The panel of a device the template goes onto: one already bound to it, else the only panel with the same face, else a same-name panel. */
function pickPanel<P extends { id: string; name: string; face: string; templateId: string | null }>(t: Row, panels: P[]): P | null {
  const bound = panels.find((p) => p.templateId === t.id);
  if (bound) return bound;
  const sameFace = panels.filter((p) => p.face === t.face);
  if (sameFace.length === 1) return sameFace[0];
  return sameFace.find((p) => p.name === t.name) ?? null;
}

// ---------- import ----------

type DocItem = TemplateDoc['templates'][number];

function readPresets(): TemplateDoc {
  const files = readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json')).sort();
  const templates = files.flatMap((f) => {
    const r = templateDocSchema.safeParse(JSON.parse(readFileSync(path.join(PRESETS_DIR, f), 'utf8')));
    if (!r.success) throw invalid(`preset ${f} is not a valid template document`, r.error.issues);
    return r.data.templates;
  });
  return { format: 'dcagent.panel-template', version: 1, templates };
}

async function importOne(db: Db, t: DocItem, mode: 'create' | 'upsert', result: ImportResult) {
  let deviceModelId: string | null = null;
  if (t.deviceModel) {
    const m = t.deviceModel;
    const row = await db.deviceModel.upsert({
      where: { vendor_name: { vendor: m.vendor, name: m.name } },
      create: { vendor: m.vendor, name: m.name, deviceType: m.deviceType, uHeight: m.uHeight ?? null, depthMm: m.depthMm ?? null },
      update: {},
    });
    deviceModelId = row.id;
  }
  const generator = t.generator ?? null;
  const drafts = draftsFrom(generator, generator ? undefined : t.ports, t.heightMm)!;
  const data = {
    name: t.name,
    type: t.type,
    face: t.face,
    deviceModelId,
    widthMm: t.widthMm,
    heightMm: t.heightMm,
    description: t.description ?? null,
  };
  const existing = await db.panelTemplate.findUnique({ where: { name: t.name }, include });
  if (existing && mode === 'create') throw new AppError('UNIQUE_VIOLATION', `template ${t.name} already exists`, { name: t.name });
  if (!existing) {
    const created = await db.panelTemplate.create({ data: { ...data, generator: jsonOrNull(generator) } });
    await replacePorts(db, created.id, drafts);
    result.created.push(created.id);
    return;
  }
  const same =
    stable({ ...data, generator }) ===
      stable({
        name: existing.name,
        type: existing.type,
        face: existing.face,
        deviceModelId: existing.deviceModelId,
        widthMm: existing.widthMm,
        heightMm: existing.heightMm,
        description: existing.description,
        generator: parseGenerator(existing.generator),
      }) && samePorts(drafts, existing.ports.map(draftOf));
  if (same) {
    result.unchanged.push(existing.id);
    return;
  }
  await db.panelTemplate.update({ where: { id: existing.id }, data: { ...data, generator: jsonOrNull(generator), revision: existing.revision + 1 } });
  await replacePorts(db, existing.id, drafts);
  result.updated.push(existing.id);
}

// ---------- service ----------

export const panelTemplateService = {
  async list(db: Db, input: z.infer<typeof templateListSchema>) {
    const rows = await db.panelTemplate.findMany({ where: { deviceModelId: input.deviceModelId, type: input.type }, include, orderBy: { name: 'asc' } });
    return rows.map((r) => dto(r, false));
  },
  async get(db: Db, id: string) {
    return dto(await load(db, id), true);
  },
  async create(db: Db, { generator, ports, ...data }: z.infer<typeof templateCreateSchema>) {
    const drafts = draftsFrom(generator, ports, data.heightMm) ?? [];
    const t = await db.panelTemplate.create({ data: { ...data, generator: jsonOrNull(generator ?? null) } });
    await replacePorts(db, t.id, drafts);
    return dto(await load(db, t.id), true);
  },
  /**
   * A generator regenerates the ports; explicit ports replace them and drop the generator.
   * The revision moves only when the ports or the plate size really change.
   */
  async update(db: Db, { id, generator, ports, ...data }: z.infer<typeof templateUpdateSchema>) {
    const t = await load(db, id);
    const heightMm = data.heightMm ?? t.heightMm;
    const keepGenerator = generator === undefined && !ports ? parseGenerator(t.generator) : null;
    const nextGenerator = generator ?? (ports ? null : keepGenerator);
    // a stored generator is re-run when the plate height changes (groups may be centred vertically)
    const drafts = draftsFrom(generator ?? (data.heightMm !== undefined ? keepGenerator : null), ports, heightMm);
    const portsChanged = !!drafts && !samePorts(drafts, t.ports.map(draftOf));
    const sizeChanged = (data.widthMm ?? t.widthMm) !== t.widthMm || heightMm !== t.heightMm;
    await db.panelTemplate.update({
      where: { id },
      data: {
        ...data,
        ...(generator !== undefined || ports ? { generator: jsonOrNull(nextGenerator) } : {}),
        ...(portsChanged || sizeChanged ? { revision: t.revision + 1 } : {}),
      },
    });
    if (drafts && portsChanged) await replacePorts(db, id, drafts);
    return dto(await load(db, id), true);
  },
  async delete(db: Db, id: string) {
    await load(db, id);
    await db.panelTemplate.delete({ where: { id } });
    return { ok: true as const };
  },
  generatePreview(generator: PanelGenerator, heightMm?: number) {
    return draftsFrom(generator, undefined, heightMm ?? 44.45)!;
  },
  async applyPreview(db: Db, templateId: string, panelId: string): Promise<ApplyDiff> {
    const t = await load(db, templateId);
    must(await db.panel.findUnique({ where: { id: panelId }, select: { id: true } }), 'panel', { id: panelId });
    return publicDiff(await plan(db, t, panelId));
  },
  /** One transaction: revision check, conflicts refuse everything, then delete / update / create. */
  async apply(db: Db, input: { templateId: string; panelId: string; expectedRevision: number }): Promise<ApplyDiff> {
    const t = await load(db, input.templateId);
    checkRevision(t, input.expectedRevision);
    must(await db.panel.findUnique({ where: { id: input.panelId }, select: { id: true } }), 'panel', { id: input.panelId });
    const p = await plan(db, t, input.panelId);
    if (p.conflicts.length) refuse(p.conflicts);
    await execute(db, t, input.panelId, p);
    return publicDiff(p);
  },
  async createPanel(db: Db, input: z.infer<typeof createPanelFromTemplateSchema>) {
    const t = await load(db, input.templateId);
    return panelService.get(db, await createPanelFrom(db, t, input));
  },
  async createPanels(db: Db, input: { deviceId: string; templateIds: string[] }) {
    const out = [];
    for (const id of input.templateIds) {
      const t = await load(db, id);
      out.push(await panelService.get(db, await createPanelFrom(db, t, { deviceId: input.deviceId })));
    }
    return out;
  },
  /** Devices of the template's device model and what applying to each would do. */
  async batchPreview(db: Db, templateId: string): Promise<BatchPreview> {
    const t = await load(db, templateId);
    if (!t.deviceModelId) throw invalid('template has no device model', { templateId });
    const devices = await db.device.findMany({
      where: { deviceModelId: t.deviceModelId },
      select: { id: true, name: true, panels: { select: { id: true, name: true, face: true, templateId: true }, orderBy: { name: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    const targets = [];
    for (const d of devices) {
      const panel = pickPanel(t, d.panels);
      targets.push({
        deviceId: d.id,
        deviceName: d.name,
        panelId: panel?.id ?? null,
        panelName: panel?.name ?? null,
        diff: panel ? publicDiff(await plan(db, t, panel.id)) : null,
      });
    }
    return { templateId: t.id, revision: t.revision, targets };
  },
  /** All targets in one transaction; any conflict anywhere refuses the whole batch. */
  async batchApply(db: Db, input: z.infer<typeof batchApplySchema>): Promise<BatchResult> {
    const t = await load(db, input.templateId);
    checkRevision(t, input.expectedRevision);
    const plans: { deviceId: string; panelId: string; plan: Plan }[] = [];
    const creates: string[] = [];
    for (const target of input.targets) {
      if (!target.panelId) {
        creates.push(target.deviceId);
        continue;
      }
      const panel = must(await db.panel.findUnique({ where: { id: target.panelId }, select: { deviceId: true } }), 'panel', { id: target.panelId });
      if (panel.deviceId !== target.deviceId) throw invalid('panel does not belong to the device', target);
      plans.push({ deviceId: target.deviceId, panelId: target.panelId, plan: await plan(db, t, target.panelId) });
    }
    const conflicts = plans.flatMap((p) => p.plan.conflicts.map((c) => ({ ...c, deviceId: p.deviceId, panelId: p.panelId })));
    if (conflicts.length) refuse(conflicts);
    const applied: BatchResult['applied'] = [];
    for (const p of plans) {
      await execute(db, t, p.panelId, p.plan);
      applied.push({ deviceId: p.deviceId, panelId: p.panelId, created: false });
    }
    for (const deviceId of creates) applied.push({ deviceId, panelId: await createPanelFrom(db, t, { deviceId }), created: true });
    return { applied };
  },
  async unbind(db: Db, panelId: string) {
    must(await db.panel.findUnique({ where: { id: panelId }, select: { id: true } }), 'panel', { id: panelId });
    await db.panel.update({ where: { id: panelId }, data: { templateId: null, templateRevision: null } });
    return panelService.get(db, panelId);
  },
  /** Generator templates carry their generator and the generated ports (for readers without a generator). */
  async export(db: Db, ids?: string[]): Promise<TemplateDoc> {
    const rows = await db.panelTemplate.findMany({ where: ids ? { id: { in: ids } } : {}, include, orderBy: { name: 'asc' } });
    return {
      format: 'dcagent.panel-template',
      version: 1,
      templates: rows.map((t) => ({
        name: t.name,
        type: t.type,
        face: t.face,
        deviceModel: t.deviceModel ? { vendor: t.deviceModel.vendor, name: t.deviceModel.name, deviceType: t.deviceModel.deviceType } : null,
        widthMm: t.widthMm,
        heightMm: t.heightMm,
        description: t.description,
        generator: parseGenerator(t.generator),
        ports: t.ports.map((p) => ({ ...draftOf(p), rotation: p.rotation as 0 | 90 | 180 | 270 })),
      })),
    };
  },
  async import(db: Db, doc: TemplateDoc, mode: 'create' | 'upsert'): Promise<ImportResult> {
    const result: ImportResult = { created: [], updated: [], unchanged: [] };
    for (const t of doc.templates) await importOne(db, t, mode, result);
    return result;
  },
  /** template-kit/examples as system presets; safe to run any number of times. */
  async importPresets(db: Db): Promise<ImportResult> {
    return panelTemplateService.import(db, readPresets(), 'upsert');
  },
};
