import { emptyBody, idBody } from '../contracts/common';
import * as c from '../contracts/ip';
import { rpcRouter } from '../http/rpc';
import { ipAddressService, subnetService } from '../services/ipService';

export function subnetsRouter() {
  const r = rpcRouter();
  r.read('list', c.subnetListSchema, (db, b) => subnetService.list(db, b));
  r.read('get', idBody, (db, b) => subnetService.get(db, b.id));
  r.read('calculate', c.subnetCalculateSchema, (_db, b) => subnetService.calculate(b.network));
  r.read('statistics', emptyBody, (db) => subnetService.statistics(db));
  r.write('create', c.subnetCreateSchema, (tx, b) => subnetService.create(tx, b));
  r.write('update', c.subnetUpdateSchema, (tx, b) => subnetService.update(tx, b));
  r.write('delete', c.subnetDeleteSchema, (tx, b) => subnetService.delete(tx, b.id, b.force));
  return r.router;
}

export function ipAddressesRouter() {
  const r = rpcRouter();
  r.read('list', c.ipListSchema, (db, b) => ipAddressService.list(db, b));
  r.read('get', idBody, (db, b) => ipAddressService.get(db, b.id));
  r.read('get-by-address', c.ipGetByAddressSchema, (db, b) => ipAddressService.getByAddress(db, b.address, b.subnetId));
  r.read('next-available', c.ipNextAvailableSchema, async (db, b) => ({ addresses: await ipAddressService.nextAvailable(db, b.subnetId, b.count) }));
  r.read('check-conflicts', c.ipCheckConflictsSchema, (db, b) => ipAddressService.checkConflicts(db, b.subnetId));
  r.write('allocate', c.ipAllocateSchema, (tx, b) => ipAddressService.allocate(tx, b));
  r.write('batch-allocate', c.ipBatchAllocateSchema, (tx, b) => ipAddressService.batchAllocate(tx, b));
  r.write('update', c.ipUpdateSchema, (tx, b) => ipAddressService.update(tx, b));
  r.write('release', idBody, (tx, b) => ipAddressService.release(tx, b.id));
  r.write('delete', idBody, (tx, b) => ipAddressService.release(tx, b.id));
  return r.router;
}
