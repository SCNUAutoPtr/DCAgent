import type { IdBody, OkResult } from '@contracts/common';
import type {
  CabinetDetailDto,
  CabinetDto,
  DataCenterDto,
  RoomDto,
  cabinetCreateSchema,
  cabinetListSchema,
  cabinetUpdateSchema,
  dataCenterCreateSchema,
  dataCenterListSchema,
  dataCenterUpdateSchema,
  roomCreateSchema,
  roomListSchema,
  roomUpdateSchema,
} from '@contracts/hierarchy';
import type { RoomScene } from '@contracts/scene';
import { rpc, type In } from './api';

export const dataCenterService = {
  list: (body: In<typeof dataCenterListSchema> = {}) => rpc<typeof body, DataCenterDto[]>('datacenters/list', body),
  get: (body: IdBody) => rpc<IdBody, DataCenterDto>('datacenters/get', body),
  create: (body: In<typeof dataCenterCreateSchema>) => rpc<typeof body, DataCenterDto>('datacenters/create', body),
  update: (body: In<typeof dataCenterUpdateSchema>) => rpc<typeof body, DataCenterDto>('datacenters/update', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('datacenters/delete', body),
};

export const roomService = {
  list: (body: In<typeof roomListSchema> = {}) => rpc<typeof body, RoomDto[]>('rooms/list', body),
  get: (body: IdBody) => rpc<IdBody, RoomDto>('rooms/get', body),
  create: (body: In<typeof roomCreateSchema>) => rpc<typeof body, RoomDto>('rooms/create', body),
  update: (body: In<typeof roomUpdateSchema>) => rpc<typeof body, RoomDto>('rooms/update', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('rooms/delete', body),
  scene: (body: { roomId: string }) => rpc<typeof body, RoomScene>('rooms/scene', body),
};

export const cabinetService = {
  list: (body: In<typeof cabinetListSchema> = {}) => rpc<typeof body, CabinetDto[]>('cabinets/list', body),
  get: (body: IdBody) => rpc<IdBody, CabinetDetailDto>('cabinets/get', body),
  create: (body: In<typeof cabinetCreateSchema>) => rpc<typeof body, CabinetDetailDto>('cabinets/create', body),
  update: (body: In<typeof cabinetUpdateSchema>) => rpc<typeof body, CabinetDetailDto>('cabinets/update', body),
  delete: (body: IdBody) => rpc<IdBody, OkResult>('cabinets/delete', body),
};
