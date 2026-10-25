import { z } from 'zod';
import { UNMATCHED_SOURCES } from './enums';
import type { UnmatchedSource } from './enums';
import { idSchema, paging } from './common';

export const flowsIngestSchema = z.object({
  lines: z.array(z.string()).max(50_000),
  defaultSamplingRates: z.record(z.number().positive()).optional(),
});
export const flowsTopSchema = z.object({
  windowSeconds: z.number().int().min(1).max(86_400).default(300),
  limit: z.number().int().min(1).max(500).default(20),
  sampler: z.string().optional(),
  /** replay: "now" as epoch milliseconds */
  now: z.number().int().optional(),
});

export const switchSnapshotSchema = z
  .object({
    sysname: z.string().trim().min(1).max(100),
    interfaceBrief: z.string().optional(),
    transceiver: z.string().optional(),
    save: z.boolean().default(true),
  })
  .refine((v) => v.interfaceBrief || v.transceiver, { message: 'interfaceBrief or transceiver is required', path: ['interfaceBrief'] });

export const switchHistorySchema = z.object({
  deviceId: idSchema,
  ifName: z.string().trim().min(1).max(100),
  limit: z.number().int().min(1).max(1000).default(100),
});

export const syncPowerSchema = z.object({
  rows: z.array(z.object({ name: z.string().min(1), ip: z.string().default(''), mac: z.string().default(''), online: z.boolean() })).max(10_000),
  dryRun: z.boolean().default(false),
});

export const syncPortsSchema = z.object({
  /** { seat name: [switch sysname, interface name, source?] } */
  ports: z.record(z.array(z.string()).min(2)),
  dryRun: z.boolean().default(false),
});

export const seatMapSchema = z.object({
  roomId: idSchema,
  windowSeconds: z.number().int().min(1).max(3600).default(10),
  now: z.number().int().optional(),
});

export const unmatchedListSchema = z.object({ source: z.enum(UNMATCHED_SOURCES).optional(), ...paging });
export const unmatchedResolveSchema = z.object({ id: idSchema, deviceId: idSchema.optional(), portId: idSchema.optional() });

export interface UnmatchedDto {
  id: string;
  source: UnmatchedSource;
  sysname: string;
  ifName: string | null;
  workstationId: string | null;
  workstationName: string | null;
  payload: unknown;
  createdAt: string;
}

export interface SwitchSummary {
  deviceId: string;
  deviceName: string;
  sysname: string | null;
  lastCollectedAt: string | null;
  observations: number;
}

// ---------- results (wire shapes) ----------

export type { InterfaceBriefRow, TransceiverDiagnosis, TransceiverItem, PortFinding } from '../services/observability/huaweiParser';
export type { TopFlow } from '../services/observability/flows';
import type { InterfaceBriefRow, PortFinding, TransceiverDiagnosis } from '../services/observability/huaweiParser';
import type { TopFlow } from '../services/observability/flows';
import type { WorkstationDto } from './workstations';

export interface FlowEndpoint {
  name: string;
  kind: 'workstation' | 'device' | 'ip';
  location?: string;
}

export interface TopFlowRow extends TopFlow {
  srcEndpoint: FlowEndpoint | null;
  dstEndpoint: FlowEndpoint | null;
}

export interface FlowStatus {
  buffered: number;
  samplers: string[];
  defaultRates: Record<string, number>;
}

export interface FlowIngestResult {
  accepted: number;
  skipped: number;
  buffered: number;
}

/** Error counters grew since the previous stored snapshot of the same port. */
export interface GrowthFindingDto {
  interface: string;
  shortName: string;
  kind: 'ERRORS_GROWING';
  severity: 'critical';
  value: number;
  since: string | Date;
  message: string;
}

export interface SwitchSnapshotResult {
  sysname: string;
  deviceId: string | null;
  interfaces: InterfaceBriefRow[];
  transceivers: TransceiverDiagnosis[];
  findings: (PortFinding | GrowthFindingDto)[];
  saved: number;
  /** rows parked in ObservationUnmatched because no device has this sysname */
  unmatched: number;
}

export interface PortObservationDto {
  id: string;
  deviceId: string;
  portId: string | null;
  ifName: string;
  phy: string | null;
  inUtilPercent: number | null;
  outUtilPercent: number | null;
  inErrors: number | null;
  outErrors: number | null;
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  rxLowAlarmDbm: number | null;
  rxLowWarnDbm: number | null;
  collectedAt: string | Date;
}

export interface SyncPowerResult {
  dryRun: boolean;
  updated: number;
  online: number;
  unmatched: string[];
}

export interface SyncPortsResult {
  dryRun: boolean;
  attached: number;
  unresolved: number;
  unmatchedSeats: string[];
}

export interface SeatDto extends WorkstationDto {
  traffic: { inBps: number; outBps: number };
}
