import type { IdBody, OkResult } from '@contracts/common';
import type {
  DeviceDetailDto,
  DeviceDto,
  DeviceModelDto,
  deviceBulkCreateSchema,
  deviceCreateSchema,
  deviceDeleteSchema,
  deviceListSchema,
  deviceModelCreateSchema,
  deviceModelListSchema,
  deviceModelUpdateSchema,
  deviceMoveSchema,
  deviceUpdateSchema,
} from '@contracts/devices';
import { rpc, type In, type RpcOptions } from './api';

export const deviceService = {
  list: (body: In<typeof deviceListSchema> = {}) => rpc<typeof body, DeviceDto[]>('devices/list', body),
  get: (body: IdBody) => rpc<IdBody, DeviceDetailDto>('devices/get', body),
  create: (body: In<typeof deviceCreateSchema>) => rpc<typeof body, DeviceDetailDto>('devices/create', body),
  bulkCreate: (body: In<typeof deviceBulkCreateSchema>) => rpc<typeof body, { created: number; ids: string[] }>('devices/bulk-create', body),
  update: (body: In<typeof deviceUpdateSchema>) => rpc<typeof body, DeviceDetailDto>('devices/update', body),
  move: (body: In<typeof deviceMoveSchema>) => rpc<typeof body, DeviceDetailDto>('devices/move', body),
  delete: (body: In<typeof deviceDeleteSchema>, opts?: RpcOptions) => rpc<typeof body, OkResult>('devices/delete', body, opts),
};

export const deviceModelService = {
  list: (body: In<typeof deviceModelListSchema> = {}) => rpc<typeof body, DeviceModelDto[]>('device-models/list', body),
  get: (body: IdBody) => rpc<IdBody, DeviceModelDto>('device-models/get', body),
  create: (body: In<typeof deviceModelCreateSchema>) => rpc<typeof body, DeviceModelDto>('device-models/create', body),
  update: (body: In<typeof deviceModelUpdateSchema>) => rpc<typeof body, DeviceModelDto>('device-models/update', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('device-models/delete', body),
};
