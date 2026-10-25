import { idBody } from '../contracts/common';
import * as c from '../contracts/cables';
import { rpcRouter } from '../http/rpc';
import { cableService } from '../services/cableService';

export function cablesRouter() {
  const r = rpcRouter();
  r.read('list', c.cableListSchema, (db, b) => cableService.list(db, b));
  r.read('get', idBody, (db, b) => cableService.get(db, b.id));
  r.read('panel-connections', c.panelConnectionsSchema, (db, b) => cableService.panelConnections(db, b.panelId));
  r.read('dangling-by-device', c.danglingByDeviceSchema, (db, b) => cableService.danglingByDevice(db, b.deviceId));
  r.write('create', c.cableCreateSchema, (tx, b) => cableService.create(tx, b));
  r.write('update', c.cableUpdateSchema, (tx, b) => cableService.update(tx, b));
  r.write('connect-end', c.cableConnectEndSchema, (tx, b) => cableService.connectEnd(tx, b));
  r.write('disconnect-end', c.cableDisconnectEndSchema, (tx, b) => cableService.disconnectEnd(tx, b));
  r.write('delete', c.cableDeleteSchema, (tx, b) => cableService.delete(tx, b.id, b.voidLabels));
  return r.router;
}
