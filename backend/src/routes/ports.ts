import { Router, Request, Response } from 'express';
import portService from '../services/portService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPortSchema = z.object({
  number: z.string().min(1, 'Number is required'),
  label: z.string().nullable().optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'FAULTY']).optional(),
  panelId: z.string().uuid('Invalid panel ID'),
  portType: z.string().optional(),
  rotation: z.number().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const createBulkPortsSchema = z.object({
  panelId: z.string().uuid('Invalid panel ID'),
  count: z.number().int().positive('Count must be positive'),
  prefix: z.string().optional(),
});

const updatePortSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  number: z.string().min(1).optional(),
  label: z.string().nullable().optional(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'FAULTY']).optional(),
  portType: z.string().optional(),
  rotation: z.number().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
});

const updatePortStatusSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'FAULTY']),
});

const idSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

// GET /api/v1/ports - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { panelId, status, search } = req.query;

    if (search) {
      const ports = await portService.searchPorts(search as string);
      return res.json(ports);
    }

    if (status) {
      const ports = await portService.getPortsByStatus(status as any);
      return res.json(ports);
    }

    if (panelId) {
      const ports = await portService.getPortsByPanel(panelId as string);
      return res.json(ports);
    }

    const ports = await portService.getAllPorts();
    res.json(ports);
  } catch (error) {
    console.error('Error fetching ports:', error);
    res.status(500).json({ error: 'Failed to fetch ports' });
  }
});

// POST /api/v1/ports/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const port = await portService.getPortById(id);
    if (!port) {
      return res.status(404).json({ error: 'Port not found' });
    }
    res.json(port);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching port:', error);
    res.status(500).json({ error: 'Failed to fetch port' });
  }
});

// POST /api/v1/ports/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createPortSchema.parse(req.body);
    const port = await portService.createPort(validatedData);
    res.status(201).json(port);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating port:', error);
    res.status(500).json({ error: 'Failed to create port' });
  }
});

// POST /api/v1/ports/create-bulk - 批量创建端口
router.post('/create-bulk', async (req: Request, res: Response) => {
  try {
    const { panelId, count, prefix } = createBulkPortsSchema.parse(req.body);
    const result = await portService.createBulkPorts(panelId, count, prefix);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating bulk ports:', error);
    res.status(500).json({ error: 'Failed to create bulk ports' });
  }
});

// POST /api/v1/ports/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updatePortSchema.parse(req.body);
    const port = await portService.updatePort(id, updateData);
    res.json(port);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating port:', error);
    res.status(500).json({ error: 'Failed to update port' });
  }
});

// POST /api/v1/ports/update-status - 更新端口状态
router.post('/update-status', async (req: Request, res: Response) => {
  try {
    const { id, status } = updatePortStatusSchema.parse(req.body);
    const port = await portService.updatePortStatus(id, status);
    res.json(port);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating port status:', error);
    res.status(500).json({ error: 'Failed to update port status' });
  }
});

// POST /api/v1/ports/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await portService.deletePort(id);
    res.json({ success: true, message: 'Port deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting port:', error);
    res.status(500).json({ error: 'Failed to delete port' });
  }
});

// POST /api/v1/ports/available - 获取面板的可用端口
router.post('/available', async (req: Request, res: Response) => {
  try {
    const panelIdSchema = z.object({
      panelId: z.string().uuid('Invalid panel ID'),
    });
    const { panelId } = panelIdSchema.parse(req.body);
    const ports = await portService.getAvailablePortsByPanel(panelId);
    res.json(ports);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching available ports:', error);
    res.status(500).json({ error: 'Failed to fetch available ports' });
  }
});

export default router;
