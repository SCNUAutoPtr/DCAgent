import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Steps,
  Card,
  Descriptions,
  Space,
  Alert,
  Tag,
  Divider,
  Row,
  Col,
  Empty,
  Badge,
} from 'antd';
import {
  ApiOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { panelService } from '@/services/panelService';
import { portService } from '@/services/portService';
import { cableService } from '@/services/cableService';
import { deviceService } from '@/services/deviceService';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import type { Panel, Port, Device, CableType } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

interface CreateCableModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPanelAId?: string;
  initialPanelBId?: string;
}

// 线缆类型选项
const cableTypeOptions = [
  { value: 'CAT5E', label: 'CAT5E 网线', color: '#2db7f5' },
  { value: 'CAT6', label: 'CAT6 网线', color: '#108ee9' },
  { value: 'CAT6A', label: 'CAT6A 网线', color: '#0050b3' },
  { value: 'CAT7', label: 'CAT7 网线', color: '#003a8c' },
  { value: 'FIBER_SM', label: '单模光纤', color: '#f50' },
  { value: 'FIBER_MM', label: '多模光纤', color: '#fa541c' },
  { value: 'QSFP_TO_SFP', label: 'QSFP转SFP', color: '#722ed1' },
  { value: 'QSFP_TO_QSFP', label: 'QSFP直连', color: '#531dab' },
  { value: 'SFP_TO_SFP', label: 'SFP直连', color: '#9254de' },
  { value: 'POWER', label: '电源线', color: '#faad14' },
  { value: 'OTHER', label: '其他', color: '#8c8c8c' },
];

