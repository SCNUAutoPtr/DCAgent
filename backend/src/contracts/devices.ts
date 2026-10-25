import { z } from 'zod';
import { DEVICE_TYPES } from './enums';
import type { DeviceType, IpStatus } from './enums';
import { idSchema, optText, searchText } from './common';
import type { PathNode } from './common';

const name = z.string().trim().min(1).max(200);
/** null = height not known (legacy rows, unconfirmed models) */
const uHeight = z.number().int().min(1).max(60);
const uPosition = z.number().int().min(1).max(60);

// ---------- device models ----------

export const deviceModelListSchema = z.object({ search: searchText, deviceType: z.enum(DEVICE_TYPES).optional() });
export const deviceModelCreateSchema = z.object({
  vendor: z.string().trim().max(100).default(''),
  name,
  deviceType: z.enum(DEVICE_TYPES),
  uHeight: uHeight.nullish(),
  depthMm: z.number().int().positive().max(3000).nullish(),
  notes: optText(),
});
export const deviceModelUpdateSchema = z.object({
  id: idSchema,
  vendor: z.string().trim().max(100).optional(),
  name: name.optional(),
  deviceType: z.enum(DEVICE_TYPES).optional(),
  uHeight: uHeight.nullish(),
  depthMm: z.number().int().positive().max(3000).nullish(),
  notes: optText().optional(),
});

export interface DeviceModelDto {
  id: string;
  vendor: string;
  name: string;
  deviceType: DeviceType;
  uHeight: number | null;
  depthMm: number | null;
  notes: string | null;
  deviceCount: number;
  templateCount: number;
}

// ---------- devices ----------

const placement = {
  cabinetId: idSchema.nullish(),
  roomId: idSchema.nullish(),
  uPosition: uPosition.nullish(),
};

const onePlace = (v: { cabinetId?: string | null; roomId?: string | null }) => (v.cabinetId ? 1 : 0) + (v.roomId ? 1 : 0) === 1;

export const deviceCreateSchema = z
  .object({
    name,
    type: z.enum(DEVICE_TYPES),
    deviceModelId: idSchema.nullish(),
    serialNo: optText(100),
    sysname: optText(100),
    ...placement,
    /** omitted: taken from the device model, else unknown (null) */
    uHeight: uHeight.nullish(),
    notes: optText(),
  })
  .refine(onePlace, { message: 'give exactly one of cabinetId or roomId' });

export const deviceBulkCreateSchema = z.object({ devices: z.array(deviceCreateSchema).min(1).max(500) });

export const deviceUpdateSchema = z.object({
  id: idSchema,
  name: name.optional(),
  type: z.enum(DEVICE_TYPES).optional(),
  deviceModelId: idSchema.nullish(),
  serialNo: optText(100).optional(),
  sysname: optText(100).optional(),
  uPosition: uPosition.nullish(),
  /** null: height not known */
  uHeight: uHeight.nullish(),
  notes: optText().optional(),
});

export const deviceMoveSchema = z
  .object({ id: idSchema, ...placement })
  .refine(onePlace, { message: 'give exactly one of cabinetId or roomId' });

export const deviceListSchema = z.object({
  cabinetId: idSchema.optional(),
  roomId: idSchema.optional(),
  type: z.enum(DEVICE_TYPES).optional(),
  search: searchText,
});

/** force: also delete panels/ports and the port observation history, and unbind the management IPs */
export const deviceDeleteSchema = z.object({ id: idSchema, force: z.boolean().default(false) });

export interface DeviceDto {
  id: string;
  name: string;
  type: DeviceType;
  deviceModelId: string | null;
  deviceModel: { id: string; vendor: string; name: string; uHeight: number | null; depthMm: number | null } | null;
  serialNo: string | null;
  sysname: string | null;
  cabinetId: string | null;
  cabinetName: string | null;
  roomId: string | null;
  /** room of the cabinet, or the room the device sits in directly */
  locationRoomId: string | null;
  locationRoomName: string | null;
  uPosition: number | null;
  /** null: height not known; a racked device of unknown height is drawn as 1U */
  uHeight: number | null;
  notes: string | null;
  panelCount: number;
  ipAddresses: { id: string; address: string; status: IpStatus; description: string | null }[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceDetailDto extends DeviceDto {
  path: PathNode[];
  panels: { id: string; name: string; type: string; face: string; portCount: number; connectedCount: number }[];
}
