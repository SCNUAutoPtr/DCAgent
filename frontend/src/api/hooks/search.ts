import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { labelService } from '@/services/labelService';
import { searchService } from '@/services/searchService';

/** search/global; disabled for an empty query. Errors are shown by the caller (silent rpc). */
export function useGlobalSearch(q: string, take = 10) {
  const body = { q: q.trim(), take };
  return useQuery({
    queryKey: ['search', 'global', body],
    queryFn: () => searchService.global(body, { silent: true }),
    enabled: body.q.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
}

/** labels/resolve for a scanned or typed shortId; disabled when shortId is null. */
export function useLabelResolve(shortId: number | null) {
  const body = { shortId: shortId ?? 0 };
  return useQuery({
    queryKey: ['labels', 'resolve', body],
    queryFn: () => labelService.resolve(body, { silent: true }),
    enabled: shortId !== null,
    staleTime: 10_000,
  });
}
