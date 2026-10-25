import type { IdBody, OkResult, Paged } from '@contracts/common';
import type {
  CableDto,
  DanglingByDevice,
  EndpointDto,
  PanelConnection,
  cableConnectEndSchema,
  cableCreateSchema,
  cableDeleteSchema,
  cableDisconnectEndSchema,
  cableListSchema,
  cableUpdateSchema,
} from '@contracts/cables';
import { rpc, type In, type RpcOptions } from './api';

export const cableService = {
  list: (body: In<typeof cableListSchema> = {}) => rpc<typeof body, Paged<CableDto>>('cables/list', body),
  get: (body: IdBody) => rpc<IdBody, CableDto>('cables/get', body),
  create: (body: In<typeof cableCreateSchema>, opts?: RpcOptions) => rpc<typeof body, CableDto>('cables/create', body, opts),
  update: (body: In<typeof cableUpdateSchema>) => rpc<typeof body, CableDto>('cables/update', body),
  connectEnd: (body: In<typeof cableConnectEndSchema>, opts?: RpcOptions) => rpc<typeof body, EndpointDto>('cables/connect-end', body, opts),
  disconnectEnd: (body: In<typeof cableDisconnectEndSchema>) => rpc<typeof body, EndpointDto>('cables/disconnect-end', body),
  delete: (body: In<typeof cableDeleteSchema>) => rpc<typeof body, OkResult>('cables/delete', body),
  panelConnections: (body: { panelId: string }) => rpc<typeof body, PanelConnection[]>('cables/panel-connections', body),
  danglingByDevice: (body: { deviceId: string }) => rpc<typeof body, DanglingByDevice>('cables/dangling-by-device', body),
};
