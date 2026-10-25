import { z } from 'zod';
import { idSchema, optText, searchText, shortIdSchema } from './common';
import type { LabelRef, PathNode } from './common';

const name = z.string().trim().min(1).max(200);
const meters = z.number().positive().max(10_000);
const coord = z.number().min(-10_000).max(10_000);
export const rotationSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);

// ---------- data centers ----------

export const dataCenterListSchema = z.object({ search: searchText });
export const dataCenterCreateSchema = z.object({ name, location: optText(500) });
export const dataCenterUpdateSchema = z.object({ id: idSchema, name: name.optional(), location: optText(500).optional() });

export interface DataCenterDto {
  id: string;
  name: string;
  location: string | null;
  roomCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- rooms ----------

export const roomListSchema = z.object({ dataCenterId: idSchema.optional(), search: searchText });
export const roomCreateSchema = z.object({
  dataCenterId: idSchema,
  name,
  floor: optText(50),
  notes: optText(),
  widthM: meters.nullish(),
  depthM: meters.nullish(),
  /** rooms may carry a label but do not have to */
  labelShortId: shortIdSchema.optional(),
});
export const roomUpdateSchema = z.object({
  id: idSchema,
  name: name.optional(),
  floor: optText(50).optional(),
  notes: optText().optional(),
  widthM: meters.nullish(),
  depthM: meters.nullish(),
});
export const roomSceneSchema = z.object({ roomId: idSchema });

export interface RoomDto {
  id: string;
  name: string;
  floor: string | null;
  notes: string | null;
  dataCenterId: string;
  dataCenterName: string;
  widthM: number | null;
  depthM: number | null;
  label: LabelRef | null;
  cabinetCount: number;
  deviceCount: number;
  workstationCount: number;
  /** workstations with a floor-plan position (drawn on the seat map) */
  seatLayoutCount: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- cabinets ----------

const fpFields = {
  fpX: coord.nullish(),
  fpY: coord.nullish(),
  fpW: meters.nullish(),
  fpD: meters.nullish(),
};

const pairs = (v: { fpX?: number | null; fpY?: number | null; fpW?: number | null; fpD?: number | null }) =>
  (v.fpX == null) === (v.fpY == null) && (v.fpW == null) === (v.fpD == null);

export const cabinetListSchema = z.object({ roomId: idSchema.optional(), search: searchText });
export const cabinetCreateSchema = z
  .object({
    roomId: idSchema,
    name,
    positionCode: optText(50),
    heightU: z.number().int().min(1).max(60).default(42),
    notes: optText(),
    ...fpFields,
    fpRotation: rotationSchema.default(0),
    /** omitted: a label is allocated automatically */
    labelShortId: shortIdSchema.optional(),
  })
  .refine(pairs, { message: 'fpX/fpY and fpW/fpD must be given together' });
export const cabinetUpdateSchema = z
  .object({
    id: idSchema,
    roomId: idSchema.optional(),
    name: name.optional(),
    positionCode: optText(50).optional(),
    heightU: z.number().int().min(1).max(60).optional(),
    notes: optText().optional(),
    ...fpFields,
    fpRotation: rotationSchema.optional(),
  })
  .refine(pairs, { message: 'fpX/fpY and fpW/fpD must be given together' });

export interface CabinetDeviceSummary {
  id: string;
  name: string;
  type: string;
  uPosition: number | null;
  /** null: height not known */
  uHeight: number | null;
  sysname: string | null;
}

export interface CabinetDto {
  id: string;
  name: string;
  positionCode: string | null;
  heightU: number;
  notes: string | null;
  roomId: string;
  roomName: string;
  fpX: number | null;
  fpY: number | null;
  fpW: number | null;
  fpD: number | null;
  fpRotation: number;
  label: LabelRef | null;
  deviceCount: number;
  usedU: number;
  createdAt: string;
  updatedAt: string;
}

export interface CabinetDetailDto extends CabinetDto {
  devices: CabinetDeviceSummary[];
  path: PathNode[];
}
