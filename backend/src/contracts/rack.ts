// Rack helpers shared by backend and frontend. No dependencies: the frontend imports values from here.

/** Height used for drawing and range checks: a device of unknown height (null) counts as 1U, the U it sits in. */
export const effectiveUHeight = (uHeight: number | null | undefined): number => uHeight ?? 1;

/** Top U of a racked device. */
export const topU = (uPosition: number, uHeight: number | null | undefined): number => uPosition + effectiveUHeight(uHeight) - 1;
