import { idBody } from '../contracts/common';
import * as c from '../contracts/workstations';
import { rpcRouter } from '../http/rpc';
import { workstationService } from '../services/workstationService';

export function workstationsRouter() {
  const r = rpcRouter();
  r.read('list', c.workstationListSchema, (db, b) => workstationService.list(db, b));
  r.read('get', idBody, (db, b) => workstationService.get(db, b.id));
  r.read('by-code', c.workstationByCodeSchema, (db, b) => workstationService.byCode(db, b.code));
  r.write('create', c.workstationCreateSchema, (tx, b) => workstationService.create(tx, b));
  r.write('update', c.workstationUpdateSchema, (tx, b) => workstationService.update(tx, b));
  r.write('set-admin-state', c.workstationSetAdminStateSchema, (tx, b) => workstationService.setAdminState(tx, b.id, b.adminState));
  r.write('delete', idBody, (tx, b) => workstationService.delete(tx, b.id));
  return r.router;
}
