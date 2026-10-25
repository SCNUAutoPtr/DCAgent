import { z } from 'zod';
import { WORKSTATION_ADMIN_STATES } from './enums';
import type { WorkstationAdminState } from './enums';
import { idSchema, optText, paging, searchText } from './common';
import { ipv4Schema } from './ip';

const fp = {
  fpX: z.number().min(-10_000).max(10_000).nullish(),
  fpY: z.number().min(-10_000).max(10_000).nullish(),
  fpW: z.number().positive().max(100).nullish(),
  fpD: z.number().positive().max(100).nullish(),
};
const fpPairs = (v: { fpX?: number | null; fpY?: number | null; fpW?: number | null; fpD?: number | null }) =>
  (v.fpX == null) === (v.fpY == null) && (v.fpW == null) === (v.fpD == null);

const ipInput = z.object({
  address: ipv4Schema,
  /** omitted: the subnet containing the address */
  subnetId: idSchema.optional(),
  macAddress: z
    .string()
    .trim()
    .regex(/^[0-9A-Fa-f]{2}([:-]?[0-9A-Fa-f]{2}){5}$/, 'invalid MAC address')
    .nullish(),
});

const hardware = {
  cpu: optText(200),
  memory: optText(100),
  storage: optText(200),
  gpu: optText(200),
  os: optText(100),
};

export const workstationListSchema = z.object({ roomId: idSchema.optional(), search: searchText, ...paging });
export const workstationByCodeSchema = z.object({ code: z.string().trim().min(1).max(100) });
export const workstationCreateSchema = z
  .object({
    roomId: idSchema,
    name: z.string().trim().min(1).max(200),
    code: optText(100),
    ...hardware,
    adminState: z.enum(WORKSTATION_ADMIN_STATES).default('ACTIVE'),
    assignedTo: optText(200),
    ...fp,
    notes: optText(),
    ip: ipInput.nullish(),
  })
  .refine(fpPairs, { message: 'fpX/fpY and fpW/fpD go together' });
export const workstationUpdateSchema = z
  .object({
    id: idSchema,
    roomId: idSchema.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    code: optText(100).optional(),
    cpu: optText(200).optional(),
    memory: optText(100).optional(),
    storage: optText(200).optional(),
    gpu: optText(200).optional(),
    os: optText(100).optional(),
    assignedTo: optText(200).optional(),
    ...fp,
    notes: optText().optional(),
    /** null: release the workstation's address */
    ip: ipInput.nullish(),
    attachedPortId: idSchema.nullish(),
  })
  .refine(fpPairs, { message: 'fpX/fpY and fpW/fpD go together' });
export const workstationSetAdminStateSchema = z.object({ id: idSchema, adminState: z.enum(WORKSTATION_ADMIN_STATES) });

export interface WorkstationDto {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  roomName: string;
  cpu: string | null;
  memory: string | null;
  storage: string | null;
  gpu: string | null;
  os: string | null;
  adminState: WorkstationAdminState;
  assignedTo: string | null;
  fpX: number | null;
  fpY: number | null;
  fpW: number | null;
  fpD: number | null;
  notes: string | null;
  /** derived: last probe saw it powered on */
  online: boolean;
  /** derived: no probe within ONLINE_STALE_MINUTES */
  stale: boolean;
  lastSeenAt: string | null;
  lastCheckedAt: string | null;
  ip: { id: string; address: string; macAddress: string | null; subnetId: string } | null;
  attachedPort: { id: string; number: string; ifName: string | null; deviceId: string; deviceName: string; sysname: string | null } | null;
  createdAt: string;
  updatedAt: string;
}

/** online = seen at the last probe. Pure, used by backend and frontend. */
export function isOnline(lastSeenAt: Date | string | null, lastCheckedAt: Date | string | null): boolean {
  if (!lastSeenAt) return false;
  if (!lastCheckedAt) return true;
  return new Date(lastSeenAt).getTime() >= new Date(lastCheckedAt).getTime();
}
