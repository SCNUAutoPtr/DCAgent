import { Router, Request, Response } from 'express';
import dashboardService from '../services/dashboardService';

const router = Router();

// GET /api/v1/dashboard/overview - 仪表板总览数据
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const overview = await dashboardService.getOverview();
    res.json(overview);
  } catch (error) {
    console.error('Error fetching dashboard overview:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
});

export default router;
