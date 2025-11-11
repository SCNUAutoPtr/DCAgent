import { Router } from 'express';
import { panelTemplateService } from '../services/panelTemplateService';

const router = Router();

/**
 * 获取所有模板
 * GET /api/panel-templates?type=ETHERNET
 */
router.get('/', async (req, res) => {
  try {
    const { type } = req.query;
    const templates = await panelTemplateService.getAllTemplates(type as any);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * 获取模板详情
 * GET /api/panel-templates/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await panelTemplateService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    return res.json(template);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * 创建模板
 * POST /api/panel-templates
 */
router.post('/', async (req, res) => {
  try {
    const template = await panelTemplateService.createTemplate(req.body);
    res.status(201).json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 更新模板
 * PUT /api/panel-templates/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const template = await panelTemplateService.updateTemplate(id, req.body);
    res.json(template);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 删除模板
 * DELETE /api/panel-templates/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await panelTemplateService.deleteTemplate(id);
    res.status(204).send();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 从模板创建面板
 * POST /api/panel-templates/:id/create-panel
 */
router.post('/:id/create-panel', async (req, res) => {
  try {
    const { id } = req.params;
    const { deviceId, panelName, shortId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: '缺少 deviceId 参数' });
    }

    const result = await panelTemplateService.createPanelFromTemplate(
      id,
      deviceId,
      panelName,
      shortId
    );
    return res.status(201).json(result);
  } catch (error: any) {
    return res.status(400).json({ error: error.message });
  }
});

/**
 * 解绑面板与模板
 * POST /api/panel-templates/unbind/:panelId
 */
router.post('/unbind/:panelId', async (req, res) => {
  try {
    const { panelId } = req.params;
    const panel = await panelTemplateService.unbindPanelFromTemplate(panelId);
    res.json(panel);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * 初始化系统预设模板
 * POST /api/panel-templates/init-system-templates
 */
router.post('/init-system-templates', async (_req, res) => {
  try {
    await panelTemplateService.initializeSystemTemplates();
    return res.json({ message: '系统预设模板初始化成功' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
