import { Router, Request, Response } from 'express';
import { shortIdPoolService } from '../services/shortIdPoolService';
import { z } from 'zod';
import { Parser } from 'json2csv';
import { ShortIdFormatter } from '../utils/shortIdFormatter';

const router = Router();

// Validation schemas
const generateShortIdsSchema = z.object({
  count: z.number().int().positive().max(10000),
  batchNo: z.string().optional(),
});

const createPrintTaskSchema = z.object({
  name: z.string().min(1),
  count: z.number().int().positive().max(10000),
  createdBy: z.string().optional(),
  notes: z.string().optional(),
});

const checkShortIdSchema = z.object({
  shortId: z.union([
    z.number().int().positive(), // 支持数字格式
    z.string().min(1),            // 支持字符串格式（E-XXXXX或纯数字字符串）
  ]),
});

const bindShortIdSchema = z.object({
  shortId: z.union([
    z.number().int().positive(), // 支持数字格式
    z.string().min(1),            // 支持字符串格式（E-XXXXX或纯数字字符串）
  ]),
  entityType: z.enum(['DATA_CENTER', 'ROOM', 'CABINET', 'DEVICE', 'PANEL', 'PORT', 'CABLE']),
  entityId: z.string().uuid(),
});

const cancelShortIdSchema = z.object({
  shortId: z.union([
    z.number().int().positive(), // 支持数字格式
    z.string().min(1),            // 支持字符串格式（E-XXXXX或纯数字字符串）
  ]),
  reason: z.string().optional(),
});

const batchCancelShortIdsSchema = z.object({
  rangeExpr: z.string().min(1),  // 范围表达式
  reason: z.string().optional(),
});

const getPoolRecordsSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(200).optional().default(50),
  entityType: z.enum(['DATA_CENTER', 'ROOM', 'CABINET', 'DEVICE', 'PANEL', 'PORT', 'CABLE']).optional(),
  status: z.enum(['GENERATED', 'PRINTED', 'BOUND', 'CANCELLED']).optional(),
  batchNo: z.string().optional(),
  search: z.string().optional(),
});

const getPrintTasksSchema = z.object({
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(200).optional().default(50),
  status: z.string().optional(),
});

// POST /api/v1/shortid-pool/generate - 批量生成shortID
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { count, batchNo } = generateShortIdsSchema.parse(req.body);
    const shortIds = await shortIdPoolService.generateShortIds(count, batchNo);
    res.status(201).json({
      success: true,
      message: `成功生成 ${shortIds.length} 个shortID`,
      shortIds,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error generating shortIds:', error);
    res.status(500).json({ error: 'Failed to generate shortIds' });
  }
});

