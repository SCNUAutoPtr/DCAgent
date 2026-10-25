import { Router, Request, Response } from 'express';
import portCompletionService from '../services/portCompletionService';

const router = Router();

/**
 * POST /api/port-completion/device/:deviceId
 * 为单个设备补全端口
 */
router.post('/device/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;
    const { deviceModelId } = req.body;

    const result = await portCompletionService.completeDevicePorts(deviceId, deviceModelId);
    res.json({
      message: '端口补全完成',
      ...result,
    });
  } catch (error: any) {
    console.error('端口补全失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/port-completion/batch
 * 批量为多个设备补全端口
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { deviceIds } = req.body;

    if (!Array.isArray(deviceIds)) {
      return res.status(400).json({ error: 'deviceIds 必须是数组' });
    }

    const result = await portCompletionService.batchCompleteDevicePorts(deviceIds);
    res.json({
      message: '批量端口补全完成',
      successCount: result.results.length,
      errorCount: result.errors.length,
      ...result,
    });
  } catch (error: any) {
    console.error('批量端口补全失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/port-completion/by-model/:deviceModelId
 * 为指定型号的所有设备补全端口
 */
router.post('/by-model/:deviceModelId', async (req: Request, res: Response) => {
  try {
    const { deviceModelId } = req.params;

    const result = await portCompletionService.completePortsByModel(deviceModelId);
    res.json({
      message: '按型号补全端口完成',
      successCount: result.results.length,
      errorCount: result.errors.length,
      ...result,
    });
  } catch (error: any) {
    console.error('按型号补全端口失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/port-completion/stack-member
 * 创建堆叠成员
 */
router.post('/stack-member', async (req: Request, res: Response) => {
  try {
    const { deviceId, memberId, status, notes } = req.body;

    if (!deviceId || memberId === undefined) {
      return res.status(400).json({ error: 'deviceId 和 memberId 是必填项' });
    }

    const stackMember = await portCompletionService.createStackMember(
      deviceId,
      memberId,
      status,
      notes
    );

    res.status(201).json(stackMember);
  } catch (error: any) {
    console.error('创建堆叠成员失败:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
