import { useState, useEffect } from 'react';
import {
  Card,
  Descriptions,
  Button,
  Space,
  Tag,
  Timeline,
  Modal,
  Form,
  Select,
  Input,
  message,
  Spin,
  Alert,
  Popconfirm,
  Typography,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  ArrowLeftOutlined,
  EditOutlined,
  ToolOutlined,
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { OpticalModule, ModuleMovement, ModuleStatus, MovementType } from '@/types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

// 状态映射
const moduleStatusMap: Record<ModuleStatus, { label: string; color: string }> = {
  IN_STOCK: { label: '在库', color: 'default' },
  INSTALLED: { label: '已安装', color: 'green' },
  RESERVED: { label: '预留', color: 'blue' },
  FAULTY: { label: '故障', color: 'red' },
  SCRAPPED: { label: '已报废', color: 'gray' },
};

// 移动类型映射
const movementTypeMap: Record<MovementType, { label: string; icon: any; color: string }> = {
  PURCHASE: { label: '采购入库', icon: <ImportOutlined />, color: 'blue' },
  INSTALL: { label: '安装', icon: <CheckCircleOutlined />, color: 'green' },
  UNINSTALL: { label: '卸下', icon: <ExportOutlined />, color: 'orange' },
  TRANSFER: { label: '转移', icon: <SyncOutlined />, color: 'purple' },
  REPAIR: { label: '送修', icon: <ToolOutlined />, color: 'red' },
  RETURN: { label: '返回', icon: <CheckCircleOutlined />, color: 'cyan' },
  SCRAP: { label: '报废', icon: <CloseCircleOutlined />, color: 'gray' },
};

export default function OpticalModuleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<OpticalModule | null>(null);
  const [movements, setMovements] = useState<ModuleMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [installModalVisible, setInstallModalVisible] = useState(false);
  const [uninstallModalVisible, setUninstallModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [scrapModalVisible, setScrapModalVisible] = useState(false);
  const [installForm] = Form.useForm();
  const [uninstallForm] = Form.useForm();
  const [transferForm] = Form.useForm();
  const [scrapForm] = Form.useForm();

  // 加载光模块详情
  const loadModule = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/v1/optical-modules/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error('Failed to load module');
      const data = await response.json();
      setModule(data);
    } catch (error) {
      message.error('加载光模块信息失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 加载移动历史
  const loadHistory = async () => {
    if (!id) return;
    try {
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}/history`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to load history');
      const data = await response.json();
      setMovements(data);
    } catch (error) {
      console.error('加载移动历史失败:', error);
    }
  };

  useEffect(() => {
    loadModule();
    loadHistory();
  }, [id]);

  // 安装到端口
  const handleInstall = async () => {
    try {
      const values = await installForm.validateFields();
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      message.success('安装成功');
      setInstallModalVisible(false);
      installForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || '安装失败');
    }
  };

  // 从端口卸下
  const handleUninstall = async () => {
    try {
      const values = await uninstallForm.validateFields();
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}/uninstall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      message.success('卸下成功');
      setUninstallModalVisible(false);
      uninstallForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || '卸下失败');
    }
  };

  // 转移到其他端口
  const handleTransfer = async () => {
    try {
      const values = await transferForm.validateFields();
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      message.success('转移成功');
      setTransferModalVisible(false);
      transferForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || '转移失败');
    }
  };

  // 报废
  const handleScrap = async () => {
    try {
      const values = await scrapForm.validateFields();
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}/scrap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }
      message.success('报废成功');
      setScrapModalVisible(false);
      scrapForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || '报废失败');
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!module) {
    return (
      <Alert
        message="光模块不存在"
        description="未找到该光模块信息"
        type="error"
        showIcon
      />
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* 头部操作栏 */}
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/optical-modules')}>
          返回列表
        </Button>
        <Button icon={<EditOutlined />} onClick={() => navigate(`/optical-modules/${id}/edit`)}>
          编辑信息
        </Button>
        {module.status === 'IN_STOCK' && (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setInstallModalVisible(true)}>
            安装到端口
          </Button>
        )}
        {module.status === 'INSTALLED' && (
          <>
            <Button icon={<ExportOutlined />} onClick={() => setUninstallModalVisible(true)}>
              卸下
            </Button>
            <Button icon={<SyncOutlined />} onClick={() => setTransferModalVisible(true)}>
              转移
            </Button>
          </>
        )}
        {module.status !== 'SCRAPPED' && (
          <Popconfirm
            title="确定报废该光模块吗？"
            description="报废后无法恢复"
            onConfirm={() => setScrapModalVisible(true)}
            okText="确定"
            cancelText="取消"
          >
            <Button danger icon={<DeleteOutlined />}>
              报废
            </Button>
          </Popconfirm>
        )}
      </Space>

      <Title level={2}>
        <ToolOutlined /> 光模块详情
      </Title>

      {/* 基本信息卡片 */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="序列号" span={2}>
            <Text strong copyable>
              {module.serialNo}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="型号">{module.model}</Descriptions.Item>
          <Descriptions.Item label="厂商">{module.vendor}</Descriptions.Item>
          <Descriptions.Item label="模块类型">{module.moduleType}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={moduleStatusMap[module.status]?.color}>
              {moduleStatusMap[module.status]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="波长">
            {module.wavelength || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="传输距离">
            {module.distance || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="DDM支持" span={2}>
            {module.ddmSupport ? <Tag color="green">支持</Tag> : <Tag>不支持</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 当前位置信息 */}
      {module.currentPort && (
        <Card title="当前位置" style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label="设备">
              {module.currentPort.panel?.device?.name || '未知设备'}
            </Descriptions.Item>
            <Descriptions.Item label="面板">
              {module.currentPort.panel?.name || '未知面板'}
            </Descriptions.Item>
            <Descriptions.Item label="端口编号">
              {module.currentPort.number}
            </Descriptions.Item>
            <Descriptions.Item label="端口类型">
              {module.currentPort.portType || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 采购信息 */}
      <Card title="采购信息" style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="供应商">
            {module.supplier || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="采购价格">
            {module.price ? `¥${module.price}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="采购日期">
            {module.purchaseDate ? dayjs(module.purchaseDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="保修到期">
            {module.warrantyExpiry ? dayjs(module.warrantyExpiry).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注" span={2}>
            {module.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 移动历史 */}
      <Card title={<><HistoryOutlined /> 移动历史</>}>
        {movements.length === 0 ? (
          <Text type="secondary">暂无移动历史</Text>
        ) : (
          <Timeline
            items={movements.map((movement) => {
              const typeInfo = movementTypeMap[movement.movementType];
              return {
                color: typeInfo.color,
                dot: typeInfo.icon,
                children: (
                  <div>
                    <Space direction="vertical" size={4}>
                      <Text strong>
                        {typeInfo.label}
                      </Text>
                      <Text type="secondary">
                        {dayjs(movement.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                      </Text>
                      {movement.operator && (
                        <Text type="secondary">操作人: {movement.operator}</Text>
                      )}
                      {movement.fromPort && (
                        <Text type="secondary">
                          从: {movement.fromPort.panel?.device?.name} - {movement.fromPort.number}
                        </Text>
                      )}
                      {movement.toPort && (
                        <Text type="secondary">
                          到: {movement.toPort.panel?.device?.name} - {movement.toPort.number}
                        </Text>
                      )}
                      {movement.notes && (
                        <Text type="secondary">备注: {movement.notes}</Text>
                      )}
                    </Space>
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>

      {/* 安装对话框 */}
      <Modal
        title="安装到端口"
        open={installModalVisible}
        onOk={handleInstall}
        onCancel={() => setInstallModalVisible(false)}
        okText="安装"
        cancelText="取消"
      >
        <Alert
          message="提示"
          description="请输入目标端口的ID。安装后光模块状态将变为'已安装'。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={installForm} layout="vertical">
          <Form.Item
            name="portId"
            label="目标端口ID"
            rules={[{ required: true, message: '请输入端口ID' }]}
          >
            <Input placeholder="端口UUID" />
          </Form.Item>
          <Form.Item name="operator" label="操作人">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 卸下对话框 */}
      <Modal
        title="从端口卸下"
        open={uninstallModalVisible}
        onOk={handleUninstall}
        onCancel={() => setUninstallModalVisible(false)}
        okText="卸下"
        cancelText="取消"
      >
        <Alert
          message="注意"
          description="卸下前请确保端口未连接线缆。卸下后光模块将回到库存。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={uninstallForm} layout="vertical">
          <Form.Item name="operator" label="操作人">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转移对话框 */}
      <Modal
        title="转移到其他端口"
        open={transferModalVisible}
        onOk={handleTransfer}
        onCancel={() => setTransferModalVisible(false)}
        okText="转移"
        cancelText="取消"
      >
        <Alert
          message="注意"
          description="转移前请确保当前端口未连接线缆。"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={transferForm} layout="vertical">
          <Form.Item
            name="targetPortId"
            label="目标端口ID"
            rules={[{ required: true, message: '请输入目标端口ID' }]}
          >
            <Input placeholder="端口UUID" />
          </Form.Item>
          <Form.Item name="operator" label="操作人">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 报废对话框 */}
      <Modal
        title="报废光模块"
        open={scrapModalVisible}
        onOk={handleScrap}
        onCancel={() => setScrapModalVisible(false)}
        okText="确认报废"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <Alert
          message="警告"
          description="报废操作不可逆，请确认该光模块确实需要报废。"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={scrapForm} layout="vertical">
          <Form.Item name="operator" label="操作人">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item
            name="notes"
            label="报废原因"
            rules={[{ required: true, message: '请说明报废原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请详细说明报废原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
