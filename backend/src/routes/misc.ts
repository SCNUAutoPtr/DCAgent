import { emptyBody } from '../contracts/common';
import { globalSearchSchema } from '../contracts/search';
import { rpcRouter } from '../http/rpc';
import { dashboardService } from '../services/dashboardService';
import { searchService } from '../services/searchService';

export function searchRouter() {
  const r = rpcRouter();
  r.read('global', globalSearchSchema, (db, b) => searchService.global(db, b));
  return r.router;
}

export function dashboardRouter() {
  const r = rpcRouter();
  r.read('overview', emptyBody, (db) => dashboardService.overview(db));
  return r.router;
}
