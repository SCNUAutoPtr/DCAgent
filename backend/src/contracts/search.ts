import { z } from 'zod';
import type { LabelRef, PathNode } from './common';

export const SEARCH_KINDS = ['ROOM', 'CABINET', 'DEVICE', 'PANEL', 'PORT', 'CABLE', 'CABLE_ENDPOINT', 'WORKSTATION', 'IP_ADDRESS'] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

export const globalSearchSchema = z.object({
  q: z.string().trim().min(1).max(200),
  kinds: z.array(z.enum(SEARCH_KINDS)).optional(),
  take: z.number().int().min(1).max(20).default(10),
});

export interface SearchHit {
  kind: SearchKind;
  id: string;
  name: string;
  description: string | null;
  label: LabelRef | null;
  path: PathNode[];
}