// POST /api/v1/shortid-pool/print-task/create - 创建打印任务
router.post('/print-task/create', async (req: Request, res: Response) => {
  try {
    const { name, count, createdBy, notes } = createPrintTaskSchema.parse(req.body);
    const result = await shortIdPoolService.createPrintTask(
      name,
      count,
      createdBy,
      notes
    );
    res.status(201).json({
      success: true,
      message: `打印任务创建成功，生成 ${result.shortIds.length} 个shortID`,
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating print task:', error);
    res.status(500).json({ error: 'Failed to create print task' });
  }
});

// GET /api/v1/shortid-pool/print-task/:id/export - 导出打印任务的shortID为CSV
router.get('/print-task/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { task, shortIds } = await shortIdPoolService.getPrintTaskShortIds(id);

    // 生成CSV数据，使用格式化的shortID（E-XXXXX格式）
    const data = shortIds.map((shortId) => ({
      shortId: ShortIdFormatter.toDisplayFormat(shortId), // 转换为 E-XXXXX 格式
      entityType: task.entityType,
      taskName: task.name,
      createdAt: task.createdAt,
    }));

    const parser = new Parser({
      fields: ['shortId', 'entityType', 'taskName', 'createdAt'],
      header: true,
    });

    const csv = parser.parse(data);

    // 设置响应头
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // 使用 encodeURIComponent 编码文件名，避免中文字符导致的错误
    const fileName = `shortids_${task.name.replace(/[^\w\s-]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
    );

    // 添加BOM以支持Excel正确识别UTF-8
    res.send('\uFEFF' + csv);
  } catch (error) {
    if (error instanceof Error && error.message === '打印任务不存在') {
      return res.status(404).json({ error: error.message });
    }
    console.error('Error exporting print task:', error);
    res.status(500).json({ error: 'Failed to export print task' });
  }
});

// POST /api/v1/shortid-pool/print-task/:id/complete - 标记打印任务为完成
router.post('/print-task/:id/complete', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { filePath } = req.body;
    const task = await shortIdPoolService.completePrintTask(id, filePath);
    res.json({
      success: true,
      message: '打印任务已完成',
      task,
    });
  } catch (error) {
    console.error('Error completing print task:', error);
    res.status(500).json({ error: 'Failed to complete print task' });
  }
});

// POST /api/v1/shortid-pool/check - 检查shortID是否存在
router.post('/check', async (req: Request, res: Response) => {
  try {
    const { shortId } = checkShortIdSchema.parse(req.body);
    // 支持格式化的shortID（E-XXXXX）和数字格式
    const numericId = typeof shortId === 'string'
      ? ShortIdFormatter.toNumericFormat(shortId)
      : shortId;
    const result = await shortIdPoolService.checkShortIdExists(numericId);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error checking shortId:', error);
    res.status(500).json({ error: 'Failed to check shortId' });
  }
});

// POST /api/v1/shortid-pool/bind - 绑定shortID到实体
router.post('/bind', async (req: Request, res: Response) => {
  try {
    const { shortId, entityType, entityId } = bindShortIdSchema.parse(req.body);
    // 支持格式化的shortID（E-XXXXX）和数字格式
    const numericId = typeof shortId === 'string'
      ? ShortIdFormatter.toNumericFormat(shortId)
      : shortId;
    await shortIdPoolService.bindShortIdToEntity(numericId, entityType as any, entityId);
    res.json({
      success: true,
      message: `shortID ${shortId} 已绑定到 ${entityType} ${entityId}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error binding shortId:', error);
    res.status(500).json({ error: 'Failed to bind shortId' });
  }
});

// POST /api/v1/shortid-pool/cancel - 标记shortID为报废
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { shortId, reason } = cancelShortIdSchema.parse(req.body);
    // 支持格式化的shortID（E-XXXXX）和数字格式
    const numericId = typeof shortId === 'string'
      ? ShortIdFormatter.toNumericFormat(shortId)
      : shortId;
    await shortIdPoolService.cancelShortId(numericId, reason);
    res.json({
      success: true,
      message: `shortID ${shortId} 已报废`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error cancelling shortId:', error);
    res.status(500).json({ error: 'Failed to cancel shortId' });
  }
});

// POST /api/v1/shortid-pool/batch-cancel - 批量报废shortID（范围表达式）
router.post('/batch-cancel', async (req: Request, res: Response) => {
  try {
    const { rangeExpr, reason } = batchCancelShortIdsSchema.parse(req.body);
    const result = await shortIdPoolService.cancelShortIdsByRange(rangeExpr, reason);

    res.json({
      success: true,
      message: `成功报废 ${result.success.length} 个shortID`,
      totalRequested: result.totalRequested,
      successCount: result.success.length,
      failedCount: result.failed.length,
      successIds: result.success.map(id => ShortIdFormatter.toDisplayFormat(id)),
      failedDetails: result.failed.map(f => ({
        shortId: ShortIdFormatter.toDisplayFormat(f.shortId),
        reason: f.reason,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error batch cancelling shortIds:', error);
    res.status(500).json({ error: 'Failed to batch cancel shortIds' });
  }
});

// GET /api/v1/shortid-pool/stats - 获取池统计信息
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { entityType } = req.query;
    const stats = await shortIdPoolService.getPoolStats(entityType as any);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching pool stats:', error);
    res.status(500).json({ error: 'Failed to fetch pool stats' });
  }
});

// POST /api/v1/shortid-pool/records - 获取池记录（分页）
router.post('/records', async (req: Request, res: Response) => {
  try {
    const params = getPoolRecordsSchema.parse(req.body);
    const result = await shortIdPoolService.getPoolRecords(params as any);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching pool records:', error);
    res.status(500).json({ error: 'Failed to fetch pool records' });
  }
});

// POST /api/v1/shortid-pool/print-tasks - 获取所有打印任务
router.post('/print-tasks', async (req: Request, res: Response) => {
  try {
    const params = getPrintTasksSchema.parse(req.body);
    const result = await shortIdPoolService.getPrintTasks(params as any);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Error fetching print tasks:', error);
    res.status(500).json({ error: 'Failed to fetch print tasks' });
  }
});

export default router;
