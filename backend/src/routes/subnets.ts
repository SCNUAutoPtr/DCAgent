import { Router, Request, Response } from 'express';
import subnetService from '../services/subnetService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createSubnetSchema = z.object({
  name: z.string().min(1, '子网名称不能为空'),
  network: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, '无效的网络地址格式'),
  cidr: z.number().int().min(0).max(32, 'CIDR必须在0-32之间'),
  gateway: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, '无效的网关地址格式').optional(),
  vlan: z.string().optional(),
  dnsServers: z.array(z.string()).optional(),
  description: z.string().optional(),
  roomId: z.string().uuid('无效的机房ID').optional(),
  autoGenerateIps: z.boolean().optional().default(true),
  reservedIps: z.array(z.string()).optional(),
});

const updateSubnetSchema = z.object({
  name: z.string().optional(),
  gateway: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, '无效的网关地址格式').optional(),
  vlan: z.string().optional(),
  dnsServers: z.array(z.string()).optional(),
  description: z.string().optional(),
  roomId: z.string().uuid('无效的机房ID').optional().nullable(),
});

const listSubnetsSchema = z.object({
  roomId: z.string().uuid().optional(),
  vlan: z.string().optional(),
  search: z.string().optional(),
});

const calculateSubnetSchema = z.object({
  network: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, '无效的网络地址格式'),
  cidr: z.number().int().min(0).max(32, 'CIDR必须在0-32之间'),
});

// POST /api/v1/subnets/create - 创建子网
router.post('/create', async (req: Request, res: Response) => {
  try {
    const data = createSubnetSchema.parse(req.body);
    const subnet = await subnetService.createSubnet(data);
    res.status(201).json(subnet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error creating subnet:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '创建子网失败'
    });
  }
});

// GET /api/v1/subnets - 查询子网列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = listSubnetsSchema.parse({
      roomId: req.query.roomId,
      vlan: req.query.vlan,
      search: req.query.search,
    });

    const subnets = await subnetService.listSubnets(query);
    res.json(subnets);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error listing subnets:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '查询子网列表失败'
    });
  }
});

// POST /api/v1/subnets/get - 获取子网详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().uuid('无效的子网ID') }).parse(req.body);
    const subnet = await subnetService.getSubnetById(id);

    if (!subnet) {
      return res.status(404).json({ error: '子网不存在' });
    }

    res.json(subnet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error getting subnet:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取子网详情失败'
    });
  }
});

// POST /api/v1/subnets/update - 更新子网信息
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = z.object({
      id: z.string().uuid('无效的子网ID'),
    }).and(updateSubnetSchema).parse(req.body);

    const subnet = await subnetService.updateSubnet(id, updateData);
    res.json(subnet);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error updating subnet:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '更新子网失败'
    });
  }
});

// POST /api/v1/subnets/delete - 删除子网
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().uuid('无效的子网ID') }).parse(req.body);
    await subnetService.deleteSubnet(id);
    res.json({ success: true, message: '子网删除成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error deleting subnet:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '删除子网失败'
    });
  }
});

// POST /api/v1/subnets/calculate - 子网计算（不创建，仅计算）
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { network, cidr } = calculateSubnetSchema.parse(req.body);
    const calculation = subnetService.calculateSubnet(network, cidr);
    res.json(calculation);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error calculating subnet:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '子网计算失败'
    });
  }
});

// GET /api/v1/subnets/statistics - 获取统计信息
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await subnetService.getStatistics();
    res.json(stats);
  } catch (error) {
    console.error('Error getting subnet statistics:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取统计信息失败'
    });
  }
});

export default router;
