import type { DashboardOverview } from '@contracts/dashboard';
import { rpc } from './api';

export const dashboardService = {
  overview: () => rpc<Record<string, never>, DashboardOverview>('dashboard/overview', {}),
};