export default function CreateCableModal({
  visible,
  onClose,
  onSuccess,
  initialPanelAId,
  initialPanelBId,
}: CreateCableModalProps) {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // 数据状态
  const [panels, setPanels] = useState<Panel[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
  const [portsA, setPortsA] = useState<Port[]>([]);
  const [portsB, setPortsB] = useState<Port[]>([]);

  // 选择状态
  const [selectedPanelA, setSelectedPanelA] = useState<Panel | null>(null);
  const [selectedPanelB, setSelectedPanelB] = useState<Panel | null>(null);
  const [selectedPortA, setSelectedPortA] = useState<Port | null>(null);
  const [selectedPortB, setSelectedPortB] = useState<Port | null>(null);
  const [scanInputA, setScanInputA] = useState('');
  const [scanInputB, setScanInputB] = useState('');

  useEffect(() => {
    if (visible) {
      loadPanels();
      resetForm();
    }
  }, [visible]);

  useEffect(() => {
    if (initialPanelAId && panels.length > 0) {
      handlePanelAChange(initialPanelAId);
    }
  }, [initialPanelAId, panels]);

  useEffect(() => {
    if (initialPanelBId && panels.length > 0) {
      handlePanelBChange(initialPanelBId);
    }
  }, [initialPanelBId, panels]);

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setSelectedPanelA(null);
    setSelectedPanelB(null);
    setSelectedPortA(null);
    setSelectedPortB(null);
    setPortsA([]);
    setPortsB([]);
    setScanInputA('');
    setScanInputB('');
  };

  const loadPanels = async () => {
    try {
      const data = await panelService.getAll();
      setPanels(data);

      // 预加载所有设备信息
      const deviceIds = [...new Set(data.map((p) => p.deviceId).filter(Boolean))];
      const devicesData = await Promise.all(
        deviceIds.map((id) => deviceService.getById(id!))
      );
      const devMap = new Map<string, Device>();
      devicesData.forEach((dev) => {
        if (dev) devMap.set(dev.id, dev);
      });
      setDevicesMap(devMap);
    } catch (error) {
      console.error('Failed to load panels:', error);
      message.error('加载面板列表失败');
    }
  };

  const handlePanelAChange = async (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId);
    setSelectedPanelA(panel || null);
    setSelectedPortA(null);

    if (panelId) {
      try {
        const ports = await portService.getByPanel(panelId);
        setPortsA(ports);

        const availablePorts = ports.filter((p) => p.status === 'AVAILABLE');
        if (availablePorts.length === 0) {
          message.warning('该面板没有可用端口');
        }
      } catch (error) {
        console.error('Failed to load ports:', error);
        message.error('加载端口列表失败');
      }
    } else {
      setPortsA([]);
    }
  };

  const handlePanelBChange = async (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId);
    setSelectedPanelB(panel || null);
    setSelectedPortB(null);

    if (panelId) {
      try {
        const ports = await portService.getByPanel(panelId);
        setPortsB(ports);

        const availablePorts = ports.filter((p) => p.status === 'AVAILABLE');
        if (availablePorts.length === 0) {
          message.warning('该面板没有可用端口');
        }
      } catch (error) {
        console.error('Failed to load ports:', error);
        message.error('加载端口列表失败');
      }
    } else {
      setPortsB([]);
    }
  };

  const handlePortAClick = (port: Port) => {
    if (port.status !== 'AVAILABLE') {
      message.warning(`端口 ${port.number} 状态为 ${port.status}，无法选择`);
      return;
    }
    setSelectedPortA(port);
  };

  const handlePortBClick = (port: Port) => {
    if (port.status !== 'AVAILABLE') {
      message.warning(`端口 ${port.number} 状态为 ${port.status}，无法选择`);
      return;
    }
    setSelectedPortB(port);
  };

  // 处理扫码输入（面板A）
  const handleScanInputA = async (value: string) => {
    setScanInputA(value);
    if (!value.trim()) return;

    const shortId = parseInt(value.trim(), 10);
    if (isNaN(shortId)) {
      message.error('请输入有效的数字ID');
      return;
    }

    try {
      const panel = await panelService.getByShortId(shortId);
      if (panel) {
        message.success(`已加载面板：${panel.name}`);
        await handlePanelAChange(panel.id);
      }
    } catch (error) {
      console.error('Failed to load panel by shortId:', error);
      message.error('未找到该ID对应的面板');
    }
  };

  // 处理扫码输入（面板B）
  const handleScanInputB = async (value: string) => {
    setScanInputB(value);
    if (!value.trim()) return;

    const shortId = parseInt(value.trim(), 10);
    if (isNaN(shortId)) {
      message.error('请输入有效的数字ID');
      return;
    }

    try {
      const panel = await panelService.getByShortId(shortId);
      if (panel) {
        message.success(`已加载面板：${panel.name}`);
        await handlePanelBChange(panel.id);
      }
    } catch (error) {
      console.error('Failed to load panel by shortId:', error);
      message.error('未找到该ID对应的面板');
    }
  };

  const handleNext = async () => {
    if (!selectedPortA || !selectedPortB) {
      message.error('请在两个面板上各选择一个端口');
      return;
    }
    setCurrentStep(1);
  };

  const handlePrev = () => {
    setCurrentStep(0);
  };

  const handleSubmit = async () => {
    try {
      if (!selectedPortA || !selectedPortB) {
        message.error('请选择两个端口');
        return;
      }

      await form.validateFields();
      const values = form.getFieldsValue();

      setLoading(true);

      await cableService.create({
        label: values.label,
        type: values.type,
        length: values.length,
        color: values.color,
        notes: values.notes,
        portAId: selectedPortA.id,
        portBId: selectedPortB.id,
      });

      message.success('线缆连接创建成功！');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to create cable:', error);
      message.error(error.response?.data?.error || '创建线缆连接失败');
    } finally {
      setLoading(false);
    }
  };

  const renderPanelSelector = (
    title: string,
    selectedPanel: Panel | null,
    ports: Port[],
    selectedPort: Port | null,
    onPanelChange: (panelId: string) => void,
    onPortClick: (port: Port) => void,
    sideLabel: string
  ) => {
    const device = selectedPanel?.deviceId
      ? devicesMap.get(selectedPanel.deviceId)
      : null;

    return (
      <Card
        title={
          <Space>
            <Badge status={selectedPort ? 'success' : 'default'} />
            {title}
          </Space>
        }
        style={{ height: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Input
            prefix={<ScanOutlined />}
            placeholder="扫描面板二维码或输入ID"
            value={sideLabel === '面板A' ? scanInputA : scanInputB}
            onChange={(e) =>
              sideLabel === '面板A'
                ? handleScanInputA(e.target.value)
                : handleScanInputB(e.target.value)
            }
            onPressEnter={(e) =>
              sideLabel === '面板A'
                ? handleScanInputA((e.target as HTMLInputElement).value)
                : handleScanInputB((e.target as HTMLInputElement).value)
            }
            size="large"
            allowClear
          />

          <Divider plain>或</Divider>

          <Select
            showSearch
            style={{ width: '100%' }}
            placeholder={`选择${sideLabel}`}
            value={selectedPanel?.id}
            onChange={onPanelChange}
            filterOption={(input, option) => {
              const label = option?.label;
              if (typeof label === 'string') {
                return label.toLowerCase().includes(input.toLowerCase());
              }
              return false;
            }}
          >
            {panels.map((panel) => {
              const dev = panel.deviceId ? devicesMap.get(panel.deviceId) : null;
              return (
                <Option key={panel.id} value={panel.id} label={panel.name}>
                  {panel.name} ({panel.type})
                  {dev && ` - ${dev.name}`}
                </Option>
              );
            })}
          </Select>

          {selectedPanel && device && (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="面板">{selectedPanel.name}</Descriptions.Item>
              <Descriptions.Item label="类型">{selectedPanel.type}</Descriptions.Item>
              <Descriptions.Item label="设备">{device.name}</Descriptions.Item>
              <Descriptions.Item label="设备类型">
                <Tag color="blue">{device.type}</Tag>
              </Descriptions.Item>
            </Descriptions>
          )}

          {selectedPanel && ports.length > 0 && (
            <div>
              <Alert
                message="请在面板上点击一个可用端口（绿色）"
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
              />
              <div
                style={{
                  border: '1px solid #d9d9d9',
                  borderRadius: '4px',
                  padding: '16px',
                  background: '#fafafa',
                  maxHeight: '400px',
                  overflow: 'auto',
                }}
              >
                <PanelVisualizer
                  panel={selectedPanel}
                  ports={ports}
                  onPortClick={onPortClick}
                  scale={0.8}
                  labelMode="always"
                  showPortNumber={true}
                  allowEdit={false}
                />
              </div>
            </div>
          )}

          {selectedPanel && ports.length === 0 && (
            <Empty description="该面板暂无端口" />
          )}

          {selectedPort && (
            <Card
              size="small"
              title="已选择端口"
              style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>端口编号：</strong>
                  {selectedPort.number}
                </div>
                {selectedPort.label && (
                  <div>
                    <strong>标签：</strong>
                    {selectedPort.label}
                  </div>
                )}
                <div>
                  <strong>端口类型：</strong>
                  <Tag>{selectedPort.portType || '未设置'}</Tag>
                </div>
                <div>
                  <strong>状态：</strong>
                  <Tag color="green">可用</Tag>
                </div>
              </Space>
            </Card>
          )}
        </Space>
      </Card>
    );
  };

  const steps = [
    {
      title: '选择端口',
      icon: <ApiOutlined />,
    },
    {
      title: '线缆信息',
      icon: <SwapOutlined />,
    },
  ];

  return (
    <Modal
      title="创建线缆连接"
      open={visible}
      onCancel={currentStep === 0 ? onClose : handlePrev}
      width={1200}
      okText={currentStep === 0 ? '下一步' : '创建连接'}
      cancelText={currentStep === 0 ? '取消' : '上一步'}
      onOk={currentStep === 0 ? handleNext : handleSubmit}
      confirmLoading={loading}
      style={{ top: 20 }}
    >
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />

      {currentStep === 0 && (
        <div>
          <Alert
            message="可视化选择端口"
            description="先选择面板，然后在面板可视化图上点击可用的端口（绿色）。需要选择两个端口才能继续。"
            type="info"
            showIcon
            icon={<InfoCircleOutlined />}
            style={{ marginBottom: 16 }}
          />

          <Row gutter={16}>
            <Col span={12}>
              {renderPanelSelector(
                '端口A（起点）',
                selectedPanelA,
                portsA,
                selectedPortA,
                handlePanelAChange,
                handlePortAClick,
                '面板A'
              )}
            </Col>
            <Col span={12}>
              {renderPanelSelector(
                '端口B（终点）',
                selectedPanelB,
                portsB,
                selectedPortB,
                handlePanelBChange,
                handlePortBClick,
                '面板B'
              )}
            </Col>
          </Row>
        </div>
      )}

      {currentStep === 1 && (
        <Form form={form} layout="vertical">
          <Alert
            message="连接预览"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            style={{ marginBottom: 16 }}
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>端口A：</strong>
                  {selectedPanelA?.name} - {selectedPortA?.number}{' '}
                  {selectedPortA?.label && `(${selectedPortA.label})`} -{' '}
                  {selectedPortA?.portType || '未设置类型'}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <SwapOutlined style={{ fontSize: 24, color: '#52c41a' }} />
                </div>
                <div>
                  <strong>端口B：</strong>
                  {selectedPanelB?.name} - {selectedPortB?.number}{' '}
                  {selectedPortB?.label && `(${selectedPortB.label})`} -{' '}
                  {selectedPortB?.portType || '未设置类型'}
                </div>
              </Space>
            }
          />

          <Form.Item label="线缆标签" name="label">
            <Input placeholder="例如：服务器1-交换机1" />
          </Form.Item>

          <Form.Item
            label="线缆类型"
            name="type"
            rules={[{ required: true, message: '请选择线缆类型' }]}
            initialValue="CAT6"
          >
            <Select placeholder="选择线缆类型">
              {cableTypeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  <Tag color={opt.color}>{opt.label}</Tag>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="线缆长度（米）" name="length">
            <InputNumber
              min={0.1}
              max={1000}
              step={0.5}
              style={{ width: '100%' }}
              placeholder="例如：3.5"
            />
          </Form.Item>

          <Form.Item label="线缆颜色" name="color">
            <Input placeholder="例如：蓝色、红色" />
          </Form.Item>

          <Form.Item label="备注" name="notes">
            <TextArea rows={3} placeholder="其他说明信息" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}
