import { QueryClient } from '@tanstack/react-query';

/** One client for the whole app. rpc already toasts errors, so queries only retry once. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});
