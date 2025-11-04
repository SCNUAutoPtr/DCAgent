import { useState, useEffect } from 'react';
import { Typography, Card, Alert, Tabs, Space, Button, Modal, Form, Select, message } from 'antd';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  ApiOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { PanelTemplate, Device } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';
import { deviceService } from '@/services/deviceService';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 批量上架页面
 * 用于批量初始化新购买的服务器和设备
 */
export default function BulkDeploymentPage() {
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
    loadDevices();
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

  const handleCreateFromTemplate = () => {
    form.resetFields();
    setTemplateModalVisible(true);
  };

  const handleTemplateSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { templateId, deviceId } = values;

      await panelTemplateService.createPanelFromTemplate(templateId, deviceId);
      message.success('从模板创建面板成功！');
      setTemplateModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      message.error('创建失败: ' + error.message);
    }
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
          message="功能开发中"
          description="此功能用于批量上架新购买的服务器和网络设备，支持 Excel/CSV 导入和模板快速创建。"
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
                <li>设备类型（服务器、交换机、路由器等）</li>
                <li>所属机柜和U位分配</li>
                <li>IP地址和管理信息</li>
              </ul>
              <Button type="primary" disabled>
                上传 Excel 文件
              </Button>
              <Button style={{ marginLeft: 8 }} disabled>
                下载模板
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
                <ApiOutlined />
                批量创建端口
              </span>
            }
            key="ports"
          >
            <Card>
              <Title level={4}>批量创建端口</Title>
              <Paragraph>
                根据面板类型自动批量生成端口：
              </Paragraph>
              <ul>
                <li>自动生成端口编号（支持自定义命名规则）</li>
                <li>批量设置端口属性（VLAN、速率等）</li>
                <li>批量修改端口状态</li>
              </ul>
              <Button type="primary" disabled>
                批量创建
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
                <li>本端端口和对端端口</li>
                <li>自动建立连接关系</li>
                <li>自动更新端口状态</li>
              </ul>
              <Button type="primary" disabled>
                上传线缆清单
              </Button>
              <Button style={{ marginLeft: 8 }} disabled>
                下载模板
              </Button>
            </Card>
          </TabPane>
        </Tabs>

        <Alert
          message="提示"
          description="批量上架功能正在开发中。当前您可以通过直接访问 /devices、/panels、/ports 页面进行单个资源的管理。"
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
    </div>
  );
}
