import { Router, Request, Response } from 'express';
import deviceModelService, { CreateDeviceModelDto, UpdateDeviceModelDto } from '../services/deviceModelService';
import { DeviceType } from '@prisma/client';

const router = Router();

/**
 * POST /api/device-models
 * 创建设备型号
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const data: CreateDeviceModelDto = req.body;
    const deviceModel = await deviceModelService.createDeviceModel(data);
    res.status(201).json(deviceModel);
  } catch (error: any) {
    console.error('创建设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/device-models
 * 获取所有设备型号
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const deviceType = req.query.deviceType as DeviceType | undefined;
    const deviceModels = await deviceModelService.getAllDeviceModels(deviceType);
    res.json(deviceModels);
  } catch (error: any) {
    console.error('获取设备型号列表失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/device-models/:id
 * 根据ID获取设备型号
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deviceModel = await deviceModelService.getDeviceModelById(id);
    if (!deviceModel) {
      return res.status(404).json({ error: '设备型号不存在' });
    }
    res.json(deviceModel);
  } catch (error: any) {
    console.error('获取设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/device-models/by-name/:name
 * 根据名称获取设备型号
 */
router.get('/by-name/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const deviceModel = await deviceModelService.getDeviceModelByName(name);
    if (!deviceModel) {
      return res.status(404).json({ error: '设备型号不存在' });
    }
    res.json(deviceModel);
  } catch (error: any) {
    console.error('获取设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/device-models/:id
 * 更新设备型号
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data: UpdateDeviceModelDto = req.body;
    const deviceModel = await deviceModelService.updateDeviceModel(id, data);
    res.json(deviceModel);
  } catch (error: any) {
    console.error('更新设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/device-models/:id
 * 删除设备型号
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await deviceModelService.deleteDeviceModel(id);
    res.status(204).send();
  } catch (error: any) {
    console.error('删除设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/device-models/initialize-presets
 * 初始化预设设备型号
 */
router.post('/initialize-presets', async (req: Request, res: Response) => {
  try {
    await deviceModelService.initializePresetModels();
    res.json({ message: '预设设备型号初始化完成' });
  } catch (error: any) {
    console.error('初始化预设设备型号失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
