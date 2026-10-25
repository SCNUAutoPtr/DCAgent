import type { IdBody, OkResult, Paged } from '@contracts/common';
import type {
  WorkstationDto,
  workstationCreateSchema,
  workstationListSchema,
  workstationSetAdminStateSchema,
  workstationUpdateSchema,
} from '@contracts/workstations';
import { rpc, type In } from './api';

export const workstationService = {
  list: (body: In<typeof workstationListSchema> = {}) => rpc<typeof body, Paged<WorkstationDto>>('workstations/list', body),
  get: (body: IdBody) => rpc<IdBody, WorkstationDto>('workstations/get', body),
  byCode: (body: { code: string }) => rpc<typeof body, WorkstationDto>('workstations/by-code', body),
  create: (body: In<typeof workstationCreateSchema>) => rpc<typeof body, WorkstationDto>('workstations/create', body),
  update: (body: In<typeof workstationUpdateSchema>) => rpc<typeof body, WorkstationDto>('workstations/update', body),
  setAdminState: (body: In<typeof workstationSetAdminStateSchema>) => rpc<typeof body, WorkstationDto>('workstations/set-admin-state', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('workstations/delete', body),
};
