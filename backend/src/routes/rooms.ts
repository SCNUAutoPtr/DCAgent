import { Router, Request, Response } from 'express';
import roomService from '../services/roomService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  shortId: z.number().int().positive('ShortID must be a positive integer'), // 必须提供shortID
  floor: z.string().optional(),
  dataCenterId: z.string().uuid('Invalid datacenter ID'),
});

const updateRoomSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  name: z.string().min(1).optional(),
  shortId: z.number().int().positive('ShortID must be a positive integer').optional(),
  floor: z.string().optional(),
});

const idSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

const shortIdSchema = z.object({
  shortId: z.number().int().positive('Invalid shortId'),
});

// GET /api/v1/rooms - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { dataCenterId, search } = req.query;

    if (search) {
      const rooms = await roomService.searchRooms(search as string);
      return res.json(rooms);
    }

    if (dataCenterId) {
      const rooms = await roomService.getRoomsByDataCenter(dataCenterId as string);
      return res.json(rooms);
    }

    const rooms = await roomService.getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// POST /api/v1/rooms/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const room = await roomService.getRoomById(id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /api/v1/rooms/by-shortid - 根据shortId获取详情
router.post('/by-shortid', async (req: Request, res: Response) => {
  try {
    const { shortId } = shortIdSchema.parse(req.body);
    const room = await roomService.getRoomByShortId(shortId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching room by shortId:', error);
    res.status(500).json({ error: 'Failed to fetch room by shortId' });
  }
});

// POST /api/v1/rooms/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createRoomSchema.parse(req.body);
    const room = await roomService.createRoom(validatedData);
    res.status(201).json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// POST /api/v1/rooms/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateRoomSchema.parse(req.body);
    const room = await roomService.updateRoom(id, updateData);
    res.json(room);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// POST /api/v1/rooms/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await roomService.deleteRoom(id);
    res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
