import { useState, useEffect } from 'react';
import { Typography, Card, Alert, Tabs, Space, Button, Modal, Form, Select, message } from 'antd';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { PanelTemplate, Device, Cabinet } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/cabinetService';
import BulkImportModal, { BulkImportColumn } from '@/components/BulkImportModal';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 批量上架页面
 * 用于批量初始化新购买的服务器和设备
 */
export default function BulkDeploymentPage() {
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [deviceImportVisible, setDeviceImportVisible] = useState(false);
  const [cableImportVisible, setCableImportVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
    loadDevices();
    loadCabinets();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await panelTemplateService.getAll();
      setTemplates(data);
    } catch (error: any) {
      message.error('加载模板失败: ' + error.message);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await deviceService.getAll();
      setDevices(data);
    } catch (error: any) {
      message.error('加载设备失败: ' + error.message);
    }
  };

  const loadCabinets = async () => {
    try {
      const data = await cabinetService.getAll();
      setCabinets(data);
    } catch (error: any) {
      message.error('加载机柜失败: ' + error.message);
    }
  };

  const handleCreateFromTemplate = () => {
    form.resetFields();
    setTemplateModalVisible(true);
  };

  const handleTemplateSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { templateId, deviceId } = values;

      await panelTemplateService.createPanelFromTemplate(templateId, deviceId);
      message.success('从模板创建面板成功');
      setTemplateModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      message.error('创建失败: ' + error.message);
    }
  };

  // 设备导入列配置
  const deviceColumns: BulkImportColumn[] = [
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      required: true,
      validator: (value) => {
        if (typeof value !== 'string' || value.trim().length === 0) {
          return '设备名称不能为空';
        }
        return null;
      },
    },
    {
      title: '设备类型',
      dataIndex: 'type',
      key: 'type',
      required: true,
      validator: (value) => {
        const validTypes = ['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER'];
        if (!validTypes.includes(value)) {
          return `设备类型必须是: ${validTypes.join(', ')}`;
        }
        return null;
      },
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      required: false,
    },
    {
      title: '序列号',
      dataIndex: 'serialNo',
      key: 'serialNo',
      required: false,
    },
    {
      title: '机柜ID',
      dataIndex: 'cabinetId',
      key: 'cabinetId',
      required: true,
      validator: (value) => {
        if (!cabinets.find(c => c.id === value)) {
          return '机柜ID不存在';
        }
        return null;
      },
    },
    {
      title: 'U位位置',
      dataIndex: 'uPosition',
      key: 'uPosition',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value < 1 || value > 42)) {
          return 'U位位置必须是1-42之间的数字';
        }
        return null;
      },
    },
    {
      title: 'U高度',
      dataIndex: 'uHeight',
      key: 'uHeight',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value < 1)) {
          return 'U高度必须是正整数';
        }
        return null;
      },
    },
  ];

  // 设备导入模板数据
  const deviceTemplateData = [
    {
      设备名称: 'SV-001',
      设备类型: 'SERVER',
      型号: 'Dell PowerEdge R740',
      序列号: 'SN123456',
      机柜ID: cabinets[0]?.id || '请填写有效的机柜ID',
      U位位置: 10,
      U高度: 2,
    },
    {
      设备名称: 'SW-001',
      设备类型: 'SWITCH',
      型号: 'Cisco Catalyst 9300',
      序列号: 'SN789012',
      机柜ID: cabinets[0]?.id || '请填写有效的机柜ID',
      U位位置: 40,
      U高度: 1,
    },
  ];

  // 线缆导入列配置
  const cableColumns: BulkImportColumn[] = [
    {
      title: '标签',
      dataIndex: 'label',
      key: 'label',
      required: false,
    },
    {
      title: '线缆类型',
      dataIndex: 'type',
      key: 'type',
      required: true,
      validator: (value) => {
        const validTypes = ['CAT5E', 'CAT6', 'CAT6A', 'FIBER_SM', 'FIBER_MM', 'DAC', 'AOC', 'QSFP', 'OTHER'];
        if (!validTypes.includes(value)) {
          return `线缆类型必须是: ${validTypes.join(', ')}`;
        }
        return null;
      },
    },
    {
      title: '长度(米)',
      dataIndex: 'length',
      key: 'length',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value <= 0)) {
          return '长度必须是正数';
        }
        return null;
      },
    },
    {
      title: '颜色',
      dataIndex: 'color',
      key: 'color',
      required: false,
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      required: false,
    },
    {
      title: '端口A ID',
      dataIndex: 'portAId',
      key: 'portAId',
      required: true,
    },
    {
      title: '端口B ID',
      dataIndex: 'portBId',
      key: 'portBId',
      required: true,
    },
  ];

  // 线缆导入模板数据
  const cableTemplateData = [
    {
      标签: 'CABLE-001',
      线缆类型: 'CAT6',
      '长度(米)': 3,
      颜色: '蓝色',
      备注: '服务器到交换机',
      '端口A ID': '请填写有效的端口ID',
      '端口B ID': '请填写有效的端口ID',
    },
  ];

  // 处理设备批量导入
  const handleDeviceImport = async (data: any[]) => {
    try {
      const result = await deviceService.bulkCreate(data);

      if (result.data.failed.length > 0) {
        Modal.warning({
          title: '部分导入失败',
          content: (
            <div>
              <p>成功: {result.data.success.length} 条</p>
              <p>失败: {result.data.failed.length} 条</p>
              <ul>
                {result.data.failed.map((f: any) => (
                  <li key={f.index}>
                    第 {f.index} 行: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          ),
        });
      }

      await loadDevices();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  // 处理线缆批量导入（待实现后端API）
  const handleCableImport = async (data: any[]) => {
    message.info('线缆批量导入功能开发中');
    console.log('Cable import data:', data);
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <CloudUploadOutlined /> 批量上架管理
          </Title>
          <Paragraph type="secondary">
            批量导入和初始化新设备、面板、端口和线缆连接
          </Paragraph>
        </div>

        <Alert
          message="批量上架助手"
          description="支持通过 Excel/CSV 文件批量导入设备和线缆信息，快速完成数据中心设备上架工作。"
          type="info"
          showIcon
        />

        <Tabs defaultActiveKey="devices" type="card">
          <TabPane
            tab={
              <span>
                <DatabaseOutlined />
                批量创建设备
              </span>
            }
            key="devices"
          >
            <Card>
              <Title level={4}>批量创建设备</Title>
              <Paragraph>
                支持通过 Excel/CSV 文件批量导入设备信息，包括：
              </Paragraph>
              <ul>
                <li>设备名称、型号、序列号</li>
                <li>设备类型（SERVER, SWITCH, ROUTER, FIREWALL, STORAGE, PDU, OTHER）</li>
                <li>所属机柜和U位分配</li>
                <li>自动验证数据完整性和合法性</li>
              </ul>
              <Button
                type="primary"
                onClick={() => setDeviceImportVisible(true)}
              >
                批量导入设备
              </Button>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <ApartmentOutlined />
                批量创建面板
              </span>
            }
            key="panels"
          >
            <Card>
              <Title level={4}>批量创建面板</Title>
              <Paragraph>
                从预定义模板快速创建标准设备面板配置：
              </Paragraph>
              <ul>
                <li>网络设备标准面板模板（24口、48口等）</li>
                <li>服务器面板模板（双网口、管理口等）</li>
                <li>存储设备面板模板</li>
                <li>PDU电源面板模板</li>
              </ul>
              <Button type="primary" onClick={handleCreateFromTemplate}>
                从模板创建面板
              </Button>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <LinkOutlined />
                批量导入线缆
              </span>
            }
            key="cables"
          >
            <Card>
              <Title level={4}>批量导入线缆连接</Title>
              <Paragraph>
                通过 Excel/CSV 文件批量导入线缆连接信息：
              </Paragraph>
              <ul>
                <li>线缆类型、长度、颜色</li>
                <li>本端端口和对端端口ID</li>
                <li>自动建立连接关系</li>
                <li>自动更新端口状态</li>
              </ul>
              <Button
                type="primary"
                onClick={() => setCableImportVisible(true)}
              >
                批量导入线缆
              </Button>
            </Card>
          </TabPane>
        </Tabs>

        <Alert
          message="提示"
          description="批量导入前，请先创建好数据中心、机房和机柜等基础设施。导入时需要引用这些资源的ID。"
          type="warning"
          showIcon
        />
      </Space>

      {/* 从模板创建面板 Modal */}
      <Modal
        title="从模板创建面板"
        open={templateModalVisible}
        onOk={handleTemplateSubmit}
        onCancel={() => setTemplateModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="templateId"
            label="选择模板"
            rules={[{ required: true, message: '请选择模板' }]}
          >
            <Select placeholder="选择面板模板">
              {templates.map((template) => (
                <Select.Option key={template.id} value={template.id}>
                  {template.name} ({template.type} - {template.portCount}口)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="deviceId"
            label="选择设备"
            rules={[{ required: true, message: '请选择设备' }]}
          >
            <Select placeholder="选择目标设备">
              {devices.map((device) => (
                <Select.Option key={device.id} value={device.id}>
                  {device.name} ({device.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设备批量导入 Modal */}
      <BulkImportModal
        visible={deviceImportVisible}
        title="批量导入设备"
        columns={deviceColumns}
        templateData={deviceTemplateData}
        onCancel={() => setDeviceImportVisible(false)}
        onSubmit={handleDeviceImport}
      />

      {/* 线缆批量导入 Modal */}
      <BulkImportModal
        visible={cableImportVisible}
        title="批量导入线缆"
        columns={cableColumns}
        templateData={cableTemplateData}
        onCancel={() => setCableImportVisible(false)}
        onSubmit={handleCableImport}
      />
    </div>
  );
}
