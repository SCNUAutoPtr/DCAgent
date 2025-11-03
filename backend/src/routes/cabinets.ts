import { Router, Request, Response } from 'express';
import cabinetService from '../services/cabinetService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCabinetSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  position: z.string().optional(),
  height: z.number().int().positive().default(42),
  roomId: z.string().cuid('Invalid room ID'),
});

const updateCabinetSchema = z.object({
  id: z.string().cuid('Invalid ID'),
  name: z.string().min(1).optional(),
  position: z.string().optional(),
  height: z.number().int().positive().optional(),
});

const idSchema = z.object({
  id: z.string().cuid('Invalid ID'),
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

// POST /api/v1/cabinets/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createCabinetSchema.parse(req.body);
    const cabinet = await cabinetService.createCabinet(validatedData);
    res.status(201).json(cabinet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating cabinet:', error);
    res.status(500).json({ error: 'Failed to create cabinet' });
  }
});

// POST /api/v1/cabinets/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateCabinetSchema.parse(req.body);
    const cabinet = await cabinetService.updateCabinet(id, updateData);
    res.json(cabinet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating cabinet:', error);
    res.status(500).json({ error: 'Failed to update cabinet' });
  }
});

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
