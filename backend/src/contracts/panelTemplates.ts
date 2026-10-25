import { z } from 'zod';
import { DEVICE_TYPES, PANEL_FACES, PANEL_TYPES, PORT_TYPES } from './enums';
import type { PanelFace, PanelType } from './enums';
import { idSchema, optText, shortIdSchema } from './common';
import { rotationSchema } from './hierarchy';
import { trailingNumber } from './ifName';
import { GENERATOR_ORDERS, GeneratorError, generatePorts as generateRaw } from './panelGenerator';
import type { PanelGenerator, TemplatePortDraft } from './panelGenerator';

export { PORT_SIZE_MM } from './portSizes';
export { GENERATOR_PRESETS, GeneratorError, generatorIssues, pruneOverrides } from './panelGenerator';
export type { GeneratorGroup, GeneratorIssue, GeneratorOverride, GeneratorPresetKey, PanelGenerator, TemplatePortDraft } from './panelGenerator';

// ---------- generator (versioned, stored in PanelTemplate.generator) ----------
// Defaults live in the pure generatePorts (panelGenerator.ts), so the stored JSON stays as written.

const mm = z.number().min(0).max(10_000);

export const generatorGroupSchema = z.object({
  portType: z.enum(PORT_TYPES),
  count: z.number().int().min(1).max(256),
  numberPrefix: z.string().max(40).optional(),
  startIndex: z.number().int().min(0).max(10_000).optional(),
  indexStep: z.number().int().min(1).max(100).optional(),
  names: z.array(z.string().trim().min(1).max(50)).max(256).optional(),
  ifNamePattern: z.string().max(100).optional(),
  rows: z.number().int().min(1).max(8).optional(),
  order: z.enum(GENERATOR_ORDERS).optional(),
  xMm: mm.optional(),
  yMm: mm.optional(),
  gapMm: z.number().min(0).max(1000).optional(),
  pitchXMm: z.number().min(0).max(1000).optional(),
  pitchYMm: z.number().min(0).max(1000).optional(),
  wMm: z.number().positive().max(1000).optional(),
  hMm: z.number().positive().max(1000).optional(),
  rotation: rotationSchema.optional(),
});

export const generatorSchema = z.object({
  version: z.literal(1),
  groups: z.array(generatorGroupSchema).min(1).max(32),
  overrides: z.array(z.object({ number: z.string().min(1).max(50), xMm: mm, yMm: mm })).max(1024).optional(),
});

// the zod schema and the pure interface describe the same JSON
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
const _sameGenerator: Same<z.infer<typeof generatorSchema>, PanelGenerator> = true;
void _sameGenerator;

/** Validate, then expand a generator into port drafts. Throws GeneratorError (or ZodError). */
export function generatePorts(input: unknown, opts: { panelHeightMm?: number } = {}): TemplatePortDraft[] {
  return generateRaw(generatorSchema.parse(input), opts);
}
export const isGeneratorError = (e: unknown): e is GeneratorError => e instanceof GeneratorError;

/** Expand "{n}" in a template port ifName with the trailing number of the port number. */
export function expandIfName(pattern: string | null, number: string): string | null {
  if (!pattern) return null;
  if (!pattern.includes('{n}')) return pattern;
  const n = trailingNumber(number);
  return n === null ? null : pattern.replace(/\{n\}/g, String(n));
}

// ---------- requests ----------

export const templatePortSchema = z.object({
  number: z.string().trim().min(1).max(50),
  sortIndex: z.number().int().min(0),
  portType: z.enum(PORT_TYPES),
  ifName: z.string().trim().max(100).nullish(),
  xMm: z.number().min(0).max(10_000),
  yMm: z.number().min(0).max(10_000),
  wMm: z.number().positive().max(1000),
  hMm: z.number().positive().max(1000),
  rotation: rotationSchema.default(0),
});

const templateBody = {
  name: z.string().trim().min(1).max(200),
  type: z.enum(PANEL_TYPES),
  face: z.enum(PANEL_FACES).default('FRONT'),
  deviceModelId: idSchema.nullish(),
  widthMm: z.number().positive().max(10_000).default(482.6),
  heightMm: z.number().positive().max(10_000).default(44.45),
  description: optText(),
  /** give a generator (ports are generated from it) or explicit ports (the generator is dropped) */
  generator: generatorSchema.nullish(),
  ports: z.array(templatePortSchema).max(1024).optional(),
};

const notBoth = (v: { generator?: unknown; ports?: unknown }) => !(v.generator && v.ports);
const notBothMsg = { message: 'give either generator or ports, not both' };

export const templateListSchema = z.object({ deviceModelId: idSchema.optional(), type: z.enum(PANEL_TYPES).optional() });
export const templateCreateSchema = z.object(templateBody).refine(notBoth, notBothMsg);
export const templateUpdateSchema = z
  .object({
    id: idSchema,
    name: templateBody.name.optional(),
    type: templateBody.type.optional(),
    face: z.enum(PANEL_FACES).optional(),
    deviceModelId: idSchema.nullish(),
    widthMm: z.number().positive().max(10_000).optional(),
    heightMm: z.number().positive().max(10_000).optional(),
    description: optText().optional(),
    generator: generatorSchema.nullish(),
    ports: z.array(templatePortSchema).max(1024).optional(),
  })
  .refine(notBoth, notBothMsg);
