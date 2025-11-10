import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Card,
  Descriptions,
  Space,
  Alert,
  Tag,
  Row,
  Col,
  Button,
  Divider,
  Typography,
  Tabs,
} from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  ThunderboltOutlined,
  ApiOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { cableService } from '@/services/cableService';
import { portService } from '@/services/portService';
import { panelService } from '@/services/panelService';
import { parseShortId, formatShortId } from '@/utils/shortIdFormatter';
import type { Panel, Port } from '@/types';
import { PanelVisualizer } from './PanelVisualizer';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

interface CreateCableModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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
}: CreateCableModalProps) {
  const [form] = Form.useForm();
  const [dualForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState<string>('single');
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 单端连接状态（快速连接：只连接一边）
  const [singlePanel, setSinglePanel] = useState<string>('');
  const [singlePanelData, setSinglePanelData] = useState<Panel | null>(null);
  const [singlePanelInput, setSinglePanelInput] = useState('');
  const [singlePort, setSinglePort] = useState<string>('');
  const [singlePorts, setSinglePorts] = useState<Port[]>([]);
  const [shortId, setShortId] = useState<number | null>(null);
  const [shortIdInput, setShortIdInput] = useState('');
  const [loadingShortId, setLoadingShortId] = useState(false);

  // 双端连接状态
  const [panels, setPanels] = useState<Panel[]>([]);
  const [portsA, setPortsA] = useState<Port[]>([]);
  const [portsB, setPortsB] = useState<Port[]>([]);
  const [selectedPanelA, setSelectedPanelA] = useState<string>('');
  const [selectedPanelB, setSelectedPanelB] = useState<string>('');
  const [selectedPortA, setSelectedPortA] = useState<string>('');
  const [selectedPortB, setSelectedPortB] = useState<string>('');
  const [shortIdInputA, setShortIdInputA] = useState('');
  const [shortIdInputB, setShortIdInputB] = useState('');

  useEffect(() => {
    if (visible) {
      resetForm();
      loadPanels();
    }
  }, [visible]);

  const resetForm = () => {
    form.resetFields();
    dualForm.resetFields();
    setActiveTab('single');
    setSinglePanel('');
    setSinglePanelData(null);
    setSinglePanelInput('');
    setSinglePort('');
    setSinglePorts([]);
    setShortId(null);
    setShortIdInput('');
    setLoadingShortId(false);
    setShowAdvanced(false);
    setSelectedPanelA('');
    setSelectedPanelB('');
    setSelectedPortA('');
    setSelectedPortB('');
    setShortIdInputA('');
    setShortIdInputB('');
    setPortsA([]);
    setPortsB([]);
  };

  const loadPanels = async () => {
    try {
      const data = await panelService.getAll();
      setPanels(data);
    } catch (error) {
      console.error('Failed to load panels:', error);
    }
  };

  // ==================== 单端连接逻辑（快速连接：只连接一个端口）====================
  const handleSinglePanelInput = async (value: string) => {
    if (!value.trim()) {
      setSinglePanel('');
      setSinglePanelData(null);
      setSinglePort('');
      setSinglePorts([]);
      return;
    }

    try {
      const parsedShortId = parseShortId(value.trim());
      const panel = panels.find((p) => p.shortId === parsedShortId);

      if (panel) {
        setSinglePanel(panel.id);
        setSinglePanelData(panel);
        setSinglePort('');
        const ports = await portService.getByPanel(panel.id);
        setSinglePorts(ports);
        message.success(`已选择面板: ${panel.name}`);
      } else {
        message.error('未找到该面板');
        setSinglePanel('');
        setSinglePanelData(null);
        setSinglePorts([]);
      }
    } catch (error: any) {
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
      }
      setSinglePanel('');
      setSinglePanelData(null);
      setSinglePorts([]);
    }
  };

  const handleSinglePanelChange = async (panelId: string) => {
    setSinglePanel(panelId);
    const panel = panels.find((p) => p.id === panelId);
    setSinglePanelData(panel || null);
    setSinglePort('');
    setSinglePorts([]);

    if (panelId) {
      try {
        const ports = await portService.getByPanel(panelId);
        setSinglePorts(ports);
      } catch (error) {
        console.error('Failed to load ports:', error);
      }
    }
  };

  const handleShortIdInput = async (value: string) => {
    if (!value.trim()) return;

    try {
      setLoadingShortId(true);
      const parsedShortId = parseShortId(value.trim());
      setShortId(parsedShortId);
      message.success('插头录入成功');
    } catch (error: any) {
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
        setShortId(null);
      }
    } finally {
      setLoadingShortId(false);
    }
  };

  const handleSingleSubmit = async () => {
    if (!singlePort) {
      message.error('请选择端口');
      return;
    }

    if (!shortId) {
      message.error('请扫描插头ShortID');
      return;
    }

    try {
      setLoading(true);
      const values = form.getFieldsValue();

      await cableService.connectSinglePort({
        portId: singlePort,
        shortId: shortId,
        label: values.label,
        type: values.type,
        length: values.length,
        color: values.color,
        notes: values.notes,
      });

      message.success('端口连接成功');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to connect port:', error);
      message.error(error.response?.data?.error || '端口连接失败');
    } finally {
      setLoading(false);
    }
  };

  // ==================== 双端连接逻辑 ====================
  const handlePanelAChange = async (panelId: string) => {
    setSelectedPanelA(panelId);
    setSelectedPortA('');
    setPortsA([]);

    if (panelId) {
      try {
        const ports = await portService.getByPanel(panelId);
        setPortsA(ports.filter((p: Port) => p.status === 'AVAILABLE'));
      } catch (error) {
        console.error('Failed to load ports:', error);
      }
    }
  };

  const handlePanelBChange = async (panelId: string) => {
    setSelectedPanelB(panelId);
    setSelectedPortB('');
    setPortsB([]);

    if (panelId) {
      try {
        const ports = await portService.getByPanel(panelId);
        setPortsB(ports.filter((p: Port) => p.status === 'AVAILABLE'));
      } catch (error) {
        console.error('Failed to load ports:', error);
      }
    }
  };

  const handleDualSubmit = async () => {
    if (!selectedPortA || !selectedPortB) {
      message.error('请选择两个端口');
      return;
    }

    if (!shortIdInputA || !shortIdInputB) {
      message.error('请输入两个插头的ShortID');
      return;
    }

    try {
      const shortIdAVal = parseShortId(shortIdInputA);
      const shortIdBVal = parseShortId(shortIdInputB);

      if (shortIdAVal === shortIdBVal) {
        message.error('两个插头的ShortID不能相同');
        return;
      }

      setLoading(true);
      const values = dualForm.getFieldsValue();

      await cableService.create({
        portAId: selectedPortA,
        portBId: selectedPortB,
        shortIdA: shortIdAVal,
        shortIdB: shortIdBVal,
        label: values.label,
        type: values.type || 'CAT6',
        length: values.length,
        color: values.color,
        notes: values.notes,
      });

      message.success('线缆连接创建成功');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to create cable:', error);
      message.error(error.response?.data?.error || '创建线缆连接失败');
    } finally {
      setLoading(false);
    }
  };

  const canSubmitSingle = singlePort !== '' && shortId !== null;
  const canSubmitDual = selectedPortA && selectedPortB && shortIdInputA && shortIdInputB;

  const renderSingleMode = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Alert
        message="快速连接模式"
        description="扫描面板ShortID，可视化选择端口，然后扫描插头标签来快速建立单端连接。"
        type="info"
        showIcon
        icon={<ThunderboltOutlined />}
      />

      <Row gutter={16}>
        {/* 左侧：输入区域 */}
        <Col span={10}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" title="步骤 1: 扫描面板">
              <Form.Item label="面板 ShortID" required style={{ marginBottom: 8 }}>
                <Input
                  prefix={<ScanOutlined />}
                  placeholder="扫描或输入 ShortID"
                  value={singlePanelInput}
                  onChange={(e) => setSinglePanelInput(e.target.value)}
                  onPressEnter={(e) => handleSinglePanelInput((e.target as HTMLInputElement).value)}
                  onBlur={(e) => handleSinglePanelInput(e.target.value)}
                  size="large"
                  allowClear
                />
                {singlePanelData && (
                  <div style={{ marginTop: 8 }}>
                    <Tag color="blue">
                      {singlePanelData.name} ({formatShortId(singlePanelData.shortId!)})
                    </Tag>
                  </div>
                )}
              </Form.Item>

              <Divider style={{ margin: '12px 0' }}>或</Divider>

              <Form.Item label="从列表选择" style={{ marginBottom: 0 }}>
                <Select
                  placeholder="选择面板"
                  value={singlePanel}
                  onChange={handleSinglePanelChange}
                  showSearch
                  size="large"
                  filterOption={(input, option: any) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                  allowClear
                >
                  {panels.map((panel) => (
                    <Option key={panel.id} value={panel.id}>
                      {panel.name} {panel.shortId ? `(${formatShortId(panel.shortId)})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Card>

            {singlePort && (
              <Card size="small" title="步骤 3: 扫描插头">
                <Form.Item label="插头 ShortID" required style={{ marginBottom: 0 }}>
                  <Input
                    prefix={<ScanOutlined />}
                    placeholder="扫描或输入插头 ShortID"
                    value={shortIdInput}
                    onChange={(e) => setShortIdInput(e.target.value)}
                    onPressEnter={(e) => handleShortIdInput((e.target as HTMLInputElement).value)}
                    onBlur={(e) => handleShortIdInput(e.target.value)}
                    size="large"
                    allowClear
                  />
                  {shortId && (
                    <div style={{ marginTop: 8 }}>
                      <Tag color="green">已录入：{formatShortId(shortId)}</Tag>
                    </div>
                  )}
                </Form.Item>
              </Card>
            )}
          </Space>
        </Col>

        {/* 右侧：端口可视化 */}
        <Col span={14}>
          {singlePanelData && singlePorts.length > 0 ? (
            <Card size="small" title="步骤 2: 选择端口" style={{ height: '100%' }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">点击面板上的端口进行选择</Text>
                {singlePort && (
                  <Tag color="green" style={{ marginLeft: 8 }}>
                    已选择: {singlePorts.find(p => p.id === singlePort)?.number}
                  </Tag>
                )}
              </div>
              <div style={{
                border: '1px solid #d9d9d9',
                borderRadius: '4px',
                padding: '20px',
                backgroundColor: '#fafafa',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '300px'
              }}>
                <PanelVisualizer
                  panel={singlePanelData}
                  ports={singlePorts}
                  onPortClick={(port) => {
                    if (port.status === 'AVAILABLE') {
                      setSinglePort(port.id);
                      message.success(`已选择端口: ${port.number}`);
                    } else {
                      message.warning(`端口 ${port.number} 不可用`);
                    }
                  }}
                  highlightedPortIds={singlePort ? [singlePort] : []}
                  labelMode="always"
                  scale={1.2}
                />
              </div>
            </Card>
          ) : (
            <Card size="small" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: '#8c8c8c' }}>
                <Text type="secondary">请先选择面板</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>

      {canSubmitSingle && (
        <>
          <Divider style={{ margin: '12px 0' }}>
            <Button
              type="link"
              size="small"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? '隐藏' : '显示'}线缆详细信息（可选）
            </Button>
          </Divider>

          {showAdvanced && (
            <Card size="small" title="线缆详细信息（选填）">
              <Form form={form} layout="vertical">
                <Form.Item label="线缆标签" name="label">
                  <Input placeholder="例如：服务器1-交换机1" />
                </Form.Item>

                <Form.Item label="线缆类型" name="type">
                  <Select placeholder="默认根据端口类型推断" allowClear>
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
                        placeholder="线缆长度"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item label="颜色" name="color">
                      <Input placeholder="如：蓝色、红色" />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item label="备注" name="notes">
                  <TextArea rows={2} placeholder="其他说明信息" />
                </Form.Item>
              </Form>
            </Card>
          )}
        </>
      )}
    </div>
  );

  const renderDualMode = () => (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Alert
        message="双端连接模式"
        description="选择两个端口并输入插头标签来建立完整的端到端连接。"
        type="info"
        showIcon
        icon={<SwapOutlined />}
      />

      <Form form={dualForm} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Card size="small" title="端口 A" style={{ marginBottom: 16 }}>
              <Form.Item label="选择面板" required>
                <Select
                  placeholder="选择面板"
                  value={selectedPanelA}
                  onChange={handlePanelAChange}
                  showSearch
                  filterOption={(input, option: any) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {panels.map((panel) => (
                    <Option key={panel.id} value={panel.id}>
                      {panel.name} {panel.shortId ? `(${formatShortId(panel.shortId)})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="选择端口" required>
                <Select
                  placeholder="选择端口"
                  value={selectedPortA}
                  onChange={setSelectedPortA}
                  disabled={!selectedPanelA}
                >
                  {portsA.map((port) => (
                    <Option key={port.id} value={port.id}>
                      {port.number} {port.label && `(${port.label})`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="插头 ShortID" required>
                <Input
                  prefix={<ScanOutlined />}
                  placeholder="扫描或输入 ShortID"
                  value={shortIdInputA}
                  onChange={(e) => setShortIdInputA(e.target.value)}
                />
              </Form.Item>
            </Card>
          </Col>

          <Col span={12}>
            <Card size="small" title="端口 B" style={{ marginBottom: 16 }}>
              <Form.Item label="选择面板" required>
                <Select
                  placeholder="选择面板"
                  value={selectedPanelB}
                  onChange={handlePanelBChange}
                  showSearch
                  filterOption={(input, option: any) =>
                    option?.children?.toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {panels.map((panel) => (
                    <Option key={panel.id} value={panel.id}>
                      {panel.name} {panel.shortId ? `(${formatShortId(panel.shortId)})` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="选择端口" required>
                <Select
                  placeholder="选择端口"
                  value={selectedPortB}
                  onChange={setSelectedPortB}
                  disabled={!selectedPanelB}
                >
                  {portsB.map((port) => (
                    <Option key={port.id} value={port.id}>
                      {port.number} {port.label && `(${port.label})`}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item label="插头 ShortID" required>
                <Input
                  prefix={<ScanOutlined />}
                  placeholder="扫描或输入 ShortID"
                  value={shortIdInputB}
                  onChange={(e) => setShortIdInputB(e.target.value)}
                />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Card size="small" title="线缆信息">
          <Form.Item label="线缆标签" name="label">
            <Input placeholder="例如：服务器1-交换机1" />
          </Form.Item>

          <Form.Item label="线缆类型" name="type">
            <Select placeholder="默认：CAT6" allowClear>
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
                  placeholder="线缆长度"
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="颜色" name="color">
                <Input placeholder="如：蓝色、红色" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="备注" name="notes">
            <TextArea rows={2} placeholder="其他说明信息" />
          </Form.Item>
        </Card>
      </Form>
    </Space>
  );

  const tabItems = [
    {
      key: 'single',
      label: (
        <span>
          <ThunderboltOutlined /> 快速连接
        </span>
      ),
      children: renderSingleMode(),
    },
    {
      key: 'dual',
      label: (
        <span>
          <ApiOutlined /> 完整连接
        </span>
      ),
      children: renderDualMode(),
    },
  ];

  const handleSubmit = () => {
    if (activeTab === 'single') {
      handleSingleSubmit();
    } else {
      handleDualSubmit();
    }
  };

  const canSubmit = activeTab === 'single' ? canSubmitSingle : canSubmitDual;

  return (
    <Modal
      title={
        <Space size="large">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <LinkOutlined style={{ fontSize: 20 }} />
            <Title level={4} style={{ margin: 0 }}>
              新建线缆连接
            </Title>
          </div>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={loading}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          创建连接
        </Button>,
      ]}
    >
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </Modal>
  );
}
