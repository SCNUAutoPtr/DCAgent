import type { LabelKind } from '@contracts/enums';
import { parseShortId } from '@contracts/shortId';
import { labelService } from '@/services/labelService';

/** '' / null -> undefined; anything else must parse ("E-00012" or "12"). */
export function parseLabelInput(value: unknown): number | undefined {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text ? parseShortId(text) : undefined;
}

/** Edit flow: bind the newly entered number to the entity; the old label stays unbound for manual reuse. */
export async function rebindIfChanged(target: { kind: LabelKind; id: string }, current: number | undefined, next: number | undefined) {
  if (next === undefined || next === current) return;
  await labelService.rebind({ shortId: next, target, oldPolicy: 'KEEP' });
}
