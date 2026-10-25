import type { OkResult, Paged } from '@contracts/common';
import type {
  FlowStatus,
  PortObservationDto,
  SeatDto,
  SwitchSnapshotResult,
  SwitchSummary,
  SyncPortsResult,
  SyncPowerResult,
  TopFlowRow,
  UnmatchedDto,
  flowsTopSchema,
  seatMapSchema,
  switchHistorySchema,
  switchSnapshotSchema,
  syncPortsSchema,
  syncPowerSchema,
  unmatchedListSchema,
  unmatchedResolveSchema,
} from '@contracts/observability';
import { rpc, type In } from './api';

type Empty = Record<string, never>;

export const observabilityService = {
  topFlows: (body: In<typeof flowsTopSchema>) => rpc<typeof body, TopFlowRow[]>('observability/flows/top', body),
  flowStatus: () => rpc<Empty, FlowStatus>('observability/flows/status', {}),
  snapshot: (body: In<typeof switchSnapshotSchema>) => rpc<typeof body, SwitchSnapshotResult>('observability/switches/snapshot', body),
  listSwitches: () => rpc<Empty, SwitchSummary[]>('observability/switches/list', {}),
  portHistory: (body: In<typeof switchHistorySchema>) => rpc<typeof body, PortObservationDto[]>('observability/switches/history', body),
  syncPower: (body: In<typeof syncPowerSchema>) => rpc<typeof body, SyncPowerResult>('observability/workstations/sync-power', body),
  syncPorts: (body: In<typeof syncPortsSchema>) => rpc<typeof body, SyncPortsResult>('observability/workstations/sync-ports', body),
  seatMap: (body: In<typeof seatMapSchema>) => rpc<typeof body, SeatDto[]>('observability/workstations/seat-map', body),
  unmatched: {
    list: (body: In<typeof unmatchedListSchema> = {}) => rpc<typeof body, Paged<UnmatchedDto>>('observability/unmatched/list', body),
    resolve: (body: In<typeof unmatchedResolveSchema>) => rpc<typeof body, OkResult>('observability/unmatched/resolve', body),
  },
};
