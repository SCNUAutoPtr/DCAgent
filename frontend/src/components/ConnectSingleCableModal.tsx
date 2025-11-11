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
  CheckCircleOutlined,
  InfoCircleOutlined,
  ScanOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { panelService } from '@/services/panelService';
import { portService } from '@/services/portService';
import { cableService } from '@/services/cableService';
import { deviceService } from '@/services/deviceService';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import { parseShortId, formatShortId } from '@/utils/shortIdFormatter';
import type { Panel, Port, Device } from '@/types';

const { Option } = Select;
const { TextArea } = Input;

interface ConnectSingleCableModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPanelId?: string;
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

export default function ConnectSingleCableModal({
  visible,
  onClose,
  onSuccess,
  initialPanelId,
}: ConnectSingleCableModalProps) {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // 数据状态
  const [panels, setPanels] = useState<Panel[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
  const [ports, setPorts] = useState<Port[]>([]);

  // 选择状态
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [selectedPort, setSelectedPort] = useState<Port | null>(null);
  const [scanInput, setScanInput] = useState('');
  const [shortIdInput, setShortIdInput] = useState('');

  // 线缆信息
  const [existingCable, setExistingCable] = useState<any>(null);
  const [peerInfo, setPeerInfo] = useState<any>(null);

  useEffect(() => {
    if (visible) {
      loadPanels();
      resetForm();
    }
  }, [visible]);

  useEffect(() => {
    if (initialPanelId && panels.length > 0) {
      handlePanelChange(initialPanelId);
    }
  }, [initialPanelId, panels]);

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setSelectedPanel(null);
    setSelectedPort(null);
    setPorts([]);
    setScanInput('');
    setShortIdInput('');
    setExistingCable(null);
    setPeerInfo(null);
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

  const handlePanelChange = async (panelId: string) => {
    const panel = panels.find((p) => p.id === panelId);
    setSelectedPanel(panel || null);
    setSelectedPort(null);

    if (panelId) {
      try {
        const portsData = await portService.getByPanel(panelId);
        setPorts(portsData);

        const availablePorts = portsData.filter((p) => p.status === 'AVAILABLE');
        if (availablePorts.length === 0) {
          message.warning('该面板没有可用端口');
        }
      } catch (error) {
        console.error('Failed to load ports:', error);
        message.error('加载端口列表失败');
      }
    } else {
      setPorts([]);
    }
  };

  const handlePortClick = (port: Port) => {
    if (port.status !== 'AVAILABLE') {
      message.warning(`端口 ${port.number} 状态为 ${port.status}，无法选择`);
      return;
    }
    setSelectedPort(port);
  };

  // 处理扫码输入（面板）
  const handleScanInput = async (value: string) => {
    if (!value.trim()) return;

    try {
      const shortId = parseShortId(value.trim());
      const panel = await panelService.getByShortId(shortId);
      if (panel) {
        message.success(`已加载面板：${panel.name}`);
        await handlePanelChange(panel.id);
      }
    } catch (error: any) {
      console.error('Failed to load panel by shortId:', error);
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
      } else {
        message.error('未找到该ID对应的面板');
      }
    }
  };

  // 处理插头ShortID输入
  const handleShortIdInput = async (value: string) => {
    if (!value.trim()) {
      setExistingCable(null);
      setPeerInfo(null);
      return;
    }

    try {
      const shortId = parseShortId(value.trim());
      const result = await cableService.getCableEndpointsByShortId(shortId);

      if (result && result.cable) {
        // 找到了已存在的线缆
        message.success('找到已存在线缆');
        setExistingCable(result);

        // 确定另一端
        const isCurrentA = result.endpointA?.shortId === shortId;
        const otherEndpoint = isCurrentA ? result.endpointB : result.endpointA;

        // 设置对端信息
        if (otherEndpoint?.port) {
          setPeerInfo({
            port: otherEndpoint.port,
            panel: otherEndpoint.port.panel,
            device: otherEndpoint.port.panel?.device,
            cabinet: otherEndpoint.port.panel?.device?.cabinet,
          });
        } else {
          setPeerInfo(null);
        }

        // 填充线缆信息
        form.setFieldsValue({
          shortId: shortId,
          label: result.cable.label || '',
          type: result.cable.type,
          length: result.cable.length,
          color: result.cable.color || '',
          notes: result.cable.notes || '',
        });
      } else {
        // shortID未被使用，新建线缆
        setExistingCable(null);
        setPeerInfo(null);
        form.setFieldValue('shortId', shortId);
      }
    } catch (error: any) {
      console.error('Failed to check shortId:', error);
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
      } else {
        // 404错误说明shortID未被使用
        setExistingCable(null);
        setPeerInfo(null);
        try {
          const shortId = parseShortId(value.trim());
          form.setFieldValue('shortId', shortId);
        } catch (e) {
          // ignore
        }
      }
    }
  };

  const handleStepNext = async () => {
    if (currentStep === 0) {
      // 验证第一步：选择端口
      if (!selectedPanel || !selectedPort) {
        message.warning('请先选择面板和端口');
        return;
      }
      console.log('[Step 0->1] Selected port:', selectedPort.id);
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // 验证第二步：输入线缆信息
      try {
        // 如果 shortIdInput 有值但还没处理，先处理它
        if (shortIdInput && !form.getFieldValue('shortId')) {
          console.log('[Step 1] Processing shortIdInput:', shortIdInput);
          await handleShortIdInput(shortIdInput);
        }

        console.log('[Step 1] Before validation, current form values:', form.getFieldsValue());
        const values = await form.validateFields();
        console.log('[Step 1] Validation passed, values:', values);

        // 确保 shortId 是数字
        if (typeof values.shortId !== 'number') {
          message.error('shortID 格式不正确，请重新输入');
          return;
        }

        console.log('[Step 1->2] Moving to step 2, form still has values:', form.getFieldsValue());
        setCurrentStep(2);

        // 在下一个渲染周期检查表单值
        setTimeout(() => {
          console.log('[Step 2] After render, form values:', form.getFieldsValue());
        }, 100);
      } catch (error) {
        console.error('Form validation failed:', error);
        message.error('请完整填写线缆信息');
      }
    }
  };

  const handleStepPrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!selectedPort) {
      message.error('请选择端口');
      return;
    }

    try {
      setLoading(true);
      // 直接获取表单值，不再验证（验证已在步骤2完成）
      const values = form.getFieldsValue();

      console.log('Form values:', values);
      console.log('shortId type:', typeof values.shortId, values.shortId);

      // 确保shortId存在
      if (!values.shortId) {
        message.error('shortID不能为空');
        setLoading(false);
        return;
      }

      const data = {
        portId: selectedPort.id,
        shortId: values.shortId,
        label: values.label,
        type: values.type,
        length: values.length,
        color: values.color,
        notes: values.notes,
      };

      console.log('Request data:', data);

      const result = await cableService.connectSinglePort(data);
      message.success('线缆连接成功');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to connect cable:', error);
      console.error('Error details:', error.response?.data);
      message.error(error.response?.data?.error || '连接失败');
    } finally {
      setLoading(false);
    }
  };

  const renderSelectPort = () => {
    const device = selectedPanel?.deviceId
      ? devicesMap.get(selectedPanel.deviceId)
      : null;

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="选择要连接的端口"
          description="先扫描或选择面板，然后在面板上点击要连接的端口"
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />

        <Card title="1. 选择面板" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input
              prefix={<ScanOutlined />}
              placeholder="扫描面板ID（如：E-00001）或直接输入数字"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onPressEnter={(e) => handleScanInput(e.currentTarget.value)}
              onBlur={(e) => handleScanInput(e.target.value)}
              allowClear
            />
            <Select
              showSearch
              placeholder="或者选择面板"
              value={selectedPanel?.id}
              onChange={handlePanelChange}
              style={{ width: '100%' }}
              filterOption={(input, option) =>
                (option?.children as string)
                  ?.toLowerCase()
                  .includes(input.toLowerCase()) ?? false
              }
            >
              {panels.map((panel) => (
                <Option key={panel.id} value={panel.id}>
                  {panel.name} {panel.shortId ? `(${formatShortId(panel.shortId)})` : ''}
                </Option>
              ))}
            </Select>
          </Space>
        </Card>

        {selectedPanel && (
          <Card
            title={`2. 选择端口 - ${selectedPanel.name}`}
            size="small"
            extra={
              device && (
                <span style={{ fontSize: '12px', color: '#666' }}>
                  设备：{device.name}
                </span>
              )
            }
          >
            {ports.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <PanelVisualizer
                  panel={selectedPanel}
                  ports={ports}
                  labelMode="hover"
                  onPortClick={handlePortClick}
                  selectedPorts={selectedPort ? [selectedPort.id] : []}
                  highlightAvailable={true}
                />
                {selectedPort && (
                  <Alert
                    message={`已选择端口：${selectedPort.number}`}
                    type="success"
                    showIcon
                  />
                )}
              </Space>
            ) : (
              <Empty description="该面板没有端口" />
            )}
          </Card>
        )}
      </Space>
    );
  };

  const renderCableInfo = () => {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Alert
          message="输入线缆信息"
          description="扫描或输入插头的ShortID，如果插头已经属于某条线缆，会自动填充线缆信息"
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />

        <Form.Item
          label="插头 ShortID"
          name="shortId"
          rules={[{ required: true, message: '请输入插头ShortID' }]}
        >
          <Input
            prefix={<ScanOutlined />}
            placeholder="扫描插头ID（如：E-00001）或直接输入数字"
            onPressEnter={(e) => {
              const value = e.currentTarget.value;
              setShortIdInput(value);
              handleShortIdInput(value);
            }}
            onBlur={(e) => {
              const value = e.target.value;
              setShortIdInput(value);
              handleShortIdInput(value);
            }}
          />
        </Form.Item>

        {existingCable && (
          <Alert
            message="找到已存在线缆"
            description={`线缆类型：${existingCable.cable.type}，将更新该线缆连接到选定的端口`}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {peerInfo && (
          <Card title="对端信息" size="small" style={{ marginBottom: 16 }}>
            <Descriptions column={1} size="small">
              {peerInfo.cabinet && (
                <Descriptions.Item label="机柜">
                  {peerInfo.cabinet.name}
                </Descriptions.Item>
              )}
              {peerInfo.device && (
                <Descriptions.Item label="设备">
                  {peerInfo.device.name}
                </Descriptions.Item>
              )}
              {peerInfo.panel && (
                <Descriptions.Item label="面板">
                  {peerInfo.panel.name}
                </Descriptions.Item>
              )}
              {peerInfo.port && (
                <Descriptions.Item label="端口">
                  {peerInfo.port.number}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        <Form.Item label="线缆标签" name="label">
          <Input placeholder="选填，如：Core-1" />
        </Form.Item>

        <Form.Item label="线缆类型" name="type">
          <Select
            placeholder="选填，默认根据端口类型推断"
            allowClear
          >
            {cableTypeOptions.map((opt) => (
              <Option key={opt.value} value={opt.value}>
                <Tag color={opt.color}>{opt.label}</Tag>
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="长度（米）" name="length">
              <InputNumber
                min={0}
                step={0.1}
                placeholder="选填"
                style={{ width: '100%' }}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="颜色" name="color">
              <Input placeholder="选填，如：蓝色" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="备注" name="notes">
          <TextArea rows={3} placeholder="选填" />
        </Form.Item>
      </Space>
    );
  };

  const renderConfirm = () => {
    console.log('[renderConfirm] Called, currentStep:', currentStep);
    const device = selectedPanel?.deviceId
      ? devicesMap.get(selectedPanel.deviceId)
      : null;
    const values = form.getFieldsValue();
    console.log('[renderConfirm] Form values:', values);

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 隐藏的Form.Item用于保持表单值 */}
        <div style={{ display: 'none' }}>
          <Form.Item name="shortId"><Input /></Form.Item>
          <Form.Item name="label"><Input /></Form.Item>
          <Form.Item name="type"><Input /></Form.Item>
          <Form.Item name="length"><InputNumber /></Form.Item>
          <Form.Item name="color"><Input /></Form.Item>
          <Form.Item name="notes"><TextArea /></Form.Item>
        </div>
        <Alert
          message="确认连接信息"
          description="请仔细核对连接信息，确认无误后点击提交"
          type="warning"
          icon={<WarningOutlined />}
          showIcon
        />

        <Card title="连接端口" size="small">
          <Descriptions column={1} size="small">
            {device && (
              <Descriptions.Item label="设备">{device.name}</Descriptions.Item>
            )}
            <Descriptions.Item label="面板">
              {selectedPanel?.name}
              {selectedPanel?.shortId && (
                <Tag style={{ marginLeft: 8 }}>
                  {formatShortId(selectedPanel.shortId)}
                </Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="端口">
              {selectedPort?.number}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="线缆信息" size="small">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="插头 ShortID">
              <Tag color="blue">{formatShortId(values.shortId)}</Tag>
            </Descriptions.Item>
            {values.label && (
              <Descriptions.Item label="标签">{values.label}</Descriptions.Item>
            )}
            {values.type && (
              <Descriptions.Item label="类型">
                <Tag
                  color={
                    cableTypeOptions.find((opt) => opt.value === values.type)
                      ?.color
                  }
                >
                  {
                    cableTypeOptions.find((opt) => opt.value === values.type)
                      ?.label
                  }
                </Tag>
              </Descriptions.Item>
            )}
            {values.length && (
              <Descriptions.Item label="长度">{values.length} 米</Descriptions.Item>
            )}
            {values.color && (
              <Descriptions.Item label="颜色">{values.color}</Descriptions.Item>
            )}
            {values.notes && (
              <Descriptions.Item label="备注">{values.notes}</Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        {peerInfo && (
          <Card title="对端信息" size="small">
            <Descriptions column={1} size="small">
              {peerInfo.cabinet && (
                <Descriptions.Item label="机柜">
                  {peerInfo.cabinet.name}
                </Descriptions.Item>
              )}
              {peerInfo.device && (
                <Descriptions.Item label="设备">
                  {peerInfo.device.name}
                </Descriptions.Item>
              )}
              {peerInfo.panel && (
                <Descriptions.Item label="面板">
                  {peerInfo.panel.name}
                </Descriptions.Item>
              )}
              {peerInfo.port && (
                <Descriptions.Item label="端口">
                  {peerInfo.port.number}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {existingCable && (
          <Alert
            message="更新已存在线缆"
            description="该插头已经属于一条线缆，将更新该线缆连接到选定的端口"
            type="info"
            showIcon
          />
        )}
      </Space>
    );
  };

  const steps = [
    {
      title: '选择端口',
      icon: <ApiOutlined />,
    },
    {
      title: '线缆信息',
      icon: <ScanOutlined />,
    },
    {
      title: '确认连接',
      icon: <CheckCircleOutlined />,
    },
  ];

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderSelectPort();
      case 1:
        return renderCableInfo();
      case 2:
        return renderConfirm();
      default:
        return null;
    }
  };

  return (
    <Modal
      title="单个线缆连接"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        currentStep > 0 && (
          <span key="back" onClick={handleStepPrev} style={{ marginRight: 'auto', cursor: 'pointer', color: '#1890ff' }}>
            上一步
          </span>
        ),
        <span key="cancel" onClick={onClose} style={{ marginLeft: 8, cursor: 'pointer' }}>
          取消
        </span>,
        currentStep < steps.length - 1 ? (
          <span
            key="next"
            onClick={handleStepNext}
            style={{ marginLeft: 8, cursor: 'pointer', color: '#1890ff' }}
          >
            下一步
          </span>
        ) : (
          <span
            key="submit"
            onClick={handleSubmit}
            style={{ marginLeft: 8, cursor: 'pointer', color: '#1890ff' }}
          >
            {loading ? '提交中...' : '提交'}
          </span>
        ),
      ]}
    >
      <Form form={form} layout="vertical">
        <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
        <div>{renderCurrentStep()}</div>
      </Form>
    </Modal>
  );
}
