import type { SearchHit, globalSearchSchema } from '@contracts/search';
import { rpc, type In, type RpcOptions } from './api';

export const searchService = {
  global: (body: In<typeof globalSearchSchema>, opts?: RpcOptions) => rpc<typeof body, SearchHit[]>('search/global', body, opts),
};
