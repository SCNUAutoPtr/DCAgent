import { Router, Request, Response } from 'express';
import ipAddressService from '../services/ipAddressService';
import { IpStatus } from '@prisma/client';
import { z } from 'zod';

const router = Router();

// Validation schemas
const allocateIpSchema = z.object({
  ipAddressId: z.string().uuid('无效的IP地址ID'),
  portId: z.string().uuid('无效的端口ID').optional(),
  deviceId: z.string().uuid('无效的设备ID').optional(),
  hostname: z.string().optional(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, '无效的MAC地址格式').optional(),
  description: z.string().optional(),
});

const releaseIpSchema = z.object({
  ipAddressId: z.string().uuid('无效的IP地址ID'),
  clearHostname: z.boolean().optional(),
  clearMacAddress: z.boolean().optional(),
  clearDescription: z.boolean().optional(),
});

const updateIpSchema = z.object({
  id: z.string().uuid('无效的IP地址ID'),
  hostname: z.string().optional(),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, '无效的MAC地址格式').optional(),
  description: z.string().optional(),
  status: z.nativeEnum(IpStatus).optional(),
});

const listIpAddressesSchema = z.object({
  subnetId: z.string().uuid().optional(),
  status: z.nativeEnum(IpStatus).optional(),
  portId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  search: z.string().optional(),
});

const batchAllocateSchema = z.object({
  subnetId: z.string().uuid('无效的子网ID'),
  targets: z.array(z.object({
    portId: z.string().uuid().optional(),
    deviceId: z.string().uuid().optional(),
    hostname: z.string().optional(),
    macAddress: z.string().optional(),
  })),
});

// POST /api/v1/ip-addresses/allocate - 分配IP地址
router.post('/allocate', async (req: Request, res: Response) => {
  try {
    const data = allocateIpSchema.parse(req.body);
    const ipAddress = await ipAddressService.allocateIp(data);
    res.status(200).json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error allocating IP address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '分配IP地址失败'
    });
  }
});

// POST /api/v1/ip-addresses/release - 释放IP地址
router.post('/release', async (req: Request, res: Response) => {
  try {
    const { ipAddressId, ...options } = releaseIpSchema.parse(req.body);
    const ipAddress = await ipAddressService.releaseIp(ipAddressId, options);
    res.json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error releasing IP address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '释放IP地址失败'
    });
  }
});

// POST /api/v1/ip-addresses/batch-allocate - 批量分配IP
router.post('/batch-allocate', async (req: Request, res: Response) => {
  try {
    const { subnetId, targets } = batchAllocateSchema.parse(req.body);
    const ipAddresses = await ipAddressService.batchAllocateFromSubnet(subnetId, targets);
    res.json(ipAddresses);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error batch allocating IPs:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '批量分配IP失败'
    });
  }
});

// POST /api/v1/ip-addresses/next-available - 获取下一个可用IP
router.post('/next-available', async (req: Request, res: Response) => {
  try {
    const { subnetId } = z.object({ subnetId: z.string().uuid('无效的子网ID') }).parse(req.body);
    const ipAddress = await ipAddressService.getNextAvailableIp(subnetId);

    if (!ipAddress) {
      return res.status(404).json({ error: '子网中没有可用的IP地址' });
    }

    res.json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error getting next available IP:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取可用IP失败'
    });
  }
});

// GET /api/v1/ip-addresses - 查询IP地址列表
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = listIpAddressesSchema.parse({
      subnetId: req.query.subnetId,
      status: req.query.status,
      portId: req.query.portId,
      deviceId: req.query.deviceId,
      search: req.query.search,
    });

    const ipAddresses = await ipAddressService.listIpAddresses(query);
    res.json(ipAddresses);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error listing IP addresses:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '查询IP地址列表失败'
    });
  }
});

// POST /api/v1/ip-addresses/get - 获取IP地址详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().uuid('无效的IP地址ID') }).parse(req.body);
    const ipAddress = await ipAddressService.getIpAddressById(id);

    if (!ipAddress) {
      return res.status(404).json({ error: 'IP地址不存在' });
    }

    res.json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error getting IP address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '获取IP地址详情失败'
    });
  }
});

// POST /api/v1/ip-addresses/get-by-address - 根据IP地址字符串查询
router.post('/get-by-address', async (req: Request, res: Response) => {
  try {
    const { address } = z.object({
      address: z.string().regex(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, '无效的IP地址格式')
    }).parse(req.body);

    const ipAddress = await ipAddressService.getIpAddressByAddress(address);

    if (!ipAddress) {
      return res.status(404).json({ error: 'IP地址不存在' });
    }

    res.json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error getting IP address by address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '查询IP地址失败'
    });
  }
});

// POST /api/v1/ip-addresses/update - 更新IP地址信息
router.post('/update', async (req: Request, res: Response) => {
  try {
    const { id, ...updateData } = updateIpSchema.parse(req.body);
    const ipAddress = await ipAddressService.updateIpAddress(id, updateData);
    res.json(ipAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error updating IP address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '更新IP地址失败'
    });
  }
});

// POST /api/v1/ip-addresses/delete - 删除IP地址
router.post('/delete', async (req: Request, res: Response) => {
  try {
    const { id } = z.object({ id: z.string().uuid('无效的IP地址ID') }).parse(req.body);
    await ipAddressService.deleteIpAddress(id);
    res.json({ success: true, message: 'IP地址删除成功' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error deleting IP address:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '删除IP地址失败'
    });
  }
});

// POST /api/v1/ip-addresses/check-conflicts - 检查IP冲突
router.post('/check-conflicts', async (req: Request, res: Response) => {
  try {
    const { subnetId } = z.object({
      subnetId: z.string().uuid().optional()
    }).parse(req.body);

    const conflicts = await ipAddressService.checkConflicts(subnetId);
    res.json(conflicts);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '验证错误', details: error.errors });
    }
    console.error('Error checking IP conflicts:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : '检查IP冲突失败'
    });
  }
});

export default router;
