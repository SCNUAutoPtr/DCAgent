import { Router, Request, Response } from 'express';
import panelService from '../services/panelService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createPanelSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['NETWORK', 'POWER', 'CONSOLE', 'USB', 'MIXED', 'OTHER']),
  deviceId: z.string().uuid('Invalid device ID'),
  // 模板相关
  templateId: z.string().uuid().optional(),
  isCustomized: z.boolean().optional(),
  // 物理布局
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  // 视觉样式
  backgroundColor: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  svgPath: z.string().nullable().optional(),
});

const updatePanelSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  name: z.string().min(1).optional(),
  type: z.enum(['NETWORK', 'POWER', 'CONSOLE', 'USB', 'MIXED', 'OTHER']).optional(),
  // 模板相关
  templateId: z.string().uuid().nullable().optional(),
  isCustomized: z.boolean().optional(),
  // 物理布局
  positionX: z.number().optional(),
  positionY: z.number().optional(),
  size: z.object({
    width: z.number(),
    height: z.number(),
  }).optional(),
  // 视觉样式
  backgroundColor: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  svgPath: z.string().nullable().optional(),
});

const idSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

const shortIdSchema = z.object({
  shortId: z.number().int().positive('Invalid shortId'),
});

// GET /api/v1/panels - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { deviceId, type, search } = req.query;

    if (search) {
      const panels = await panelService.searchPanels(search as string);
      return res.json(panels);
    }

    if (type) {
      const panels = await panelService.getPanelsByType(type as any);
      return res.json(panels);
    }

    if (deviceId) {
      const panels = await panelService.getPanelsByDevice(deviceId as string);
      return res.json(panels);
    }

    const panels = await panelService.getAllPanels();
    res.json(panels);
  } catch (error) {
    console.error('Error fetching panels:', error);
    res.status(500).json({ error: 'Failed to fetch panels' });
  }
});

// POST /api/v1/panels/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const panel = await panelService.getPanelById(id);
    if (!panel) {
      return res.status(404).json({ error: 'Panel not found' });
    }
    res.json(panel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching panel:', error);
    res.status(500).json({ error: 'Failed to fetch panel' });
  }
});

// POST /api/v1/panels/by-shortid - 根据shortId获取详情
router.post('/by-shortid', async (req: Request, res: Response) => {
  try {
    const { shortId } = shortIdSchema.parse(req.body);
    const panel = await panelService.getPanelByShortId(shortId);
    if (!panel) {
      return res.status(404).json({ error: 'Panel not found' });
    }
    res.json(panel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching panel by shortId:', error);
    res.status(500).json({ error: 'Failed to fetch panel by shortId' });
  }
});

// POST /api/v1/panels/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createPanelSchema.parse(req.body);
    const panel = await panelService.createPanel(validatedData);
    res.status(201).json(panel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating panel:', error);
    res.status(500).json({ error: 'Failed to create panel' });
  }
});

// POST /api/v1/panels/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updatePanelSchema.parse(req.body);
    const panel = await panelService.updatePanel(id, updateData);
    res.json(panel);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating panel:', error);
    res.status(500).json({ error: 'Failed to update panel' });
  }
});

// POST /api/v1/panels/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await panelService.deletePanel(id);
    res.json({ success: true, message: 'Panel deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting panel:', error);
    res.status(500).json({ error: 'Failed to delete panel' });
  }
});

export default router;
