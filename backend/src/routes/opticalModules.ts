import { emptyBody, idBody } from '../contracts/common';
import * as c from '../contracts/opticalModules';
import { rpcRouter } from '../http/rpc';
import { opticalModuleService as s } from '../services/opticalModuleService';

export function opticalModulesRouter() {
  const r = rpcRouter();
  r.read('list', c.moduleListSchema, (db, b) => s.list(db, b));
  r.read('get', idBody, (db, b) => s.get(db, b.id));
  r.read('by-serial', c.moduleBySerialSchema, (db, b) => s.bySerial(db, b.serialNo));
  r.read('statistics', emptyBody, (db) => s.statistics(db));
  r.read('history', idBody, (db, b) => s.history(db, b.id));
  r.write('create', c.moduleCreateSchema, (tx, b) => s.create(tx, b));
  r.write('update', c.moduleUpdateSchema, (tx, b) => s.update(tx, b));
  r.write('install', c.moduleInstallSchema, (tx, b) => s.install(tx, b));
  r.write('uninstall', c.moduleUninstallSchema, (tx, b) => s.uninstall(tx, b));
  r.write('transfer', c.moduleTransferSchema, (tx, b) => s.transfer(tx, b));
  r.write('scrap', c.moduleScrapSchema, (tx, b) => s.scrap(tx, b));
  r.write('delete', idBody, (tx, b) => s.delete(tx, b.id));
  return r.router;
}
