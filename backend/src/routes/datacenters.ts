import { Router, Request, Response } from 'express';
import dataCenterService from '../services/dataCenterService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createDataCenterSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  location: z.string().optional(),
});

const updateDataCenterSchema = z.object({
  id: z.string().cuid('Invalid ID'),
  name: z.string().min(1).optional(),
  location: z.string().optional(),
});

const idSchema = z.object({
  id: z.string().cuid('Invalid ID'),
});

// GET /api/v1/datacenters - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search } = req.query;

    if (search) {
      const datacenters = await dataCenterService.searchDataCenters(search as string);
      return res.json(datacenters);
    }

    const datacenters = await dataCenterService.getAllDataCenters();
    res.json(datacenters);
  } catch (error) {
    console.error('Error fetching datacenters:', error);
    res.status(500).json({ error: 'Failed to fetch datacenters' });
  }
});

// POST /api/v1/datacenters/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const datacenter = await dataCenterService.getDataCenterById(id);
    if (!datacenter) {
      return res.status(404).json({ error: 'DataCenter not found' });
    }
    res.json(datacenter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching datacenter:', error);
    res.status(500).json({ error: 'Failed to fetch datacenter' });
  }
});

// POST /api/v1/datacenters/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createDataCenterSchema.parse(req.body);
    const datacenter = await dataCenterService.createDataCenter(validatedData);
    res.status(201).json(datacenter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating datacenter:', error);
    res.status(500).json({ error: 'Failed to create datacenter' });
  }
});

// POST /api/v1/datacenters/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateDataCenterSchema.parse(req.body);
    const datacenter = await dataCenterService.updateDataCenter(id, updateData);
    res.json(datacenter);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating datacenter:', error);
    res.status(500).json({ error: 'Failed to update datacenter' });
  }
});

// POST /api/v1/datacenters/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await dataCenterService.deleteDataCenter(id);
    res.json({ success: true, message: 'DataCenter deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting datacenter:', error);
    res.status(500).json({ error: 'Failed to delete datacenter' });
  }
});

export default router;
