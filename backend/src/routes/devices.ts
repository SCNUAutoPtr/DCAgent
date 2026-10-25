import { idBody } from '../contracts/common';
import * as c from '../contracts/devices';
import { rpcRouter } from '../http/rpc';
import { deviceModelService, deviceService } from '../services/deviceService';

export function devicesRouter() {
  const r = rpcRouter();
  r.read('list', c.deviceListSchema, (db, b) => deviceService.list(db, b));
  r.read('get', idBody, (db, b) => deviceService.get(db, b.id));
  r.write('create', c.deviceCreateSchema, (tx, b) => deviceService.create(tx, b));
  r.write('bulk-create', c.deviceBulkCreateSchema, (tx, b) => deviceService.bulkCreate(tx, b.devices));
  r.write('update', c.deviceUpdateSchema, (tx, b) => deviceService.update(tx, b));
  r.write('move', c.deviceMoveSchema, (tx, b) => deviceService.move(tx, b));
  r.write('delete', c.deviceDeleteSchema, (tx, b) => deviceService.delete(tx, b.id, b.force));
  return r.router;
}

export function deviceModelsRouter() {
  const r = rpcRouter();
  r.read('list', c.deviceModelListSchema, (db, b) => deviceModelService.list(db, b));
  r.read('get', idBody, (db, b) => deviceModelService.get(db, b.id));
  r.write('create', c.deviceModelCreateSchema, (tx, b) => deviceModelService.create(tx, b));
  r.write('update', c.deviceModelUpdateSchema, (tx, b) => deviceModelService.update(tx, b));
  r.write('delete', idBody, (tx, b) => deviceModelService.delete(tx, b.id));
  return r.router;
}
