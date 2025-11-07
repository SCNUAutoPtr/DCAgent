import React, { useState, useRef, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  message,
  Descriptions,
  Alert,
  Spin,
  Typography,
  Tag,
  Table,
  Divider,
} from 'antd';
import {
  ScanOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  DeleteOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { cableService } from '@/services/cableService';
import searchService from '@/services/searchService';
import { ShortIdFormatter } from '@/utils/shortIdFormatter';

const { Title, Text } = Typography;
const { Option } = Select;

interface CableBaseInfo {
  type: string;
  length?: number;
  color?: string;
  notes?: string;
}

interface PortInfo {
  shortId: number;
  entityId: string;
  label?: string;
  status: string;
  location?: string;
  isValid: boolean;
  errorMessage?: string;
}

interface CableRecord {
  key: string;
  portA: PortInfo;
  portB: PortInfo;
  status: 'pending' | 'submitting' | 'success' | 'failed';
  errorMessage?: string;
  timestamp: number;
}

const CableManualInventory: React.FC = () => {
  const [form] = Form.useForm();
  const [cableBaseInfo, setCableBaseInfo] = useState<CableBaseInfo | null>(null);
  const [baseInfoConfirmed, setBaseInfoConfirmed] = useState(false);

  // 扫码输入相关
  const [currentInput, setCurrentInput] = useState('');
  const [currentSide, setCurrentSide] = useState<'A' | 'B'>('A'); // A 或 B
  const [portA, setPortA] = useState<PortInfo | null>(null);
  const [portB, setPortB] = useState<PortInfo | null>(null);
  const [checking, setChecking] = useState(false);

  // 已录入的线缆记录
  const [cableRecords, setCableRecords] = useState<CableRecord[]>([]);
  const [recordCounter, setRecordCounter] = useState(0);

  const inputRef = useRef<any>(null);

  // 自动聚焦到输入框
  useEffect(() => {
    if (baseInfoConfirmed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [baseInfoConfirmed, currentSide, portA, portB]);

  // 检查 shortId 是否可用于线缆入库
  // 未分配的 shortID 是合法的（将用于新线缆），已分配的必须是可用端口
  const checkShortId = async (shortId: number): Promise<PortInfo> => {
    try {
      const result = await searchService.findByShortId(shortId);

      // 未分配的 shortID：可用于新线缆
      if (!result) {
        return {
          shortId,
          entityId: '',
          isValid: true,
          status: 'AVAILABLE',
          label: `新线缆 ${ShortIdFormatter.toDisplayFormat(shortId)}`,
        };
      }

      // 已分配但不是端口类型：不可用
      if (result.type !== 'Port') {
        return {
          shortId,
          entityId: result.id,
          isValid: false,
          status: 'INVALID',
          errorMessage: `ShortID ${ShortIdFormatter.toDisplayFormat(shortId)} 已被占用（类型：${result.type}）`,
        };
      }

      // 是端口但已被占用
      if (result.metadata?.status === 'OCCUPIED') {
        return {
          shortId,
          entityId: result.id,
          label: result.name,
          isValid: false,
          status: 'OCCUPIED',
          location: result.description,
          errorMessage: `端口 ${result.name} 已被占用`,
        };
      }

      // 是可用端口
      return {
        shortId,
        entityId: result.id,
        label: result.name,
        isValid: true,
        status: 'AVAILABLE',
        location: result.description,
      };
    } catch (error) {
      console.error('Error checking shortId:', error);
      return {
        shortId,
        entityId: '',
        isValid: false,
        status: 'ERROR',
        errorMessage: '查询失败',
      };
    }
  };

  // 处理扫码输入（自动回车）
  const handleScanInput = async (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    // 解析 shortId（支持 E-00001 或 00001 或 1 格式）
    let shortId: number;
    try {
      shortId = ShortIdFormatter.toNumericFormat(trimmedValue);
    } catch {
      // 如果不是 E- 格式，尝试直接解析数字
      shortId = parseInt(trimmedValue, 10);
      if (isNaN(shortId)) {
        message.error('无效的 ShortID 格式');
        setCurrentInput('');
        return;
      }
    }

    setChecking(true);
    const portInfo = await checkShortId(shortId);
    setChecking(false);

    // 显示检查结果
    if (!portInfo.isValid) {
      message.error(portInfo.errorMessage);
      setCurrentInput('');
      return;
    }

    // 根据当前是 A 还是 B 来设置
    if (currentSide === 'A') {
      setPortA(portInfo);
      message.success(`端口 A: ${portInfo.label} (${ShortIdFormatter.toDisplayFormat(shortId)})`);
      setCurrentSide('B');
      setCurrentInput('');
    } else {
      // 检查是否与 A 端重复
      if (portA && portA.shortId === shortId) {
        message.error('端口 B 不能与端口 A 相同');
        setCurrentInput('');
        return;
      }

      setPortB(portInfo);
      message.success(`端口 B: ${portInfo.label} (${ShortIdFormatter.toDisplayFormat(shortId)})`);
      setCurrentInput('');

      // 自动提交这一对线缆
      await submitCablePair(portA!, portInfo);
    }
  };

  // 提交一对线缆
  const submitCablePair = async (portAInfo: PortInfo, portBInfo: PortInfo) => {
    if (!cableBaseInfo) {
      message.error('线缆基本信息未设置');
      return;
    }

    const recordKey = `cable-${recordCounter}`;
    const newRecord: CableRecord = {
      key: recordKey,
      portA: portAInfo,
      portB: portBInfo,
      status: 'submitting',
      timestamp: Date.now(),
    };

    // 添加到记录列表
    setCableRecords(prev => [newRecord, ...prev]);
    setRecordCounter(prev => prev + 1);

    try {
      // 调用后端 API
      await cableService.manualInventory({
        shortIdA: portAInfo.shortId,
        shortIdB: portBInfo.shortId,
        type: cableBaseInfo.type,
        length: cableBaseInfo.length,
        color: cableBaseInfo.color,
        notes: cableBaseInfo.notes,
      });

      // 更新记录状态为成功
      setCableRecords(prev =>
        prev.map(record =>
          record.key === recordKey
            ? { ...record, status: 'success' }
            : record
        )
      );

      message.success('线缆入库成功');
    } catch (error: any) {
      console.error('Error submitting cable:', error);
      const errorMsg = error.response?.data?.error || '入库失败';

      // 更新记录状态为失败
      setCableRecords(prev =>
        prev.map(record =>
          record.key === recordKey
            ? { ...record, status: 'failed', errorMessage: errorMsg }
            : record
        )
      );

      message.error(errorMsg);
    } finally {
      // 准备录入下一对线缆
      setPortA(null);
      setPortB(null);
      setCurrentSide('A');

      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  // 确认基本信息
  const handleConfirmBaseInfo = async (values: any) => {
    setCableBaseInfo({
      type: values.type,
      length: values.length,
      color: values.color,
      notes: values.notes,
    });
    setBaseInfoConfirmed(true);
    message.success('线缆基本信息已设置，开始扫码录入');
  };

  // 修改基本信息
  const handleEditBaseInfo = () => {
    setBaseInfoConfirmed(false);
    setPortA(null);
    setPortB(null);
    setCurrentSide('A');
    setCurrentInput('');
  };

  // 删除记录
  const handleDeleteRecord = (key: string) => {
    setCableRecords(prev => prev.filter(record => record.key !== key));
    message.success('已删除记录');
  };

  // 重试失败的记录
  const handleRetryRecord = async (record: CableRecord) => {
    // 更新状态为提交中
    setCableRecords(prev =>
      prev.map(r =>
        r.key === record.key
          ? { ...r, status: 'submitting', errorMessage: undefined }
          : r
      )
    );

    try {
      await cableService.manualInventory({
        shortIdA: record.portA.shortId,
        shortIdB: record.portB.shortId,
        type: cableBaseInfo!.type,
        length: cableBaseInfo!.length,
        color: cableBaseInfo!.color,
        notes: cableBaseInfo!.notes,
      });

      setCableRecords(prev =>
        prev.map(r =>
          r.key === record.key
            ? { ...r, status: 'success' }
            : r
        )
      );

      message.success('重试成功');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '重试失败';
      setCableRecords(prev =>
        prev.map(r =>
          r.key === record.key
            ? { ...r, status: 'failed', errorMessage: errorMsg }
            : r
        )
      );
      message.error(errorMsg);
    }
  };

  // 渲染状态标签
  const renderStatusTag = (status: CableRecord['status']) => {
    switch (status) {
      case 'pending':
        return <Tag color="default">待提交</Tag>;
      case 'submitting':
        return <Tag color="processing" icon={<Spin size="small" />}>提交中</Tag>;
      case 'success':
        return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
      case 'failed':
        return <Tag color="error" icon={<WarningOutlined />}>失败</Tag>;
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '端口 A',
      key: 'portA',
      render: (_: any, record: CableRecord) => (
        <div>
          <div>
            <Text strong>{record.portA.label}</Text>
          </div>
          <div>
            <Text code>{ShortIdFormatter.toDisplayFormat(record.portA.shortId)}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '端口 B',
      key: 'portB',
      render: (_: any, record: CableRecord) => (
        <div>
          <div>
            <Text strong>{record.portB.label}</Text>
          </div>
          <div>
            <Text code>{ShortIdFormatter.toDisplayFormat(record.portB.shortId)}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 120,
      render: (_: any, record: CableRecord) => renderStatusTag(record.status),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_: any, record: CableRecord) => (
        <Space>
          {record.status === 'failed' && (
            <Button
              type="link"
              size="small"
              onClick={() => handleRetryRecord(record)}
            >
              重试
            </Button>
          )}
          <Button
            type="link"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteRecord(record.key)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={2}>线缆批量入库</Title>
        <Text type="secondary">
          适用于批量录入相同规格的线缆，使用 A-B-A'-B' 顺序快速扫码
        </Text>

        <Divider />

        {/* 步骤1：设置线缆基本信息 */}
        {!baseInfoConfirmed ? (
          <div>
            <Alert
              message="第一步：设置线缆基本信息"
              description="这批线缆的基本信息（类型、颜色等）将应用到所有录入的线缆"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={handleConfirmBaseInfo}
              initialValues={{
                type: 'CAT6',
              }}
            >
              <Form.Item
                label="线缆类型"
                name="type"
                rules={[{ required: true, message: '请选择线缆类型' }]}
              >
                <Select placeholder="请选择线缆类型" size="large">
                  <Option value="CAT5E">CAT5E 网线</Option>
                  <Option value="CAT6">CAT6 网线</Option>
                  <Option value="CAT6A">CAT6A 网线</Option>
                  <Option value="CAT7">CAT7 网线</Option>
                  <Option value="FIBER_SM">单模光纤</Option>
                  <Option value="FIBER_MM">多模光纤</Option>
                  <Option value="QSFP_TO_SFP">QSFP转SFP</Option>
                  <Option value="QSFP_TO_QSFP">QSFP直连</Option>
                  <Option value="SFP_TO_SFP">SFP直连</Option>
                  <Option value="POWER">电源线</Option>
                  <Option value="OTHER">其他</Option>
                </Select>
              </Form.Item>

              <Form.Item label="线缆长度（米）" name="length">
                <InputNumber
                  min={0.1}
                  step={0.5}
                  placeholder="可选"
                  style={{ width: '100%' }}
                  size="large"
                />
              </Form.Item>

              <Form.Item label="线缆颜色" name="color">
                <Input placeholder="可选，如：蓝色" size="large" />
              </Form.Item>

              <Form.Item label="批注备注" name="notes">
                <Input.TextArea rows={2} placeholder="可选，该批次线缆的统一备注" />
              </Form.Item>

              <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />}>
                确认并开始扫码
              </Button>
            </Form>
          </div>
        ) : (
          <div>
            {/* 显示已设置的基本信息 */}
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f0f5ff' }}>
              <Space split={<Divider type="vertical" />}>
                <div>
                  <Text type="secondary">线缆类型：</Text>
                  <Tag color="blue">{cableBaseInfo?.type}</Tag>
                </div>
                {cableBaseInfo?.length && (
                  <div>
                    <Text type="secondary">长度：</Text>
                    <Text strong>{cableBaseInfo.length}m</Text>
                  </div>
                )}
                {cableBaseInfo?.color && (
                  <div>
                    <Text type="secondary">颜色：</Text>
                    <Text strong>{cableBaseInfo.color}</Text>
                  </div>
                )}
                <Button type="link" onClick={handleEditBaseInfo}>
                  修改
                </Button>
              </Space>
            </Card>

            {/* 步骤2：扫码录入 */}
            <Alert
              message={`第二步：扫码录入（${currentSide === 'A' ? '扫描端口 A' : '扫描端口 B'}）`}
              description={
                currentSide === 'A'
                  ? '请扫描第一根线缆的 A 端端口二维码'
                  : portB
                  ? '正在提交...'
                  : '请扫描第一根线缆的 B 端端口二维码，扫描后将自动提交'
              }
              type={currentSide === 'A' ? 'info' : 'success'}
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Card size="small" style={{ marginBottom: 24 }}>
              <Form.Item label={`当前扫描：端口 ${currentSide}`} style={{ marginBottom: 0 }}>
                <Input
                  ref={inputRef}
                  prefix={<ScanOutlined />}
                  placeholder="扫描端口二维码（支持 E-00001 或 00001 格式）"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onPressEnter={(e) => handleScanInput((e.target as HTMLInputElement).value)}
                  size="large"
                  autoFocus
                  suffix={checking && <Spin size="small" />}
                  disabled={checking}
                />
              </Form.Item>

              <Space style={{ marginTop: 16 }} size="large">
                {portA && (
                  <div>
                    <Tag color="blue">端口 A</Tag>
                    <Text strong>{portA.label}</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      {ShortIdFormatter.toDisplayFormat(portA.shortId)}
                    </Text>
                    {currentSide === 'A' && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          setPortA(null);
                          setCurrentInput('');
                        }}
                      >
                        重新扫描
                      </Button>
                    )}
                  </div>
                )}
                {portB && (
                  <div>
                    <Tag color="green">端口 B</Tag>
                    <Text strong>{portB.label}</Text>
                    <Text code style={{ marginLeft: 8 }}>
                      {ShortIdFormatter.toDisplayFormat(portB.shortId)}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>

            {/* 已录入的线缆记录 */}
            {cableRecords.length > 0 && (
              <div>
                <Title level={4}>
                  已录入线缆记录 ({cableRecords.filter(r => r.status === 'success').length}/
                  {cableRecords.length})
                </Title>
                <Table
                  dataSource={cableRecords}
                  columns={columns}
                  pagination={false}
                  size="small"
                  scroll={{ y: 400 }}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default CableManualInventory;
