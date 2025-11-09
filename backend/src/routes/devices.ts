import { Router, Request, Response } from 'express';
import deviceService from '../services/deviceService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER']),
  model: z.string().nullable().optional(),
  serialNo: z.string().nullable().optional(),
  uPosition: z.number().int().positive().optional(),
  uHeight: z.number().int().positive().optional(),
  cabinetId: z.string().uuid('Invalid cabinet ID'),
});

const updateDeviceSchema = z.object({
  id: z.string().uuid('Invalid ID'),
  name: z.string().min(1).optional(),
  type: z.enum(['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER']).optional(),
  model: z.string().nullable().optional(),
  serialNo: z.string().nullable().optional(),
  cabinetId: z.string().uuid('Invalid cabinetId').optional(),
  uPosition: z.number().int().positive().optional(),
  uHeight: z.number().int().positive().optional(),
});

const idSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

const shortIdSchema = z.object({
  shortId: z.number().int().positive('Invalid shortId'),
});

const bulkCreateDevicesSchema = z.object({
  devices: z.array(createDeviceSchema),
});

// GET /api/v1/devices - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const { cabinetId, search } = req.query;

    if (search) {
      const devices = await deviceService.searchDevices(search as string);
      return res.json(devices);
    }

    if (cabinetId) {
      const devices = await deviceService.getDevicesByCabinet(cabinetId as string);
      return res.json(devices);
    }

    const devices = await deviceService.getAllDevices();
    res.json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// POST /api/v1/devices/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const device = await deviceService.getDeviceById(id);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching device:', error);
    res.status(500).json({ error: 'Failed to fetch device' });
  }
});

// POST /api/v1/devices/by-shortid - 根据shortId获取详情
router.post('/by-shortid', async (req: Request, res: Response) => {
  try {
    const { shortId } = shortIdSchema.parse(req.body);
    const device = await deviceService.getDeviceByShortId(shortId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching device by shortId:', error);
    res.status(500).json({ error: 'Failed to fetch device by shortId' });
  }
});

// POST /api/v1/devices/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createDeviceSchema.parse(req.body);
    const device = await deviceService.createDevice(validatedData);
    res.status(201).json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating device:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
});

// POST /api/v1/devices/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateDeviceSchema.parse(req.body);
    const device = await deviceService.updateDevice(id, updateData);
    res.json(device);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating device:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
});

// POST /api/v1/devices/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await deviceService.deleteDevice(id);
    res.json({ success: true, message: 'Device deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting device:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// POST /api/v1/devices/bulk-create - 批量创建
router.post('/bulk-create', async (req: Request, res: Response) => {
  try {
    const { devices } = bulkCreateDevicesSchema.parse(req.body);
    const results = await deviceService.bulkCreateDevices(devices);

    res.status(201).json({
      success: true,
      message: `成功创建 ${results.success.length} 个设备`,
      data: results,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error bulk creating devices:', error);
    res.status(500).json({ error: 'Failed to bulk create devices' });
  }
});

export default router;
