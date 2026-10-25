import type { IdBody, OkResult, Paged } from '@contracts/common';
import type {
  IpAddressDto,
  IpConflict,
  IpStatistics,
  SubnetCalculation,
  SubnetDto,
  ipAllocateSchema,
  ipBatchAllocateSchema,
  ipCheckConflictsSchema,
  ipGetByAddressSchema,
  ipListSchema,
  ipNextAvailableSchema,
  ipUpdateSchema,
  subnetCreateSchema,
  subnetDeleteSchema,
  subnetListSchema,
  subnetUpdateSchema,
} from '@contracts/ip';
import { rpc, type In, type RpcOptions } from './api';

export const subnetService = {
  list: (body: In<typeof subnetListSchema> = {}) => rpc<typeof body, SubnetDto[]>('subnets/list', body),
  get: (body: IdBody) => rpc<IdBody, SubnetDto>('subnets/get', body),
  create: (body: In<typeof subnetCreateSchema>) => rpc<typeof body, SubnetDto>('subnets/create', body),
  update: (body: In<typeof subnetUpdateSchema>) => rpc<typeof body, SubnetDto>('subnets/update', body),
  delete: (body: In<typeof subnetDeleteSchema>, opts?: RpcOptions) => rpc<typeof body, OkResult>('subnets/delete', body, opts),
  calculate: (body: { network: string }) => rpc<typeof body, SubnetCalculation>('subnets/calculate', body),
  statistics: () => rpc<Record<string, never>, IpStatistics>('subnets/statistics', {}),
};

export const ipAddressService = {
  list: (body: In<typeof ipListSchema>) => rpc<typeof body, Paged<IpAddressDto>>('ip-addresses/list', body),
  get: (body: IdBody) => rpc<IdBody, IpAddressDto>('ip-addresses/get', body),
  getByAddress: (body: In<typeof ipGetByAddressSchema>) => rpc<typeof body, IpAddressDto[]>('ip-addresses/get-by-address', body),
  allocate: (body: In<typeof ipAllocateSchema>) => rpc<typeof body, IpAddressDto>('ip-addresses/allocate', body),
  batchAllocate: (body: In<typeof ipBatchAllocateSchema>) => rpc<typeof body, { addresses: string[] }>('ip-addresses/batch-allocate', body),
  nextAvailable: (body: In<typeof ipNextAvailableSchema>) => rpc<typeof body, { addresses: string[] }>('ip-addresses/next-available', body),
  update: (body: In<typeof ipUpdateSchema>) => rpc<typeof body, IpAddressDto>('ip-addresses/update', body),
  release: (body: IdBody) => rpc<IdBody, OkResult>('ip-addresses/release', body),
  checkConflicts: (body: In<typeof ipCheckConflictsSchema> = {}) => rpc<typeof body, IpConflict[]>('ip-addresses/check-conflicts', body),
};
