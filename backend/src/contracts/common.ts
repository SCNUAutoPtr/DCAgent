import { z } from 'zod';
import type { LabelState, PathKind, ErrorCode } from './enums';

export const idSchema = z.string().uuid();
export const shortIdSchema = z.number().int().positive().max(2_147_483_647);
export const idBody = z.object({ id: idSchema });
export type IdBody = z.infer<typeof idBody>;
export const emptyBody = z.object({}).strict();

/** Optional free text: '' is stored as null. */
export const optText = (max = 2000) =>
  z.string().trim().max(max).nullish().transform((v) => (v === '' || v === undefined ? null : v));

export const searchText = z.string().trim().max(200).optional();

export const paging = {
  take: z.number().int().min(1).max(1000).default(200),
  skip: z.number().int().min(0).default(0),
};

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface LabelRef {
  shortId: number;
  state: LabelState;
}

export interface PathNode {
  kind: PathKind;
  id: string;
  name: string;
}

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details: unknown;
}

export interface OkResult {
  ok: true;
}
