import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';

const body = {} as const;

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview', body],
    queryFn: () => dashboardService.overview(),
  });
}
