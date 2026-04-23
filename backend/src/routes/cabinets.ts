import { Router, Request, Response } from 'express';
import cabinetService from '../services/cabinetService';
import { z } from 'zod';
import { createCrudRoute } from '../utils/crudRouteHandler';

const router = Router();

// Validation schemas
const createCabinetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  shortId: z.number().int().positive('ShortID must be a positive integer'), // 必须提供shortID
  position: z.string().optional(),
  height: z.number().int().positive().default(42),
  roomId: z.string().uuid('Invalid room ID'),
});

export const updateCabinetSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  name: z.string().min(1).optional(),
  shortId: z.number().int().positive('ShortID must be a positive integer').optional(),
  position: z.string().optional(),
  height: z.number().int().positive().optional(),
  roomId: z.string().uuid('Invalid room ID').optional(),
  floorPlanPosition: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  floorPlanSize: z.object({
    width: z.number(),
    depth: z.number(),
  }).optional(),
});

const idSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

const shortIdSchema = z.object({
  shortId: z.number().int().positive('Invalid shortId'),
});

// GET /api/v1/cabinets - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { roomId, search } = req.query;

    if (search) {
      const cabinets = await cabinetService.searchCabinets(search as string);
      return res.json(cabinets);
    }

    if (roomId) {
      const cabinets = await cabinetService.getCabinetsByRoom(roomId as string);
      return res.json(cabinets);
    }

    const cabinets = await cabinetService.getAllCabinets();
    res.json(cabinets);
  } catch (error) {
    console.error('Error fetching cabinets:', error);
    res.status(500).json({ error: 'Failed to fetch cabinets' });
  }
});

// POST /api/v1/cabinets/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const cabinet = await cabinetService.getCabinetById(id);
    if (!cabinet) {
      return res.status(404).json({ error: 'Cabinet not found' });
    }
    res.json(cabinet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching cabinet:', error);
    res.status(500).json({ error: 'Failed to fetch cabinet' });
  }
});

// POST /api/v1/cabinets/by-shortid - 根据shortId获取详情
router.post('/by-shortid', async (req: Request, res: Response) => {
  try {
    const { shortId } = shortIdSchema.parse(req.body);
    const cabinet = await cabinetService.getCabinetByShortId(shortId);
    if (!cabinet) {
      return res.status(404).json({ error: 'Cabinet not found' });
    }
    res.json(cabinet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching cabinet by shortId:', error);
    res.status(500).json({ error: 'Failed to fetch cabinet by shortId' });
  }
});

// POST /api/v1/cabinets/create - 创建
router.post('/create', createCrudRoute({
  schema: createCabinetSchema,
  operation: 'create cabinet',
  successStatus: 201,
  handler: async (validatedData) => cabinetService.createCabinet(validatedData),
}));

// POST /api/v1/cabinets/update - 更新
router.post('/update', createCrudRoute({
  schema: updateCabinetSchema,
  operation: 'update cabinet',
  handler: async ({ id, ...updateData }) => cabinetService.updateCabinet(id, updateData),
}));

// POST /api/v1/cabinets/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await cabinetService.deleteCabinet(id);
    res.json({ success: true, message: 'Cabinet deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting cabinet:', error);
    res.status(500).json({ error: 'Failed to delete cabinet' });
  }
});

export default router;
