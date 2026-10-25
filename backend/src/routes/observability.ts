import { emptyBody } from '../contracts/common';
import * as c from '../contracts/observability';
import { rpcRouter } from '../http/rpc';
import { observabilityService as s } from '../services/observabilityService';

export function observabilityRouter() {
  const r = rpcRouter();
  r.read('flows/ingest', c.flowsIngestSchema, (_db, b) => s.ingestFlows(b.lines, b.defaultSamplingRates));
  r.read('flows/top', c.flowsTopSchema, (db, b) => s.topFlows(db, b));
  r.read('flows/status', emptyBody, () => s.flowStatus());
  r.write('switches/snapshot', c.switchSnapshotSchema, (tx, b) => s.recordSwitchSnapshot(tx, b));
  r.read('switches/list', emptyBody, (db) => s.listSwitches(db));
  r.read('switches/history', c.switchHistorySchema, (db, b) => s.portHistory(db, b));
  r.write('workstations/sync-power', c.syncPowerSchema, (tx, b) => s.syncPower(tx, b));
  r.write('workstations/sync-ports', c.syncPortsSchema, (tx, b) => s.syncPorts(tx, b.ports, b.dryRun));
  r.read('workstations/seat-map', c.seatMapSchema, (db, b) => s.seatMap(db, b));
  r.read('unmatched/list', c.unmatchedListSchema, (db, b) => s.listUnmatched(db, b));
  r.write('unmatched/resolve', c.unmatchedResolveSchema, (tx, b) => s.resolveUnmatched(tx, b));
  return r.router;
}
