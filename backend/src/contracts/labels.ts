import { z } from 'zod';
import { LABEL_KINDS, LABEL_STATES, PRINT_TASK_STATUSES } from './enums';
import type { LabelKind, LabelState, PrintTaskStatus } from './enums';
import { idSchema, optText, paging, shortIdSchema } from './common';
import type { PathNode } from './common';

import { MAX_RANGE, parseRangeExpr } from './shortId';
export { MAX_RANGE, formatShortId, parseRangeExpr, parseShortId } from './shortId';

const rangeExprSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .superRefine((v, ctx) => {
    try {
      parseRangeExpr(v);
    } catch (e) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: (e as Error).message });
    }
  });

// ---------- requests ----------

export const labelTargetSchema = z.object({ kind: z.enum(LABEL_KINDS), id: idSchema });
export type LabelTarget = z.infer<typeof labelTargetSchema>;

export const labelListSchema = z.object({
  state: z.enum(LABEL_STATES).optional(),
  bound: z.boolean().optional(),
  kind: z.enum(LABEL_KINDS).optional(),
  range: rangeExprSchema.optional(),
  ...paging,
});

export const labelGenerateSchema = z
  .object({
    count: z.number().int().min(1).max(MAX_RANGE).optional(),
    rangeExpr: rangeExprSchema.optional(),
    batchNo: optText(100),
  })
  .refine((v) => (v.count === undefined) !== (v.rangeExpr === undefined), { message: 'give exactly one of count or rangeExpr' });

export const labelResolveSchema = z.object({ shortId: shortIdSchema });

export const labelVoidSchema = z
  .object({
    shortIds: z.array(shortIdSchema).min(1).max(MAX_RANGE).optional(),
    rangeExpr: rangeExprSchema.optional(),
    reason: optText(500),
  })
  .refine((v) => (v.shortIds === undefined) !== (v.rangeExpr === undefined), { message: 'give exactly one of shortIds or rangeExpr' });

export const labelRebindSchema = z.object({
  shortId: shortIdSchema,
  target: labelTargetSchema,
  oldPolicy: z.enum(['VOID', 'KEEP']),
});

export const labelMissingSchema = z.object({ kind: z.enum(LABEL_KINDS).optional() });

export const printTaskListSchema = z.object({ status: z.enum(PRINT_TASK_STATUSES).optional(), ...paging });

export const printTaskCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    count: z.number().int().min(1).max(MAX_RANGE).optional(),
    shortIds: z.array(shortIdSchema).min(1).max(MAX_RANGE).optional(),
    rangeExpr: rangeExprSchema.optional(),
    notes: optText(),
    createdBy: optText(100),
  })
  .refine((v) => [v.count, v.shortIds, v.rangeExpr].filter((x) => x !== undefined).length === 1, {
    message: 'give exactly one of count, shortIds or rangeExpr',
  });

export const printTaskIdSchema = z.object({ id: idSchema });
export const printTaskCompleteSchema = z.object({ id: idSchema, status: z.enum(['COMPLETED', 'FAILED']).default('COMPLETED') });

// ---------- responses ----------

export interface LabelBinding {
  kind: LabelKind;
  id: string;
  name: string;
}

export interface LabelDto {
  shortId: number;
  display: string;
  state: LabelState;
  batchNo: string | null;
  notes: string | null;
  printTaskId: string | null;
  printedAt: string | null;
  firstBoundAt: string | null;
  boundAt: string | null;
  bound: LabelBinding | null;
  createdAt: string;
}

export interface LabelStats {
  total: number;
  byState: Record<LabelState, number>;
  bound: number;
  unbound: number;
  /** GENERATED, unbound and never bound: what autoAllocate hands out first. */
  allocatable: number;
  /** GENERATED and bound: stuck on an entity but not printed yet. */
  toPrint: number;
  byKind: Record<LabelKind, number>;
}

export interface LabelResolveResult {
  shortId: number;
  display: string;
  /** null when the number does not exist in the system */
  state: LabelState | null;
  bound: { kind: LabelKind; id: string; path: PathNode[] } | null;
}

export interface LabelGenerateResult {
  created: number[];
  existing: number[];
}

export interface LabelVoidResult {
  voided: number[];
  failed: { shortId: number; reason: 'NOT_FOUND' | 'BOUND' | 'ALREADY_VOID' }[];
}

export interface MissingLabelItem {
  kind: LabelKind;
  id: string;
  name: string;
  path: PathNode[];
}

export interface PrintTaskDto {
  id: string;
  name: string;
  status: PrintTaskStatus;
  notes: string | null;
  createdBy: string | null;
  count: number;
  createdAt: string;
  completedAt: string | null;
}
