import { Router, Request, Response } from 'express';
import cableService from '../services/cableService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createCableSchema = z.object({
  label: z.string().optional(),
  type: z.enum(['CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'POWER', 'OTHER']),
  length: z.number().positive().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
  portAId: z.string().cuid('Invalid port A ID'),
  portBId: z.string().cuid('Invalid port B ID'),
});

const updateCableSchema = z.object({
  id: z.string().cuid('Invalid ID'),
  label: z.string().optional(),
  type: z.enum(['CAT5E', 'CAT6', 'CAT6A', 'CAT7', 'FIBER_SM', 'FIBER_MM', 'POWER', 'OTHER']).optional(),
  length: z.number().positive().optional(),
  color: z.string().optional(),
  notes: z.string().optional(),
});

const idSchema = z.object({
  id: z.string().cuid('Invalid ID'),
});

const portIdSchema = z.object({
  portId: z.string().cuid('Invalid port ID'),
});

const panelIdSchema = z.object({
  panelId: z.string().cuid('Invalid panel ID'),
  depth: z.number().int().positive().optional(),
});

// GET /api/v1/cables - 获取列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const cables = await cableService.getAllCables();
    res.json(cables);
  } catch (error) {
    console.error('Error fetching cables:', error);
    res.status(500).json({ error: 'Failed to fetch cables' });
  }
});

// POST /api/v1/cables/get - 获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    const cable = await cableService.getCableById(id);
    if (!cable) {
      return res.status(404).json({ error: 'Cable not found' });
    }
    res.json(cable);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching cable:', error);
    res.status(500).json({ error: 'Failed to fetch cable' });
  }
});

// POST /api/v1/cables/create - 创建
router.post('/create', async (req: Request, res: Response) => {
  try {
    const validatedData = createCableSchema.parse(req.body);
    const cable = await cableService.createCable(validatedData);
    res.status(201).json(cable);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating cable:', error);
    res.status(500).json({ error: 'Failed to create cable' });
  }
});

// POST /api/v1/cables/update - 更新
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateCableSchema.parse(req.body);
    const cable = await cableService.updateCable(id, updateData);
    res.json(cable);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating cable:', error);
    res.status(500).json({ error: 'Failed to update cable' });
  }
});

// POST /api/v1/cables/delete - 删除
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = idSchema.parse(req.body);
    await cableService.deleteCable(id);
    res.json({ success: true, message: 'Cable deleted successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error deleting cable:', error);
    res.status(500).json({ error: 'Failed to delete cable' });
  }
});

// POST /api/v1/cables/port-connection - 获取端口连接
router.post('/port-connection', async (req: Request, res: Response) => {
  try {
    const { portId } = portIdSchema.parse(req.body);
    const connection = await cableService.getPortConnection(portId);
    if (!connection) {
      return res.status(404).json({ error: 'No connection found for this port' });
    }
    res.json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching port connection:', error);
    res.status(500).json({ error: 'Failed to fetch port connection' });
  }
});

// POST /api/v1/cables/panel-connections - 获取面板连接
router.post('/panel-connections', async (req: Request, res: Response) => {
  try {
    const { panelId } = panelIdSchema.parse(req.body);
    const connections = await cableService.getPanelConnections(panelId);
    res.json(connections);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching panel connections:', error);
    res.status(500).json({ error: 'Failed to fetch panel connections' });
  }
});

// POST /api/v1/cables/network-topology - 获取网络拓扑
router.post('/network-topology', async (req: Request, res: Response) => {
  try {
    const { panelId, depth } = panelIdSchema.parse(req.body);
    const maxDepth = depth || 3;
    const topology = await cableService.getNetworkTopology(panelId, maxDepth);
    res.json(topology);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching network topology:', error);
    res.status(500).json({ error: 'Failed to fetch network topology' });
  }
});

export default router;
