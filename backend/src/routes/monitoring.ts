import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { SNMPService } from '../services/snmpService';
import { getTemplateByModel, detectDeviceModel } from '../config/deviceTemplates';

const router = Router();

// 临时存储设备信息（后续会移到数据库）
const monitoringDevices = new Map<string, {
  id: string;
  name: string;
  ip: string;
  community: string;
  vendor: 'lenovo' | 'dell' | 'hp' | 'unknown';
  model?: string;  // 添加机型字段
  status: 'online' | 'offline' | 'warning';
  lastUpdate: string;
}>();

// Validation schemas
const addDeviceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  ip: z.string().ip('Invalid IP address'),
  community: z.string().min(1, 'Community string is required'),
  vendor: z.enum(['lenovo', 'dell', 'hp', 'unknown']).optional(),
});

const testConnectionSchema = z.object({
  ip: z.string().ip('Invalid IP address'),
  community: z.string().min(1, 'Community string is required'),
});

// GET /api/v1/monitoring/devices - 获取所有监控设备
router.get('/devices', async (req: Request, res: Response) => {
  try {
    const devices = Array.from(monitoringDevices.values());
    res.json(devices);
  } catch (error: any) {
    console.error('Failed to get devices:', error);
    res.status(500).json({ error: error.message || 'Failed to get devices' });
  }
});

// POST /api/v1/monitoring/devices - 添加监控设备
router.post('/devices', async (req: Request, res: Response) => {
  try {
    const deviceData = addDeviceSchema.parse(req.body);

    const deviceId = `device-${Date.now()}`;
    const device = {
      id: deviceId,
      name: deviceData.name,
      ip: deviceData.ip,
      community: deviceData.community,
      vendor: deviceData.vendor || 'unknown',
      status: 'online' as const,
      lastUpdate: new Date().toISOString(),
    };

    monitoringDevices.set(deviceId, device);

    res.status(201).json(device);
  } catch (error: any) {
    console.error('Failed to add device:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Failed to add device' });
  }
});

// DELETE /api/v1/monitoring/devices/:deviceId - 删除监控设备
router.delete('/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    if (!monitoringDevices.has(deviceId)) {
      return res.status(404).json({ error: 'Device not found' });
    }

    monitoringDevices.delete(deviceId);
    res.status(204).send();
  } catch (error: any) {
    console.error('Failed to delete device:', error);
    res.status(500).json({ error: error.message || 'Failed to delete device' });
  }
});

// POST /api/v1/monitoring/test-connection - 测试 SNMP 连接
router.post('/test-connection', async (req: Request, res: Response) => {
  try {
    const { ip, community } = testConnectionSchema.parse(req.body);

    const client = new SNMPService({ host: ip, community });

    try {
      // 尝试检测厂商并验证连接
      let vendor = 'unknown';
      let model: string | null = null;
      let message = 'Connected successfully';

      try {
        // 先尝试联想 BMC
        const lenovoInfo = await client.getLenovoBMCInfo();
        if (lenovoInfo.systemModel) {
          vendor = 'lenovo';
          // 检测具体机型
          model = await detectDeviceModel(lenovoInfo.systemModel);

          if (model) {
            const template = getTemplateByModel(model);
            if (template) {
              message = `Connected to ${template.description}`;
            } else {
              message = `Connected to Lenovo ${model} (template not configured)`;
            }
          } else {
            message = `Connected to Lenovo ${lenovoInfo.systemModel || 'Server'}`;
          }
        }
      } catch (lenovoError) {
        // 不是联想，尝试标准 SNMP
        try {
          const systemInfo = await client.getSystemInfo();
          message = `Connected successfully to ${systemInfo.description || 'device'}`;
        } catch (systemError) {
          // 标准 SNMP 也失败，尝试获取任意传感器来验证连接
          const sensors = await client.walk('1.3.6.1.4.1');
          if (sensors && sensors.length > 0) {
            message = 'Connected successfully (vendor detection failed)';
          } else {
            throw new Error('No SNMP data available');
          }
        }
      }

      res.json({
        success: true,
        vendor,
        model,
        message,
      });
    } catch (error: any) {
      res.json({
        success: false,
        message: error.message || 'Connection failed',
      });
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    res.status(500).json({ error: error.message || 'Test connection failed' });
  }
});

// GET /api/v1/monitoring/devices/:deviceId/temperature - 获取温度数据
router.get('/devices/:deviceId/temperature', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = monitoringDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new SNMPService({ host: device.ip, community: device.community });

    let sensors = [];
    if (device.vendor === 'lenovo') {
      sensors = await client.getLenovoTemperatureSensors();
    } else {
      sensors = await client.getTemperatureSensors();
    }

    // 转换为前端期望的格式
    const formattedSensors = sensors.map(s => ({
      name: s.name,
      value: s.value,
      status: parseFloat(s.value) > 80 ? 'critical' : parseFloat(s.value) > 60 ? 'warning' : 'normal',
    }));

    res.json(formattedSensors);
  } catch (error: any) {
    console.error('Failed to get temperature:', error);
    res.status(500).json({ error: error.message || 'Failed to get temperature data' });
  }
});

