import { idBody } from '../contracts/common';
import * as c from '../contracts/hierarchy';
import { rpcRouter } from '../http/rpc';
import { cabinetService, dataCenterService, roomService } from '../services/hierarchyService';

export function dataCentersRouter() {
  const r = rpcRouter();
  r.read('list', c.dataCenterListSchema, (db, b) => dataCenterService.list(db, b));
  r.read('get', idBody, (db, b) => dataCenterService.get(db, b.id));
  r.write('create', c.dataCenterCreateSchema, (tx, b) => dataCenterService.create(tx, b));
  r.write('update', c.dataCenterUpdateSchema, (tx, b) => dataCenterService.update(tx, b));
  r.write('delete', idBody, (tx, b) => dataCenterService.delete(tx, b.id));
  return r.router;
}

export function roomsRouter() {
  const r = rpcRouter();
  r.read('list', c.roomListSchema, (db, b) => roomService.list(db, b));
  r.read('get', idBody, (db, b) => roomService.get(db, b.id));
  r.read('scene', c.roomSceneSchema, (db, b) => roomService.scene(db, b.roomId));
  r.write('create', c.roomCreateSchema, (tx, b) => roomService.create(tx, b));
  r.write('update', c.roomUpdateSchema, (tx, b) => roomService.update(tx, b));
  r.write('delete', idBody, (tx, b) => roomService.delete(tx, b.id));
  return r.router;
}

export function cabinetsRouter() {
  const r = rpcRouter();
  r.read('list', c.cabinetListSchema, (db, b) => cabinetService.list(db, b));
  r.read('get', idBody, (db, b) => cabinetService.get(db, b.id));
  r.write('create', c.cabinetCreateSchema, (tx, b) => cabinetService.create(tx, b));
  r.write('update', c.cabinetUpdateSchema, (tx, b) => cabinetService.update(tx, b));
  r.write('delete', idBody, (tx, b) => cabinetService.delete(tx, b.id));
  return r.router;
}
