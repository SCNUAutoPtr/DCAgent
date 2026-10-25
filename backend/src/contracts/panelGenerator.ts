// Parametric panel generator. Pure and dependency-free: the backend validates the input with
// zod (panelTemplates.ts) and the frontend imports generatePorts directly for its live preview.
import type { PortType } from './enums';
import { PORT_SIZE_MM } from './portSizes';

export const GENERATOR_VERSION = 1;

export type Rotation = 0 | 90 | 180 | 270;

/** COLUMN_MAJOR with 2 rows is the usual switch layout: 1 top, 2 below, 3 top... ("odd top, even bottom"). */
export const GENERATOR_ORDERS = ['ROW_MAJOR', 'COLUMN_MAJOR'] as const;
export type GeneratorOrder = (typeof GENERATOR_ORDERS)[number];

/** One run of identical ports. Every optional field has a documented default. */
export interface GeneratorGroup {
  portType: PortType;
  count: number;
  /** port number = numberPrefix + index, e.g. "ge" + 1, "GE0/0/" + 1. Default "" */
  numberPrefix?: string;
  /** first index. Default 1 */
  startIndex?: number;
  /** index increment. Default 1 */
  indexStep?: number;
  /** explicit port numbers ("PSU1", "BMC", "VGA"); length must equal count; overrides prefix + index */
  names?: string[];
  /** interface name, may contain {n} (the index): "GigabitEthernet0/0/{n}" */
  ifNamePattern?: string;
  /** Default 1 */
  rows?: number;
  /** Default ROW_MAJOR */
  order?: GeneratorOrder;
  /** left edge of the group. Omitted: right edge of the previous group + gapMm (first group: gapMm) */
  xMm?: number;
  /** top edge of the group. Omitted: centred vertically on the panel */
  yMm?: number;
  /** distance to the previous group when xMm is omitted. Default 8 */
  gapMm?: number;
  /** column pitch. Default port width + 2 */
  pitchXMm?: number;
  /** row pitch. Default port height + 2 */
  pitchYMm?: number;
  /** cage size. Default PORT_SIZE_MM[portType] */
  wMm?: number;
  hMm?: number;
  /** Default 0 */
  rotation?: Rotation;
}

/** Hand-made position of one generated port (drag adjustment in the editor). */
export interface GeneratorOverride {
  number: string;
  xMm: number;
  yMm: number;
}

export interface PanelGenerator {
  version: 1;
  groups: GeneratorGroup[];
  overrides?: GeneratorOverride[];
}

export interface TemplatePortDraft {
  number: string;
  sortIndex: number;
  portType: PortType;
  ifName: string | null;
  xMm: number;
  yMm: number;
  wMm: number;
  hMm: number;
  rotation: number;
}

/** Reason a generator cannot produce ports. `value` is the offending number / name / group index. */
export type GeneratorIssue =
  | { kind: 'DUPLICATE_NUMBER'; value: string }
  | { kind: 'DUPLICATE_IFNAME'; value: string }
  | { kind: 'NAMES_COUNT_MISMATCH'; value: string }
  | { kind: 'UNKNOWN_OVERRIDE'; value: string };

export class GeneratorError extends Error {
  constructor(readonly issues: GeneratorIssue[]) {
    super(issues.map((i) => `${i.kind === 'DUPLICATE_NUMBER' ? 'duplicate port number' : i.kind.toLowerCase().replace(/_/g, ' ')} ${i.value}`).join('; '));
    this.name = 'GeneratorError';
  }
}

const DEFAULT_PANEL_HEIGHT_MM = 44.45;
const DEFAULT_GAP_MM = 8;
const CAGE_GAP_MM = 2;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Port number and {n} index of the i-th port of a group. */
function numbering(g: GeneratorGroup, i: number): { number: string; index: number } {
  const index = (g.startIndex ?? 1) + i * (g.indexStep ?? 1);
  return { number: g.names ? g.names[i] : `${g.numberPrefix ?? ''}${index}`, index };
}

/**
 * Expand a generator into port drafts, in sortIndex order (1-based, group by group).
 * Throws GeneratorError on duplicate numbers or interface names.
 */
