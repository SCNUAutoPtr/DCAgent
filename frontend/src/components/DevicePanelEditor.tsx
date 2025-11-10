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
  Row,
  Col,
  Card,
  Tooltip,
  message,
  Divider,
  Typography,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Panel, PanelType, PanelTemplate, Device, DeviceType, Port } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';
import { portService } from '@/services/portService';
import { shortIdPoolService } from '@/services/shortIdPoolService';
import { ShortIdFormatter } from '@/utils/shortIdFormatter';
import PanelCanvasEditor, { PortDefinition } from './PanelCanvasEditor';

const { Text } = Typography;

const { Option } = Select;

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
  shortId?: string; // shortID (支持E-XXXXX格式或纯数字)
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
  const [isEditMode] = useState(false); // 是否处于可视化编辑模式
  const [ports, setPorts] = useState<PortDefinition[]>([]); // 端口数据
  const [, setLoadingPorts] = useState(false);

  // 加载模板列表和端口数据
  useEffect(() => {
    if (visible) {
      loadTemplates();
      loadPorts();
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

  // 加载面板端口数据
  const loadPorts = async () => {
    if (!panel?.id) {
      setPorts([]);
      return;
    }

    try {
      setLoadingPorts(true);
      const panelPorts = await portService.getAll(panel.id);

      // 将 Port 转换为 PortDefinition 格式
      const portDefinitions: PortDefinition[] = panelPorts.map((port: Port) => ({
        id: port.id,
        number: port.number,
        portType: port.portType || 'RJ45',
        position: port.position || { x: 20, y: 20 },
        size: port.size || { width: 15, height: 12 },
        label: port.label,
        rotation: (port as any).rotation || 0, // 添加旋转角度
      }));

      setPorts(portDefinitions);
    } catch (error) {
      console.error('Failed to load ports:', error);
      message.error('加载端口数据失败');
      setPorts([]);
    } finally {
      setLoadingPorts(false);
    }
  };

  const resetForm = () => {
    if (panel) {
      // 编辑模式
      const hasTemplate = !!(panel.templateId && !panel.isCustomized);
      setUseTemplate(hasTemplate);

      // 从 Panel 对象获取宽度和高度
      // 兼容两种格式：panel.size 对象格式和扁平化的 panel.width/panel.height
      const width = panel.size?.width || (panel as any).width || 482.6;
      const height = panel.size?.height || (panel as any).height || 44.45;

      form.setFieldsValue({
        name: panel.name,
        type: panel.type,
        shortId: panel.shortId ? ShortIdFormatter.toDisplayFormat(panel.shortId) : undefined,
        width,
        height,
        backgroundColor: panel.backgroundColor || '#FFFFFF',
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
      // 根据设备U高度计算面板高度
      const deviceHeight = (device.uHeight || 1) * 44.45;

      form.setFieldsValue({
        name: '',
        type: PanelType.NETWORK,
        width: 482.6, // 标准1U面板宽度
        height: deviceHeight, // 根据设备U高度计算
        backgroundColor: '#FFFFFF', // 默认白色背景
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

  
  const handleSizeChange = () => {
    updatePreviewSize();
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // 处理shortID
      let numericShortId: number | undefined = undefined;
      if (values.shortId && values.shortId.trim()) {
        try {
          // 如果是格式化的shortID (E-XXXXX)，转换为数字
          numericShortId = ShortIdFormatter.toNumericFormat(values.shortId.trim());

          // 验证shortID是否已存在（如果是新ID或者与原ID不同）
          if (numericShortId !== panel?.shortId) {
            const checkResult = await shortIdPoolService.checkShortIdExists(numericShortId);
            if (checkResult.exists && checkResult.usedBy === 'entity' && checkResult.entityType === 'PANEL') {
              message.error(`shortID ${values.shortId} 已被其他面板使用`);
              setLoading(false);
              return;
            }
          }
        } catch (error) {
          message.error('shortID格式无效，请使用 E-XXXXX 格式或纯数字');
          setLoading(false);
          return;
        }
      }

      const panelData: Partial<Panel> = {
        name: values.name,
        type: values.type,
        shortId: numericShortId,
        deviceId: device.id,
        size: {
          width: values.width ?? 482.6,
          height: values.height ?? 44.45,
        },
        // 背景颜色：使用用户输入的值，如果为空则使用默认白色
        backgroundColor: values.backgroundColor || '#FFFFFF',
        // 如果使用模板，设置模板ID，否则清除模板
        templateId: values.useTemplate ? values.templateId : undefined,
        isCustomized: values.useTemplate ? false : true,
      };

      await onSave(panelData);

      // 如果有面板ID且有端口数据，保存端口信息
      if (panel?.id && ports.length > 0) {
        console.log('Saving ports:', ports.length, 'ports');
        try {
          // 批量更新端口位置信息
          await Promise.all(
            ports.map((port) => {
              if (port.id) {
                return portService.update(port.id, {
                  position: port.position,
                  size: port.size,
                  portType: port.portType,
                  label: port.label,
                  rotation: port.rotation || 0, // 保存旋转角度
                } as any);
              }
              return Promise.resolve();
            })
          );
          message.success('端口位置已保存');
        } catch (error) {
          console.error('Failed to save port positions:', error);
          message.warning('端口位置保存失败');
        }
      } else {
        console.log('Not saving ports - panel?.id:', panel?.id, 'ports.length:', ports.length);
      }

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

  const getPanelTypeLabel = (type: PanelType) => {
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

  const getDeviceTypeLabel = (type: DeviceType) => {
    switch (type) {
      case DeviceType.SERVER:
        return '服务器';
      case DeviceType.SWITCH:
        return '交换机';
      case DeviceType.ROUTER:
        return '路由器';
      case DeviceType.FIREWALL:
        return '防火墙';
      case DeviceType.STORAGE:
        return '存储设备';
      case DeviceType.PDU:
        return 'PDU';
      case DeviceType.OTHER:
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
      width={isEditMode ? 1200 : 800}
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
      <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        {/* 设备和面板信息 */}
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={2} size="small">
            <Descriptions.Item label="设备名称">{device.name}</Descriptions.Item>
            <Descriptions.Item label="设备类型">{getDeviceTypeLabel(device.type)}</Descriptions.Item>
            <Descriptions.Item label="型号">{device.model || '-'}</Descriptions.Item>
            <Descriptions.Item label="U位">
              U{device.uPosition} (高{device.uHeight}U)
            </Descriptions.Item>
            {panel && panel.shortId && (
              <Descriptions.Item label="面板 shortID">
                <Text code>{ShortIdFormatter.toDisplayFormat(panel.shortId)}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {/* 可视化编辑器 - 放在顶部 */}
        {isEditMode && panel && (
          <>
            <Alert
              message="可视化编辑模式"
              description="您现在可以在画布上编辑端口位置。拖动端口可调整位置，点击端口可选中。"
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <PanelCanvasEditor
              width={form.getFieldValue('width') || 482.6}
              height={form.getFieldValue('height') || 44.45}
              backgroundColor={form.getFieldValue('backgroundColor') || '#FFFFFF'}
              initialPorts={ports}
              onPortsChange={setPorts}
              readOnly={false}
            />
            <Divider />
          </>
        )}

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
                name="shortId"
                label={
                  <Space>
                    <span>面板 shortID</span>
                    <Tooltip title="用于快速识别和扫码，支持格式：E-00001 或 1">
                      <InfoCircleOutlined />
                    </Tooltip>
                  </Space>
                }
              >
                <Input placeholder="E-00001 或 1（可选）" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="backgroundColor"
                label="背景颜色"
                initialValue="#FFFFFF"
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
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="height"
                label={`高度 (mm) - 设备: ${device.uHeight || 1}U`}
                rules={[
                  { required: true, message: '请输入高度' },
                  { type: 'number', min: 1, message: '高度必须大于0' }
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={`${(device.uHeight || 1) * 44.45}`}
                  step={0.1}
                />
              </Form.Item>
            </Col>
          </Row>

          <Alert
            message="尺寸说明"
            description={
              <div>
                <p>• 宽度: 标准19英寸机架宽度为 482.6mm</p>
                <p>• 高度: 根据设备U数自动计算 (1U = 44.45mm)</p>
                <p>• 当前设备: {device.uHeight || 1}U = {(device.uHeight || 1) * 44.45}mm</p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

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
                        ({template.portCount}口, {getPanelTypeLabel(template.type)})
                      </span>
                    </Space>
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}

          {selectedTemplate && (
            <>
              <Alert
                message="模板信息"
                description={
                  <div>
                    <p>模板: {selectedTemplate.name}</p>
                    <p>端口数量: {selectedTemplate.portCount}</p>
                    <p>模板类型: {getPanelTypeLabel(selectedTemplate.type)}</p>
                    <p>描述: {selectedTemplate.description || '无'}</p>
                  </div>
                }
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />

              {/* 模板预览 */}
              <Card title="模板预览" size="small" style={{ marginBottom: 16 }}>
                <PanelCanvasEditor
                  width={selectedTemplate.width || 482.6}
                  height={selectedTemplate.height || 44.45}
                  backgroundColor={selectedTemplate.backgroundColor || '#FFFFFF'}
                  initialPorts={
                    selectedTemplate.portDefinitions?.map((portDef) => ({
                      id: `preview-${portDef.number}`,
                      number: portDef.number,
                      portType: portDef.portType || 'RJ45',
                      position: portDef.position || { x: 0, y: 0 },
                      size: portDef.size || { width: 15, height: 12 },
                      label: portDef.label,
                      rotation: 0,
                    })) || []
                  }
                  onPortsChange={() => {}}
                  readOnly={true}
                />
              </Card>
            </>
          )}

          {/* 尺寸预览 */}
          {!isEditMode && previewSize && (
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