export const generatePreviewSchema = z.object({ generator: generatorSchema, heightMm: z.number().positive().max(10_000).optional() });
export const applyPreviewSchema = z.object({ templateId: idSchema, panelId: idSchema });
export const applySchema = z.object({ templateId: idSchema, panelId: idSchema, expectedRevision: z.number().int().min(1) });
export const createPanelFromTemplateSchema = z.object({
  templateId: idSchema,
  deviceId: idSchema,
  name: z.string().trim().min(1).max(100).optional(),
  face: z.enum(PANEL_FACES).optional(),
  labelShortId: shortIdSchema.optional(),
});
/** One panel per template on a freshly created device (labels are auto-allocated). */
export const createPanelsFromTemplatesSchema = z.object({
  deviceId: idSchema,
  templateIds: z.array(idSchema).min(1).max(20),
});
export const unbindSchema = z.object({ panelId: idSchema });
export const exportSchema = z.object({ ids: z.array(idSchema).max(1000).optional() });

/**
 * Batch apply to every device of the template's device model.
 * A target without panelId gets a new panel created from the template.
 */
export const batchPreviewSchema = z.object({ templateId: idSchema });
export const batchApplySchema = z.object({
  templateId: idSchema,
  expectedRevision: z.number().int().min(1),
  targets: z
    .array(z.object({ deviceId: idSchema, panelId: idSchema.nullish() }))
    .min(1)
    .max(500),
});

export const deviceModelRefSchema = z.object({
  vendor: z.string().trim().max(100).default(''),
  name: z.string().trim().min(1).max(200),
  deviceType: z.enum(DEVICE_TYPES).default('OTHER'),
  uHeight: z.number().int().min(1).max(60).optional(),
  depthMm: z.number().int().positive().max(3000).nullish(),
});

export const TEMPLATE_DOC_FORMAT = 'dcagent.panel-template';

/**
 * Exchange format (template-kit). When `generator` is present it wins: ports are regenerated from it
 * and the `ports` list (written by export for readers without a generator) is ignored.
 */
export const templateDocItemSchema = z
  .object({
    name: templateBody.name,
    type: z.enum(PANEL_TYPES),
    face: z.enum(PANEL_FACES).default('FRONT'),
    deviceModel: deviceModelRefSchema.nullish(),
    widthMm: z.number().positive().max(10_000),
    heightMm: z.number().positive().max(10_000),
    description: z.string().max(2000).nullish(),
    generator: generatorSchema.nullish(),
    ports: z.array(templatePortSchema).max(1024).optional(),
  })
  .refine((v) => !!v.generator || !!v.ports, { message: 'give a generator or ports' });

export const templateDocSchema = z.object({
  format: z.literal(TEMPLATE_DOC_FORMAT),
  version: z.literal(1),
  templates: z.array(templateDocItemSchema).max(500),
});
export type TemplateDoc = z.infer<typeof templateDocSchema>;
export type TemplateDocIn = z.input<typeof templateDocSchema>;
/** create: an existing name is a conflict. upsert: changed templates are replaced (revision + 1), identical ones are left alone. */
export const importSchema = z.object({ doc: templateDocSchema, mode: z.enum(['create', 'upsert']) });
export const importPresetsSchema = z.object({}).strict();

// ---------- responses ----------

export interface TemplatePortDto extends TemplatePortDraft {
  id: string;
}

export interface PanelTemplateDto {
  id: string;
  name: string;
  type: PanelType;
  face: PanelFace;
  deviceModelId: string | null;
  deviceModel: { id: string; vendor: string; name: string } | null;
  widthMm: number;
  heightMm: number;
  generator: PanelGenerator | null;
  revision: number;
  description: string | null;
  portCount: number;
  panelCount: number;
  ports?: TemplatePortDto[];
  createdAt: string;
  updatedAt: string;
}

/** Why a port is not deleted: in use (CABLE..OBSERVATION) or annotated by hand (ADMIN_STATE, LABEL, NOTES; template apply only). */
export const KEEP_REASONS = ['CABLE', 'MODULE', 'IP', 'WORKSTATION', 'OBSERVATION', 'ADMIN_STATE', 'LABEL', 'NOTES'] as const;
export type KeepReason = (typeof KEEP_REASONS)[number];

/** Why an apply is refused. Nothing is written when conflicts[] is not empty. */
export const CONFLICT_KINDS = ['IFNAME_TAKEN', 'MODULE_DOES_NOT_FIT'] as const;
export type ConflictKind = (typeof CONFLICT_KINDS)[number];
export interface ApplyConflict {
  kind: ConflictKind;
  /** port on the panel that causes the conflict */
  portId: string;
  number: string;
  /** IFNAME_TAKEN: the interface name; MODULE_DOES_NOT_FIT: the new port type */
  value: string;
}

export interface ApplyDiff {
  templateId: string;
  panelId: string;
  revision: number;
  create: TemplatePortDraft[];
  update: { portId: string; number: string; changes: string[] }[];
  delete: { portId: string; number: string }[];
  kept: { portId: string; number: string; reasons: KeepReason[] }[];
  conflicts: ApplyConflict[];
}

export interface BatchTarget {
  deviceId: string;
  deviceName: string;
  /** panel the template would be applied to; null: a new panel is created */
  panelId: string | null;
  panelName: string | null;
  /** diff for an existing panel; null when a panel is created */
  diff: ApplyDiff | null;
}

export interface BatchPreview {
  templateId: string;
  revision: number;
  targets: BatchTarget[];
}

export interface BatchResult {
  applied: { deviceId: string; panelId: string; created: boolean }[];
}

export interface ImportResult {
  created: string[];
  updated: string[];
  unchanged: string[];
}
