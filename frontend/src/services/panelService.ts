import type { IdBody, OkResult } from '@contracts/common';
import type {
  PanelDetailDto,
  PanelDto,
  PortDetailDto,
  PortDto,
  panelCreateSchema,
  panelDeleteSchema,
  panelListSchema,
  panelUpdateSchema,
  portCreateBulkSchema,
  portCreateSchema,
  portDeleteSchema,
  portListSchema,
  portSetAdminStateSchema,
  portUpdateSchema,
} from '@contracts/panels';
import { rpc, type In, type RpcOptions } from './api';

export const panelService = {
  list: (body: In<typeof panelListSchema> = {}) => rpc<typeof body, PanelDto[]>('panels/list', body),
  get: (body: IdBody) => rpc<IdBody, PanelDetailDto>('panels/get', body),
  create: (body: In<typeof panelCreateSchema>) => rpc<typeof body, PanelDetailDto>('panels/create', body),
  update: (body: In<typeof panelUpdateSchema>) => rpc<typeof body, PanelDetailDto>('panels/update', body),
  delete: (body: In<typeof panelDeleteSchema>, opts?: RpcOptions) => rpc<typeof body, OkResult>('panels/delete', body, opts),
};

export const portService = {
  list: (body: In<typeof portListSchema>) => rpc<typeof body, PortDto[]>('ports/list', body),
  get: (body: IdBody) => rpc<IdBody, PortDetailDto>('ports/get', body),
  create: (body: In<typeof portCreateSchema>) => rpc<typeof body, PortDetailDto>('ports/create', body),
  createBulk: (body: In<typeof portCreateBulkSchema>) => rpc<typeof body, { created: number }>('ports/create-bulk', body),
  update: (body: In<typeof portUpdateSchema>) => rpc<typeof body, PortDetailDto>('ports/update', body),
  setAdminState: (body: In<typeof portSetAdminStateSchema>) => rpc<typeof body, PortDetailDto>('ports/set-admin-state', body),
  delete: (body: In<typeof portDeleteSchema>, opts?: RpcOptions) => rpc<typeof body, OkResult>('ports/delete', body, opts),
};
