import { idBody } from '../contracts/common';
import * as c from '../contracts/panels';
import { rpcRouter } from '../http/rpc';
import { panelService } from '../services/panelService';
import { portService } from '../services/portService';

export function panelsRouter() {
  const r = rpcRouter();
  r.read('list', c.panelListSchema, (db, b) => panelService.list(db, b));
  r.read('get', idBody, (db, b) => panelService.get(db, b.id));
  r.write('create', c.panelCreateSchema, (tx, b) => panelService.create(tx, b));
  r.write('update', c.panelUpdateSchema, (tx, b) => panelService.update(tx, b));
  r.write('delete', c.panelDeleteSchema, (tx, b) => panelService.delete(tx, b.id, b.force));
  return r.router;
}

export function portsRouter() {
  const r = rpcRouter();
  r.read('list', c.portListSchema, (db, b) => portService.list(db, b));
  r.read('get', idBody, (db, b) => portService.get(db, b.id));
  r.write('create', c.portCreateSchema, (tx, b) => portService.create(tx, b));
  r.write('create-bulk', c.portCreateBulkSchema, (tx, b) => portService.createBulk(tx, b));
  r.write('update', c.portUpdateSchema, (tx, b) => portService.update(tx, b));
  r.write('set-admin-state', c.portSetAdminStateSchema, (tx, b) => portService.setAdminState(tx, b.id, b.adminState));
  r.write('delete', c.portDeleteSchema, (tx, b) => portService.delete(tx, b.id, b.force));
  return r.router;
}
