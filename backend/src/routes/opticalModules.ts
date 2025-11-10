import { Router, Request, Response } from 'express';
import opticalModuleService from '../services/opticalModuleService';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createModuleSchema = z.object({
  serialNo: z.string().min(1, 'Serial number is required'),
  model: z.string().min(1, 'Model is required'),
  vendor: z.string().min(1, 'Vendor is required'),
  moduleType: z.enum(['SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'QSFP_DD']),
  wavelength: z.string().optional(),
  distance: z.string().optional(),
  ddmSupport: z.boolean().optional(),
  supplier: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  price: z.number().positive().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const updateModuleSchema = z.object({
  model: z.string().optional(),
  vendor: z.string().optional(),
  moduleType: z.enum(['SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'QSFP_DD']).optional(),
  wavelength: z.string().optional(),
  distance: z.string().optional(),
  ddmSupport: z.boolean().optional(),
  supplier: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  price: z.number().positive().optional(),
  warrantyExpiry: z.string().datetime().optional(),
  notes: z.string().optional(),
});

const installModuleSchema = z.object({
  portId: z.string().uuid('Invalid port ID'),
  operator: z.string().optional(),
  notes: z.string().optional(),
});

const transferModuleSchema = z.object({
  targetPortId: z.string().uuid('Invalid target port ID'),
  operator: z.string().optional(),
  notes: z.string().optional(),
});

const scrapModuleSchema = z.object({
  operator: z.string().optional(),
  notes: z.string().optional(),
});

const uninstallModuleSchema = z.object({
  operator: z.string().optional(),
  notes: z.string().optional(),
});

const listModulesSchema = z.object({
  status: z.enum(['IN_STOCK', 'INSTALLED', 'RESERVED', 'FAULTY', 'SCRAPPED']).optional(),
  moduleType: z.string().optional(),
  vendor: z.string().optional(),
  isInstalled: z.boolean().optional(),
  search: z.string().optional(),
});

// POST /api/v1/optical-modules - 采购入库
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = createModuleSchema.parse(req.body);

    // 转换日期字符串为 Date 对象
    const moduleData: any = { ...data };
    if (data.purchaseDate) {
      moduleData.purchaseDate = new Date(data.purchaseDate);
    }
    if (data.warrantyExpiry) {
      moduleData.warrantyExpiry = new Date(data.warrantyExpiry);
    }

    const module = await opticalModuleService.createModule(moduleData);
    res.status(201).json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error creating optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create optical module'
    });
  }
});

// GET /api/v1/optical-modules - 列表查询
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = listModulesSchema.parse({
      status: req.query.status,
      moduleType: req.query.moduleType,
      vendor: req.query.vendor,
      isInstalled: req.query.isInstalled === 'true' ? true : req.query.isInstalled === 'false' ? false : undefined,
      search: req.query.search,
    });

    const modules = await opticalModuleService.listModules(query);
    res.json(modules);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching optical modules:', error);
    res.status(500).json({ error: 'Failed to fetch optical modules' });
  }
});

// POST /api/v1/optical-modules/get - 根据ID获取详情
router.post('/get', async (req: Request, res: Response) => {
  try {
    const { id } = req.body;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Invalid module ID' });
    }

    const module = await opticalModuleService.getModuleById(id);
    if (!module) {
      return res.status(404).json({ error: 'Optical module not found' });
    }

    res.json(module);
  } catch (error) {
    console.error('Error fetching optical module:', error);
    res.status(500).json({ error: 'Failed to fetch optical module' });
  }
});

// POST /api/v1/optical-modules/by-serial - 根据序列号获取详情
router.post('/by-serial', async (req: Request, res: Response) => {
  try {
    const { serialNo } = req.body;
    if (!serialNo || typeof serialNo !== 'string') {
      return res.status(400).json({ error: 'Invalid serial number' });
    }

    const module = await opticalModuleService.getModuleBySerialNo(serialNo);
    if (!module) {
      return res.status(404).json({ error: 'Optical module not found' });
    }

    res.json(module);
  } catch (error) {
    console.error('Error fetching optical module by serial:', error);
    res.status(500).json({ error: 'Failed to fetch optical module' });
  }
});

// POST /api/v1/optical-modules/:id/update - 更新模块信息
router.post('/:id/update', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateModuleSchema.parse(req.body);

    // 转换日期字符串为 Date 对象
    const updateData: any = { ...data };
    if (data.purchaseDate) {
      updateData.purchaseDate = new Date(data.purchaseDate);
    }
    if (data.warrantyExpiry) {
      updateData.warrantyExpiry = new Date(data.warrantyExpiry);
    }

    const module = await opticalModuleService.updateModule(id, updateData);
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error updating optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update optical module'
    });
  }
});

// POST /api/v1/optical-modules/:id/install - 安装到端口
router.post('/:id/install', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = installModuleSchema.parse(req.body);

    const module = await opticalModuleService.installModule(id, data);
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error installing optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to install optical module'
    });
  }
});

// POST /api/v1/optical-modules/:id/uninstall - 从端口卸下
router.post('/:id/uninstall', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = uninstallModuleSchema.parse(req.body);

    const module = await opticalModuleService.uninstallModule(id, data.operator, data.notes);
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error uninstalling optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to uninstall optical module'
    });
  }
});

// POST /api/v1/optical-modules/:id/transfer - 转移到其他端口
router.post('/:id/transfer', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = transferModuleSchema.parse(req.body);

    const module = await opticalModuleService.transferModule(id, data);
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error transferring optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to transfer optical module'
    });
  }
});

// POST /api/v1/optical-modules/:id/scrap - 报废
router.post('/:id/scrap', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = scrapModuleSchema.parse(req.body);

    const module = await opticalModuleService.scrapModule(id, data);
    res.json(module);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error scrapping optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to scrap optical module'
    });
  }
});

// POST /api/v1/optical-modules/:id/history - 获取移动历史
router.post('/:id/history', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const history = await opticalModuleService.getModuleHistory(id);
    res.json(history);
  } catch (error) {
    console.error('Error fetching module history:', error);
    res.status(500).json({ error: 'Failed to fetch module history' });
  }
});

// DELETE /api/v1/optical-modules/:id - 删除（仅限未安装）
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await opticalModuleService.deleteModule(id);
    res.json({ message: 'Optical module deleted successfully' });
  } catch (error) {
    console.error('Error deleting optical module:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete optical module'
    });
  }
});

// GET /api/v1/optical-modules/statistics - 获取统计信息
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const statistics = await opticalModuleService.getStatistics();
    res.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