// GET /api/v1/monitoring/devices/:deviceId/fans - 获取风扇数据
router.get('/devices/:deviceId/fans', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = monitoringDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new SNMPService({ host: device.ip, community: device.community });

    let fans = [];
    if (device.vendor === 'lenovo') {
      fans = await client.getLenovoFans();
    }

    // 转换为前端期望的格式
    const formattedFans = fans.map(f => ({
      name: f.name,
      value: f.value,
      status: 'normal' as const, // 简单假设风扇都正常
    }));

    res.json(formattedFans);
  } catch (error: any) {
    console.error('Failed to get fans:', error);
    res.status(500).json({ error: error.message || 'Failed to get fan data' });
  }
});

// GET /api/v1/monitoring/devices/:deviceId/power - 获取电源数据
router.get('/devices/:deviceId/power', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = monitoringDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new SNMPService({ host: device.ip, community: device.community });

    // 获取功耗相关的传感器
    const sensors = await client.getLenovoSensorValues([
      '1.3.6.1.4.1.53184.1.3.1.14', // Total_Power
      '1.3.6.1.4.1.53184.1.3.1.15', // CPU_Power
      '1.3.6.1.4.1.53184.1.3.1.16', // MEM_Power
      '1.3.6.1.4.1.53184.1.3.1.19', // 24h_Avg_Power
    ]);

    const powerMetrics = {
      totalPower: sensors[0]?.value || '--',
      cpuPower: sensors[1]?.value || '--',
      memPower: sensors[2]?.value || '--',
      avgPower: sensors[3]?.value || '--',
    };

    res.json(powerMetrics);
  } catch (error: any) {
    console.error('Failed to get power:', error);
    res.status(500).json({ error: error.message || 'Failed to get power data' });
  }
});

// GET /api/v1/monitoring/devices/:deviceId/health - 获取健康状态
router.get('/devices/:deviceId/health', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = monitoringDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new SNMPService({ host: device.ip, community: device.community });

    let healthStatus = {
      overall: 'unknown',
      cpu: 'unknown',
      memory: 'unknown',
      storage: 'unknown',
    };

    if (device.vendor === 'lenovo') {
      const health = await client.getLenovoBMCInfo();
      // 这里需要解析健康状态数据
      healthStatus = {
        overall: 'normal', // 简化处理
        cpu: 'normal',
        memory: 'normal',
        storage: 'normal',
      };
    }

    res.json(healthStatus);
  } catch (error: any) {
    console.error('Failed to get health:', error);
    res.status(500).json({ error: error.message || 'Failed to get health status' });
  }
});

// GET /api/v1/monitoring/devices/:deviceId/sensors - 获取所有传感器
router.get('/devices/:deviceId/sensors', async (req: Request, res: Response) => {
  try {
    const { deviceId } = req.params;

    const device = monitoringDevices.get(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const client = new SNMPService({ host: device.ip, community: device.community });

    let sensors = [];
    if (device.vendor === 'lenovo') {
      sensors = await client.getLenovoSensors();
    }

    res.json(sensors);
  } catch (error: any) {
    console.error('Failed to get sensors:', error);
    res.status(500).json({ error: error.message || 'Failed to get sensor data' });
  }
});

export default router;
