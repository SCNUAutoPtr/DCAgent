import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Input,
  Button,
  Space,
  message,
  Typography,
  Alert,
  Spin,
  Descriptions,
  Popconfirm,
  Empty,
} from 'antd';
import {
  ScanOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { cableService } from '@/services/cableService';
import searchService from '@/services/searchService';
import { ShortIdFormatter } from '@/utils/shortIdFormatter';

const { Title, Text } = Typography;

interface CableInfo {
  id: string;
  label: string;
  type: string;
  length?: number;
  color?: string;
  notes?: string;
  endpoints: Array<{
    id: string;
    shortId: number;
    port?: {
      id: string;
      number: string;
      panel?: {
        name: string;
      };
    };
  }>;
}

const CableScrap: React.FC = () => {
  const { t } = useTranslation();
  const [currentInput, setCurrentInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [cable, setCable] = useState<CableInfo | null>(null);
  const [scrapStatus, setScrapStatus] = useState<'idle' | 'scrapping' | 'success' | 'failed'>('idle');
  const inputRef = useRef<any>(null);

  // 扫码或手动输入shortID
  const handleScan = async () => {
    if (!currentInput.trim()) {
      message.warning('请输入或扫描shortID');
      return;
    }

    setChecking(true);
    setCable(null);
    setScrapStatus('idle');

    try {
      // 转换shortID格式
      const numericShortId = ShortIdFormatter.toNumericFormat(currentInput.trim());

      // 查询线缆端点信息
      const endpointData = await searchService.getCableEndpointsByShortId(numericShortId);

      if (!endpointData) {
        message.error('未找到对应的线缆端点');
        setCurrentInput('');
        return;
      }

      // 检查端点是否连接到线缆
      if (!endpointData.cableId) {
        message.error('该端点未连接到任何线缆');
        setCurrentInput('');
        return;
      }

      // 获取完整的线缆信息
      const cableData = await cableService.getById(endpointData.cableId);
      setCable(cableData);
      message.success('找到线缆信息');
      setCurrentInput('');
    } catch (error: any) {
      console.error('查询失败:', error);
      message.error(error.message || '查询失败');
      setCurrentInput('');
    } finally {
      setChecking(false);
      inputRef.current?.focus();
    }
  };

  // 报废线缆
  const handleScrap = async () => {
    if (!cable) return;

    setScrapStatus('scrapping');
    try {
      await cableService.delete(cable.id);
      message.success('线缆报废成功，shortID已释放，连接已断开');
      setScrapStatus('success');

      // 2秒后重置状态
      setTimeout(() => {
        setCable(null);
        setScrapStatus('idle');
        inputRef.current?.focus();
      }, 2000);
    } catch (error: any) {
      console.error('报废失败:', error);
      message.error(error.message || '报废失败');
      setScrapStatus('failed');
    }
  };

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <div>
      <Title level={2}>
        <DeleteOutlined /> 线缆报废
      </Title>
      <Text type="secondary">
        扫描线缆端点的shortID，系统将自动释放shortID、断开所有连接并删除线缆实例
      </Text>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 扫码输入区域 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <ScanOutlined /> 扫描或输入线缆端点shortID
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={inputRef}
                size="large"
                placeholder="扫描或输入shortID（例如：E-00001 或 1）"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyPress={handleKeyPress}
                autoFocus
                disabled={checking}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                size="large"
                icon={<ScanOutlined />}
                onClick={handleScan}
                loading={checking}
              >
                查询
              </Button>
            </Space.Compact>
          </div>

          {/* 线缆信息展示 */}
          {checking && (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Spin size="large" tip="正在查询线缆信息..." />
            </div>
          )}

          {cable && scrapStatus === 'idle' && (
            <Alert
              message="找到线缆"
              description="请确认以下信息，然后点击报废按钮"
              type="info"
              showIcon
              icon={<CheckCircleOutlined />}
            />
          )}

          {cable && (
            <Card
              title={<Text strong>线缆信息</Text>}
              size="small"
              style={{
                background: scrapStatus === 'success' ? '#f6ffed' : scrapStatus === 'failed' ? '#fff2f0' : '#fafafa',
              }}
            >
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label="线缆标签">
                  {cable.label || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="线缆类型">
                  {cable.type}
                </Descriptions.Item>
                <Descriptions.Item label="长度">
                  {cable.length ? `${cable.length}m` : '-'}
                </Descriptions.Item>
                <Descriptions.Item label="颜色">
                  {cable.color || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="备注" span={2}>
                  {cable.notes || '-'}
                </Descriptions.Item>
              </Descriptions>

              <div style={{ marginTop: 16 }}>
                <Text strong>端点信息:</Text>
                {cable.endpoints.map((endpoint, index) => (
                  <div key={endpoint.id} style={{ marginTop: 8, padding: 12, background: '#fff', borderRadius: 4 }}>
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <div>
                        <Text type="secondary">端点 {index + 1}: </Text>
                        <Text code>{ShortIdFormatter.toDisplayFormat(endpoint.shortId)}</Text>
                      </div>
                      {endpoint.port && (
                        <Text type="secondary">
                          连接端口: {endpoint.port.panel?.name} - 端口 {endpoint.port.number}
                        </Text>
                      )}
                    </Space>
                  </div>
                ))}
              </div>

              {scrapStatus === 'idle' && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Popconfirm
                    title="确认报废线缆"
                    description="报废后将释放shortID、断开所有连接并删除线缆，此操作不可恢复！"
                    onConfirm={handleScrap}
                    okText="确认报废"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="primary"
                      danger
                      size="large"
                      icon={<DeleteOutlined />}
                    >
                      报废线缆
                    </Button>
                  </Popconfirm>
                </div>
              )}

              {scrapStatus === 'scrapping' && (
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Spin tip="正在报废线缆..." />
                </div>
              )}

              {scrapStatus === 'success' && (
                <Alert
                  message="报废成功"
                  description="线缆已报废，shortID已释放，连接已断开"
                  type="success"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}

              {scrapStatus === 'failed' && (
                <Alert
                  message="报废失败"
                  description="请检查错误信息或联系管理员"
                  type="error"
                  showIcon
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          )}

          {!cable && !checking && (
            <Empty
              description="请扫描或输入线缆端点shortID"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}
        </Space>
      </Card>

      <Alert
        message="使用说明"
        description={
          <div>
            <p>1. 扫描或手动输入线缆端点的shortID（支持 E-00001 或纯数字格式）</p>
            <p>2. 系统自动查询并显示线缆信息</p>
            <p>3. 确认信息无误后，点击"报废线缆"按钮</p>
            <p>4. 系统将自动：</p>
            <ul style={{ paddingLeft: 20 }}>
              <li>释放两端的shortID回到标签池</li>
              <li>删除Neo4j图数据库中的所有连接关系</li>
              <li>删除线缆实例及端点记录</li>
              <li>更新相关端口状态为可用</li>
            </ul>
          </div>
        }
        type="info"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginTop: 24 }}
      />
    </div>
  );
};

export default CableScrap;
