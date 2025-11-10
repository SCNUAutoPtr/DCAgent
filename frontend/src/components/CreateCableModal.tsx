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
  Row,
  Col,
} from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { cableService } from '@/services/cableService';
import { parseShortId, formatShortId } from '@/utils/shortIdFormatter';

const { Option } = Select;
const { TextArea } = Input;

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
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // 端点信息状态
  const [endpointA, setEndpointA] = useState<any>(null);
  const [endpointB, setEndpointB] = useState<any>(null);
  const [shortIdA, setShortIdA] = useState<number | null>(null);
  const [shortIdB, setShortIdB] = useState<number | null>(null);
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');

  useEffect(() => {
    if (visible) {
      resetForm();
    }
  }, [visible]);

  const resetForm = () => {
    form.resetFields();
    setCurrentStep(0);
    setEndpointA(null);
    setEndpointB(null);
    setShortIdA(null);
    setShortIdB(null);
    setInputA('');
    setInputB('');
  };

  // 处理第一个插头shortID输入
  const handleShortIdAInput = async (value: string) => {
    if (!value.trim()) return;

    try {
      const shortId = parseShortId(value.trim());
      setShortIdA(shortId);

      // 查询是否已存在端点
      try {
        const result = await cableService.getCableEndpointsByShortId(shortId);
        if (result && result.cable) {
          setEndpointA(result);
          message.success('找到已存在的线缆端点');
        } else {
          setEndpointA(null);
          message.info('新的插头标签，将创建新线缆');
        }
      } catch (error) {
        // 404表示不存在，是正常的新建流程
        setEndpointA(null);
        message.info('新的插头标签，将创建新线缆');
      }
    } catch (error: any) {
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
      }
    }
  };

  // 处理第二个插头shortID输入
  const handleShortIdBInput = async (value: string) => {
    if (!value.trim()) return;

    try {
      const shortId = parseShortId(value.trim());
      setShortIdB(shortId);

      // 查询是否已存在端点
      try {
        const result = await cableService.getCableEndpointsByShortId(shortId);
        if (result && result.cable) {
          setEndpointB(result);
          message.success('找到已存在的线缆端点');

          // 如果找到端点，自动填充线缆信息
          if (result.cable) {
            form.setFieldsValue({
              label: result.cable.label || '',
              type: result.cable.type,
              length: result.cable.length,
              color: result.cable.color || '',
              notes: result.cable.notes || '',
            });
          }
        } else {
          setEndpointB(null);
          message.info('新的插头标签');
        }
      } catch (error) {
        // 404表示不存在，是正常的新建流程
        setEndpointB(null);
        message.info('新的插头标签');
      }
    } catch (error: any) {
      if (error.message?.includes('无效的shortID格式')) {
        message.error('请输入有效的ID格式（如：E-00001 或 1）');
      }
    }
  };

  const handleNext = () => {
    if (currentStep === 0) {
      if (!shortIdA) {
        message.warning('请输入第一个插头的ShortID');
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      if (!shortIdB) {
        message.warning('请输入第二个插头的ShortID');
        return;
      }
      if (shortIdA === shortIdB) {
        message.error('两个插头的ShortID不能相同');
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    if (!shortIdA || !shortIdB) {
      message.error('请完成所有步骤');
      return;
    }

    try {
      setLoading(true);
      const values = form.getFieldsValue();

      // 使用手动入库API创建线缆（通过两端shortID）
      await cableService.manualInventory({
        shortIdA,
        shortIdB,
        label: values.label,
        type: values.type || 'CAT6', // 默认类型
        length: values.length,
        color: values.color,
        notes: values.notes,
      });

      message.success('线缆创建成功！');
      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to create cable:', error);
      message.error(error.response?.data?.error || '创建线缆失败');
    } finally {
      setLoading(false);
    }
  };

  // 渲染端点信息卡片
  const renderEndpointInfo = (endpoint: any, shortId: number | null) => {
    if (!endpoint || !endpoint.cable) {
      return (
        <Alert
          message="新插头标签"
          description={`ShortID: ${shortId ? formatShortId(shortId) : ''}`}
          type="info"
          showIcon
        />
      );
    }

    const { cable, portA, portB } = endpoint;
    const connectedPort = portA || portB;

    return (
      <Card size="small" title="已存在的线缆端点">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="线缆类型">
            <Tag>{cable.type}</Tag>
          </Descriptions.Item>
          {cable.label && (
            <Descriptions.Item label="线缆标签">{cable.label}</Descriptions.Item>
          )}
          {connectedPort && (
            <>
              <Descriptions.Item label="连接端口">
                {connectedPort.number}
              </Descriptions.Item>
              {connectedPort.panel && (
                <Descriptions.Item label="所在面板">
                  {connectedPort.panel.name}
                </Descriptions.Item>
              )}
            </>
          )}
        </Descriptions>
      </Card>
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="扫描第一个插头"
              description="请扫描或输入第一个插头的ShortID标签"
              type="info"
              icon={<ScanOutlined />}
              showIcon
            />
            <Input
              prefix={<ScanOutlined />}
              placeholder="扫描或输入ShortID（如：E-00001 或 1）"
              value={inputA}
              onChange={(e) => setInputA(e.target.value)}
              onPressEnter={(e) => handleShortIdAInput((e.target as HTMLInputElement).value)}
              onBlur={(e) => handleShortIdAInput(e.target.value)}
              size="large"
              autoFocus
              allowClear
            />
            {shortIdA && renderEndpointInfo(endpointA, shortIdA)}
          </Space>
        );

      case 1:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="扫描第二个插头"
              description="请扫描或输入第二个插头的ShortID标签"
              type="info"
              icon={<ScanOutlined />}
              showIcon
            />
            <Card size="small" title="第一个插头" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="ShortID">
                  {shortIdA ? formatShortId(shortIdA) : ''}
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <Input
              prefix={<ScanOutlined />}
              placeholder="扫描或输入ShortID（如：E-00002 或 2）"
              value={inputB}
              onChange={(e) => setInputB(e.target.value)}
              onPressEnter={(e) => handleShortIdBInput((e.target as HTMLInputElement).value)}
              onBlur={(e) => handleShortIdBInput(e.target.value)}
              size="large"
              autoFocus
              allowClear
            />
            {shortIdB && renderEndpointInfo(endpointB, shortIdB)}
          </Space>
        );

      case 2:
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="填写线缆信息（可选）"
              description="可以跳过此步骤直接提交，系统会自动推断线缆类型"
              type="info"
              icon={<InfoCircleOutlined />}
              showIcon
            />

            <Form form={form} layout="vertical">
              <Form.Item label="线缆标签" name="label">
                <Input placeholder="例如：服务器1-交换机1" />
              </Form.Item>

              <Form.Item label="线缆类型" name="type">
                <Select placeholder="选填，默认根据端口类型推断" allowClear>
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
                <TextArea rows={3} placeholder="其他说明信息" />
              </Form.Item>
            </Form>
          </Space>
        );

      case 3:
        const values = form.getFieldsValue();
        return (
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <Alert
              message="确认连接信息"
              description="请仔细核对以下信息，确认无误后点击提交"
              type="warning"
              icon={<WarningOutlined />}
              showIcon
            />

            <Card title="连接信息" size="small">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="插头A">
                  {shortIdA ? formatShortId(shortIdA) : ''}
                </Descriptions.Item>
                <Descriptions.Item label="插头B">
                  {shortIdB ? formatShortId(shortIdB) : ''}
                </Descriptions.Item>
                {values.label && (
                  <Descriptions.Item label="线缆标签">
                    {values.label}
                  </Descriptions.Item>
                )}
                {values.type && (
                  <Descriptions.Item label="线缆类型">
                    <Tag>{values.type}</Tag>
                  </Descriptions.Item>
                )}
                {values.length && (
                  <Descriptions.Item label="长度">
                    {values.length} 米
                  </Descriptions.Item>
                )}
                {values.color && (
                  <Descriptions.Item label="颜色">{values.color}</Descriptions.Item>
                )}
                {values.notes && (
                  <Descriptions.Item label="备注">{values.notes}</Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </Space>
        );

      default:
        return null;
    }
  };

  const steps = [
    {
      title: '插头 A',
      icon: <ScanOutlined />,
    },
    {
      title: '插头 B',
      icon: <ScanOutlined />,
    },
    {
      title: '线缆信息',
      icon: <InfoCircleOutlined />,
    },
    {
      title: '确认提交',
      icon: <CheckCircleOutlined />,
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          新建线缆连接
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={700}
      footer={[
        currentStep > 0 && (
          <span
            key="prev"
            onClick={handlePrev}
            style={{ marginRight: 8, cursor: 'pointer', color: '#1890ff' }}
          >
            上一步
          </span>
        ),
        currentStep < 3 ? (
          <span
            key="next"
            onClick={handleNext}
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
      <Steps current={currentStep} items={steps} style={{ marginBottom: 24 }} />
      <div>{renderStepContent()}</div>
    </Modal>
  );
}
