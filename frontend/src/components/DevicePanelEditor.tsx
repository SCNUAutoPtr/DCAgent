import React, { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Switch,
  Alert,
  Descriptions,
  Tabs,
  Row,
  Col,
  Card,
  Tooltip,
  message,
  Divider,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  UndoOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Panel, PanelPosition, PanelType, PanelTemplate, Device } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';

const { Option } = Select;
const { TabPane } = Tabs;

interface DevicePanelEditorProps {
  visible: boolean;
  onCancel: () => void;
  onSave: (panel: Partial<Panel>) => Promise<void>;
  device: Device;
  panel?: Panel; // 如果存在则是编辑模式
}

interface FormValues {
  name: string;
  type: PanelType;
  panelPosition?: PanelPosition;
  width?: number;
  height?: number;
  backgroundColor?: string;
  templateId?: string;
  useTemplate: boolean;
}

export const DevicePanelEditor: React.FC<DevicePanelEditorProps> = ({
  visible,
  onCancel,
  onSave,
  device,
  panel,
}) => {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [useTemplate, setUseTemplate] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PanelTemplate | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 482.6, height: 44.45 });

  // 加载模板列表
  useEffect(() => {
    if (visible) {
      loadTemplates();
      resetForm();
    }
  }, [visible, device, panel]);

  const loadTemplates = async () => {
    try {
      const allTemplates = await panelTemplateService.getAll();
      setTemplates(allTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      message.error('加载面板模板失败');
    }
  };

  const resetForm = () => {
    if (panel) {
      // 编辑模式
      const hasTemplate = panel.templateId && !panel.isCustomized;
      setUseTemplate(hasTemplate);

      form.setFieldsValue({
        name: panel.name,
        type: panel.type,
        panelPosition: panel.panelPosition || PanelPosition.FRONT,
        width: panel.size?.width || 482.6,
        height: panel.size?.height || 44.45,
        backgroundColor: panel.backgroundColor,
        templateId: panel.templateId,
        useTemplate: hasTemplate,
      });

      if (hasTemplate) {
        const template = templates.find(t => t.id === panel.templateId);
        setSelectedTemplate(template || null);
      }
    } else {
      // 新建模式
      setUseTemplate(false);
      setSelectedTemplate(null);
      form.setFieldsValue({
        name: '',
        type: PanelType.NETWORK,
        panelPosition: PanelPosition.FRONT,
        width: 482.6, // 标准1U面板宽度
        height: 44.45, // 标准1U面板高度
        useTemplate: false,
      });
    }
    updatePreviewSize();
  };

  const updatePreviewSize = () => {
    const values = form.getFieldsValue();
    setPreviewSize({
      width: values.width || 482.6,
      height: values.height || 44.45,
    });
  };

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    setSelectedTemplate(template || null);

    if (template) {
      // 应用模板尺寸
      form.setFieldsValue({
        width: template.width,
        height: template.height,
        type: template.type,
        backgroundColor: template.backgroundColor,
      });
      updatePreviewSize();
    }
  };

  const handleUseTemplateChange = (checked: boolean) => {
    setUseTemplate(checked);
    if (!checked) {
      form.setFieldsValue({ templateId: undefined });
      setSelectedTemplate(null);
    }
  };

  const handlePanelPositionChange = (position: PanelPosition) => {
    if (position === PanelPosition.FRONT || position === PanelPosition.REAR) {
      // 前后面板自动设置为标准机架宽度
      form.setFieldsValue({ width: 482.6 });
    } else {
      // 自定义位置允许修改宽度
      form.setFieldsValue({ width: 482.6 });
    }
    updatePreviewSize();
  };

  const handleSizeChange = () => {
    updatePreviewSize();
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      const panelData: Partial<Panel> = {
        name: values.name,
        type: values.type,
        panelPosition: values.panelPosition,
        deviceId: device.id,
        size: {
          width: values.width,
          height: values.height,
        },
        backgroundColor: values.backgroundColor,
        // 如果使用模板，设置模板ID，否则清除模板
        templateId: values.useTemplate ? values.templateId : undefined,
        isCustomized: values.useTemplate ? false : true,
      };

      await onSave(panelData);
      message.success(panel ? '面板更新成功' : '面板创建成功');
      onCancel();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error('保存失败');
      console.error('Failed to save panel:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPositionLabel = (position?: PanelPosition) => {
    switch (position) {
      case PanelPosition.FRONT:
        return '前面板';
      case PanelPosition.REAR:
        return '后面板';
      case PanelPosition.CUSTOM:
        return '自定义';
      default:
        return '前面板';
    }
  };

  const getTypeLabel = (type: PanelType) => {
    switch (type) {
      case PanelType.NETWORK:
        return '网络面板';
      case PanelType.POWER:
        return '电源面板';
      case PanelType.CONSOLE:
        return '控制台面板';
      case PanelType.USB:
        return 'USB面板';
      case PanelType.MIXED:
        return '混合面板';
      case PanelType.OTHER:
        return '其他';
      default:
        return type;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          {panel ? '编辑设备面板' : '新建设备面板'}
          <Tooltip title="设置设备的接口面板配置">
            <InfoCircleOutlined />
          </Tooltip>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          icon={<SaveOutlined />}
          loading={loading}
          onClick={handleSave}
        >
          保存
        </Button>,
      ]}
    >
      <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
        {/* 设备信息 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{getTypeLabel(device.type)}</Descriptions.Item>
            <Descriptions.Item label="型号">{device.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="U位">
              U{device.uPosition} (高{device.uHeight}U)
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleSizeChange}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="面板名称"
                rules={[{ required: true, message: '请输入面板名称' }]}
              >
                <Input placeholder="例如：前面板 - 24口千兆" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="面板类型"
                rules={[{ required: true, message: '请选择面板类型' }]}
              >
                <Select placeholder="选择面板类型">
                  <Option value={PanelType.NETWORK}>网络面板</Option>
                  <Option value={PanelType.POWER}>电源面板</Option>
                  <Option value={PanelType.CONSOLE}>控制台面板</Option>
                  <Option value={PanelType.USB}>USB面板</Option>
                  <Option value={PanelType.MIXED}>混合面板</Option>
                  <Option value={PanelType.OTHER}>其他</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="panelPosition"
                label="面板位置"
                rules={[{ required: true, message: '请选择面板位置' }]}
              >
                <Select
                  placeholder="选择面板位置"
                  onChange={handlePanelPositionChange}
                >
                  <Option value={PanelPosition.FRONT}>前面板</Option>
                  <Option value={PanelPosition.REAR}>后面板</Option>
                  <Option value={PanelPosition.CUSTOM}>自定义位置</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="backgroundColor"
                label="背景颜色"
              >
                <Input placeholder="#FFFFFF" />
              </Form.Item>
            </Col>
          </Row>

          <Divider>尺寸设置</Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="width"
                label="宽度 (mm)"
                rules={[
                  { required: true, message: '请输入宽度' },
                  { type: 'number', min: 1, message: '宽度必须大于0' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="482.6"
                  step={0.1}
                  disabled={form.getFieldValue('panelPosition') !== PanelPosition.CUSTOM}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="height"
                label="高度 (mm)"
                rules={[
                  { required: true, message: '请输入高度' },
                  { type: 'number', min: 1, message: '高度必须大于0' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="44.45"
                  step={0.1}
                />
              </Form.Item>
            </Col>
          </Row>

          {form.getFieldValue('panelPosition') !== PanelPosition.CUSTOM && (
            <Alert
              message="前面板/后面板使用标准机架宽度"
              description="前面板和后面板使用标准19英寸机架宽度 (482.6mm)，只有自定义位置可以修改宽度。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Divider>模板设置</Divider>

          <Form.Item name="useTemplate" valuePropName="checked">
            <Switch checkedChildren="使用模板" unCheckedChildren="自定义" onChange={handleUseTemplateChange} />
          </Form.Item>

          {useTemplate && (
            <Form.Item
              name="templateId"
              label="选择模板"
              rules={[{ required: true, message: '请选择模板' }]}
            >
              <Select
                placeholder="选择面板模板"
                onChange={handleTemplateChange}
                allowClear
              >
                {templates.map((template) => (
                  <Option key={template.id} value={template.id}>
                    <Space>
                      <span>{template.name}</span>
                      <span style={{ color: '#8c8c8c', fontSize: 12 }}>
                        ({template.portCount}口, {getTypeLabel(template.type)})
                      </span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {selectedTemplate && (
            <Alert
              message="模板信息"
              description={
                <div>
                  <p>模板: {selectedTemplate.name}</p>
                  <p>端口数量: {selectedTemplate.portCount}</p>
                  <p>模板类型: {getTypeLabel(selectedTemplate.type)}</p>
                  <p>描述: {selectedTemplate.description || '无'}</p>
                </div>
              }
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {/* 尺寸预览 */}
          {previewSize && (
            <Card title="尺寸预览" size="small">
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div
                  style={{
                    width: '200px',
                    height: '40px',
                    border: '2px solid #1890ff',
                    backgroundColor: form.getFieldValue('backgroundColor') || '#f0f0f0',
                    margin: '0 auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    color: '#666',
                  }}
                >
                  {form.getFieldValue('name') || '面板预览'}
                </div>
                <p style={{ marginTop: '8px', fontSize: '12px', color: '#8c8c8c' }}>
                  实际尺寸: {previewSize.width} × {previewSize.height} mm
                </p>
              </div>
            </Card>
          )}
        </Form>
      </div>
    </Modal>
  );
};

export default DevicePanelEditor;