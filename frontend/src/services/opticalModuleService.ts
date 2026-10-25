import type { IdBody, OkResult, Paged } from '@contracts/common';
import type {
  ModuleDto,
  ModuleMovementDto,
  ModuleStatistics,
  moduleCreateSchema,
  moduleInstallSchema,
  moduleListSchema,
  moduleScrapSchema,
  moduleTransferSchema,
  moduleUninstallSchema,
  moduleUpdateSchema,
} from '@contracts/opticalModules';
import { rpc, type In } from './api';

export const opticalModuleService = {
  list: (body: In<typeof moduleListSchema> = {}) => rpc<typeof body, Paged<ModuleDto>>('optical-modules/list', body),
  get: (body: IdBody) => rpc<IdBody, ModuleDto>('optical-modules/get', body),
  bySerial: (body: { serialNo: string }) => rpc<typeof body, ModuleDto>('optical-modules/by-serial', body),
  statistics: () => rpc<Record<string, never>, ModuleStatistics>('optical-modules/statistics', {}),
  history: (body: IdBody) => rpc<IdBody, ModuleMovementDto[]>('optical-modules/history', body),
  create: (body: In<typeof moduleCreateSchema>) => rpc<typeof body, ModuleDto>('optical-modules/create', body),
  update: (body: In<typeof moduleUpdateSchema>) => rpc<typeof body, ModuleDto>('optical-modules/update', body),
  install: (body: In<typeof moduleInstallSchema>) => rpc<typeof body, ModuleDto>('optical-modules/install', body),
  uninstall: (body: In<typeof moduleUninstallSchema>) => rpc<typeof body, ModuleDto>('optical-modules/uninstall', body),
  transfer: (body: In<typeof moduleTransferSchema>) => rpc<typeof body, ModuleDto>('optical-modules/transfer', body),
  scrap: (body: In<typeof moduleScrapSchema>) => rpc<typeof body, ModuleDto>('optical-modules/scrap', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('optical-modules/delete', body),
};