export function generatePorts(gen: PanelGenerator, opts: { panelHeightMm?: number } = {}): TemplatePortDraft[] {
  const panelH = opts.panelHeightMm ?? DEFAULT_PANEL_HEIGHT_MM;
  const issues: GeneratorIssue[] = [];
  const out: TemplatePortDraft[] = [];
  const numbers = new Set<string>();
  const ifNames = new Set<string>();
  let prevRight: number | null = null;

  gen.groups.forEach((g, gi) => {
    if (g.names && g.names.length !== g.count) {
      issues.push({ kind: 'NAMES_COUNT_MISMATCH', value: String(gi + 1) });
      return;
    }
    const size = PORT_SIZE_MM[g.portType];
    const w = g.wMm ?? size.w;
    const h = g.hMm ?? size.h;
    const rows = Math.max(1, Math.min(g.rows ?? 1, g.count));
    const perRow = Math.ceil(g.count / rows);
    const pitchX = g.pitchXMm ?? w + CAGE_GAP_MM;
    const pitchY = g.pitchYMm ?? h + CAGE_GAP_MM;
    const gap = g.gapMm ?? DEFAULT_GAP_MM;
    const x0 = g.xMm ?? (prevRight === null ? gap : prevRight + gap);
    const blockH = (rows - 1) * pitchY + h;
    const y0 = g.yMm ?? Math.max(0, (panelH - blockH) / 2);
    const columnMajor = (g.order ?? 'ROW_MAJOR') === 'COLUMN_MAJOR';
    let right = x0;
    for (let i = 0; i < g.count; i++) {
      const { number, index } = numbering(g, i);
      const col = columnMajor ? Math.floor(i / rows) : i % perRow;
      const row = columnMajor ? i % rows : Math.floor(i / perRow);
      if (numbers.has(number)) issues.push({ kind: 'DUPLICATE_NUMBER', value: number });
      numbers.add(number);
      const ifName = g.ifNamePattern ? g.ifNamePattern.replace(/\{n\}/g, String(index)) : null;
      if (ifName !== null) {
        if (ifNames.has(ifName)) issues.push({ kind: 'DUPLICATE_IFNAME', value: ifName });
        ifNames.add(ifName);
      }
      const x = round2(x0 + col * pitchX);
      right = Math.max(right, x + w);
      out.push({
        number,
        sortIndex: out.length + 1,
        portType: g.portType,
        ifName,
        xMm: x,
        yMm: round2(y0 + row * pitchY),
        wMm: w,
        hMm: h,
        rotation: g.rotation ?? 0,
      });
    }
    prevRight = right;
  });

  for (const o of gen.overrides ?? []) {
    const p = out.find((d) => d.number === o.number);
    if (!p) issues.push({ kind: 'UNKNOWN_OVERRIDE', value: o.number });
    else {
      p.xMm = round2(o.xMm);
      p.yMm = round2(o.yMm);
    }
  }
  if (issues.length) throw new GeneratorError(issues);
  return out;
}

/** Issues of a generator, [] when it is valid. */
export function generatorIssues(gen: PanelGenerator, opts: { panelHeightMm?: number } = {}): GeneratorIssue[] {
  try {
    generatePorts(gen, opts);
    return [];
  } catch (e) {
    if (e instanceof GeneratorError) return e.issues;
    throw e;
  }
}

/** Overrides that still point at a generated port (used after the groups changed). */
export function pruneOverrides(gen: PanelGenerator): PanelGenerator {
  if (!gen.overrides?.length) return gen;
  const { overrides: _o, ...base } = gen;
  let names: Set<string>;
  try {
    names = new Set(generatePorts(base).map((p) => p.number));
  } catch {
    return gen;
  }
  const kept = gen.overrides.filter((o) => names.has(o.number));
  return kept.length ? { ...base, overrides: kept } : base;
}

// ---------- starting points for the editor (names are i18n keys: panel:generator.presets.<key>) ----------

export const GENERATOR_PRESETS = {
  /** 48 x RJ45 + 4 x SFP+, two rows, odd top / even bottom (S5735-L48T4X class) */
  switch48ge4xge: {
    widthMm: 482.6,
    heightMm: 44.45,
    generator: {
      version: 1,
      groups: [
        { portType: 'RJ45', count: 48, numberPrefix: 'ge', ifNamePattern: 'GigabitEthernet0/0/{n}', rows: 2, order: 'COLUMN_MAJOR', xMm: 20, pitchXMm: 15.5, pitchYMm: 16 },
        { portType: 'SFP_PLUS', count: 4, numberPrefix: 'xge', ifNamePattern: 'XGigabitEthernet0/0/{n}', rows: 2, order: 'COLUMN_MAJOR', gapMm: 12, pitchXMm: 15, pitchYMm: 14 },
      ],
    },
  },
  /** 24 x RJ45 + 4 x SFP+, two rows, odd top / even bottom (S5735S-L24T4X class) */
  switch24ge4xge: {
    widthMm: 482.6,
    heightMm: 44.45,
    generator: {
      version: 1,
      groups: [
        { portType: 'RJ45', count: 24, numberPrefix: 'ge', ifNamePattern: 'GigabitEthernet0/0/{n}', rows: 2, order: 'COLUMN_MAJOR', xMm: 40, pitchXMm: 17, pitchYMm: 16 },
        { portType: 'SFP_PLUS', count: 4, numberPrefix: 'xge', ifNamePattern: 'XGigabitEthernet0/0/{n}', rows: 2, order: 'COLUMN_MAJOR', gapMm: 20, pitchXMm: 16, pitchYMm: 14 },
      ],
    },
  },
  /** 24-port patch panel, one row, 1..24 */
  patchPanel24: {
    widthMm: 482.6,
    heightMm: 44.45,
    generator: {
      version: 1,
      groups: [{ portType: 'RJ45', count: 24, rows: 1, xMm: 30, pitchXMm: 17.5 }],
    },
  },
  /** server rear: 2 PSU + 4 NIC + BMC + 2 USB + VGA */
  serverRear: {
    widthMm: 482.6,
    heightMm: 88.9,
    generator: {
      version: 1,
      groups: [
        { portType: 'POWER', count: 2, numberPrefix: 'PSU', rows: 1, xMm: 15, pitchXMm: 70 },
        { portType: 'RJ45', count: 4, numberPrefix: 'NIC', rows: 1, gapMm: 40, pitchXMm: 18 },
        { portType: 'RJ45', count: 1, names: ['BMC'], gapMm: 15 },
        { portType: 'USB', count: 2, numberPrefix: 'USB', rows: 2, order: 'COLUMN_MAJOR', gapMm: 15, pitchYMm: 10 },
        { portType: 'OTHER', count: 1, names: ['VGA'], gapMm: 15, wMm: 31, hMm: 12 },
      ],
    },
  },
} satisfies Record<string, { widthMm: number; heightMm: number; generator: PanelGenerator }>;
export type GeneratorPresetKey = keyof typeof GENERATOR_PRESETS;
