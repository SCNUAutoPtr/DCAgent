import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

// 获取状态映射的函数
const getModuleStatusMap = (t: any): Record<ModuleStatus, { label: string; color: string }> => ({
  IN_STOCK: { label: t('moduleStatus.IN_STOCK'), color: 'default' },
  INSTALLED: { label: t('moduleStatus.INSTALLED'), color: 'green' },
  RESERVED: { label: t('moduleStatus.RESERVED'), color: 'blue' },
  FAULTY: { label: t('moduleStatus.FAULTY'), color: 'red' },
  SCRAPPED: { label: t('moduleStatus.SCRAPPED'), color: 'gray' },
});

// 获取移动类型映射的函数
const getMovementTypeMap = (t: any): Record<MovementType, { label: string; icon: any; color: string }> => ({
  PURCHASE: { label: t('movementTypes.PURCHASE'), icon: <ImportOutlined />, color: 'blue' },
  INSTALL: { label: t('movementTypes.INSTALL'), icon: <CheckCircleOutlined />, color: 'green' },
  UNINSTALL: { label: t('movementTypes.UNINSTALL'), icon: <ExportOutlined />, color: 'orange' },
  TRANSFER: { label: t('movementTypes.TRANSFER'), icon: <SyncOutlined />, color: 'purple' },
  REPAIR: { label: t('movementTypes.REPAIR'), icon: <ToolOutlined />, color: 'red' },
  RETURN: { label: t('movementTypes.RETURN'), icon: <CheckCircleOutlined />, color: 'cyan' },
  SCRAP: { label: t('movementTypes.SCRAP'), icon: <CloseCircleOutlined />, color: 'gray' },
});

export default function OpticalModuleDetail() {
  const { t } = useTranslation('opticalModule');
  const moduleStatusMap = getModuleStatusMap(t);
  const movementTypeMap = getMovementTypeMap(t);

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
      message.error(t('messages.loadDetailFailed'));
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
      console.error(t('messages.loadHistoryFailed'), error);
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
      message.success(t('messages.installSuccess'));
      setInstallModalVisible(false);
      installForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || t('messages.installFailed'));
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
      message.success(t('messages.uninstallSuccess'));
      setUninstallModalVisible(false);
      uninstallForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || t('messages.uninstallFailed'));
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
      message.success(t('messages.transferSuccess'));
      setTransferModalVisible(false);
      transferForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || t('messages.transferFailed'));
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
      message.success(t('messages.scrapSuccess'));
      setScrapModalVisible(false);
      scrapForm.resetFields();
      loadModule();
      loadHistory();
    } catch (error: any) {
      message.error(error.message || t('messages.scrapFailed'));
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
        message={t('noData.moduleNotFound')}
        description={t('noData.moduleNotFound')}
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
          {t('buttons.back')}
        </Button>
        <Button icon={<EditOutlined />} onClick={() => navigate(`/optical-modules/${id}/edit`)}>
          {t('buttons.editInfo')}
        </Button>
        {module.status === 'IN_STOCK' && (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setInstallModalVisible(true)}>
            {t('buttons.install')}
          </Button>
        )}
        {module.status === 'INSTALLED' && (
          <>
            <Button icon={<ExportOutlined />} onClick={() => setUninstallModalVisible(true)}>
              {t('buttons.uninstall')}
            </Button>
            <Button icon={<SyncOutlined />} onClick={() => setTransferModalVisible(true)}>
              {t('buttons.transfer')}
            </Button>
          </>
        )}
        {module.status !== 'SCRAPPED' && (
          <Popconfirm
            title={t('messages.scrappingConfirm')}
            description={t('messages.scrappingWarning')}
            onConfirm={() => setScrapModalVisible(true)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
          >
            <Button danger icon={<DeleteOutlined />}>
              {t('buttons.scrap')}
            </Button>
          </Popconfirm>
        )}
      </Space>

      <Title level={2}>
        <ToolOutlined /> {t('detailTitle')}
      </Title>

      {/* 基本信息卡片 */}
      <Card title={t('tabs.basicInfo')} style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label={t('fields.serialNo')} span={2}>
            <Text strong copyable>
              {module.serialNo}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.model')}>{module.model}</Descriptions.Item>
          <Descriptions.Item label={t('fields.vendor')}>{module.vendor}</Descriptions.Item>
          <Descriptions.Item label={t('fields.moduleType')}>{module.moduleType}</Descriptions.Item>
          <Descriptions.Item label={t('fields.status')}>
            <Tag color={moduleStatusMap[module.status]?.color}>
              {moduleStatusMap[module.status]?.label}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.wavelength')}>
            {module.wavelength || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.distance')}>
            {module.distance || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.ddmSupport')} span={2}>
            {module.ddmSupport ? <Tag color="green">{t('moduleStatus.INSTALLED')}</Tag> : <Tag>{t('noData.noLocation')}</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 当前位置信息 */}
      {module.currentPort && (
        <Card title={t('tabs.currentLocation')} style={{ marginBottom: 16 }}>
          <Descriptions bordered column={2}>
            <Descriptions.Item label={t('fields.currentPort')}>
              {module.currentPort.panel?.device?.name || t('noData.moduleNotFound')}
            </Descriptions.Item>
            <Descriptions.Item label={t('tabs.basicInfo')}>
              {module.currentPort.panel?.name || t('noData.moduleNotFound')}
            </Descriptions.Item>
            <Descriptions.Item label={t('fields.currentPort')}>
              {module.currentPort.number}
            </Descriptions.Item>
            <Descriptions.Item label={t('fields.moduleType')}>
              {module.currentPort.portType || '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* 采购信息 */}
      <Card title={t('tabs.purchaseInfo')} style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label={t('fields.supplier')}>
            {module.supplier || '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.price')}>
            {module.price ? `¥${module.price}` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.purchaseDate')}>
            {module.purchaseDate ? dayjs(module.purchaseDate).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.warranty')}>
            {module.warrantyExpiry ? dayjs(module.warrantyExpiry).format('YYYY-MM-DD') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.notes')} span={2}>
            {module.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 移动历史 */}
      <Card title={<><HistoryOutlined /> {t('tabs.movementHistory')}</>}>
        {movements.length === 0 ? (
          <Text type="secondary">{t('noData.noHistory')}</Text>
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
                        <Text type="secondary">{t('fields.operator')}: {movement.operator}</Text>
                      )}
                      {movement.fromPort && (
                        <Text type="secondary">
                          {t('movementTypes.TRANSFER')}: {movement.fromPort.panel?.device?.name} - {movement.fromPort.number}
                        </Text>
                      )}
                      {movement.toPort && (
                        <Text type="secondary">
                          {t('movementTypes.INSTALL')}: {movement.toPort.panel?.device?.name} - {movement.toPort.number}
                        </Text>
                      )}
                      {movement.notes && (
                        <Text type="secondary">{t('fields.notes')}: {movement.notes}</Text>
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
        title={t('buttons.install')}
        open={installModalVisible}
        onOk={handleInstall}
        onCancel={() => setInstallModalVisible(false)}
        okText={t('buttons.install')}
        cancelText={t('buttons.cancel')}
      >
        <Alert
          message={t('buttons.install')}
          description={t('alerts.installInfo')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={installForm} layout="vertical">
          <Form.Item
            name="portId"
            label={t('fields.currentPort')}
            rules={[{ required: true, message: t('validation.portIdRequired') }]}
          >
            <Input placeholder={t('placeholders.portId')} />
          </Form.Item>
          <Form.Item name="operator" label={t('fields.operator')}>
            <Input placeholder={t('placeholders.operator')} />
          </Form.Item>
          <Form.Item name="notes" label={t('fields.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.operator')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 卸下对话框 */}
      <Modal
        title={t('buttons.uninstall')}
        open={uninstallModalVisible}
        onOk={handleUninstall}
        onCancel={() => setUninstallModalVisible(false)}
        okText={t('buttons.uninstall')}
        cancelText={t('buttons.cancel')}
      >
        <Alert
          message={t('buttons.uninstall')}
          description={t('alerts.uninstallWarning')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={uninstallForm} layout="vertical">
          <Form.Item name="operator" label={t('fields.operator')}>
            <Input placeholder={t('placeholders.operator')} />
          </Form.Item>
          <Form.Item name="notes" label={t('fields.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.operator')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 转移对话框 */}
      <Modal
        title={t('buttons.transfer')}
        open={transferModalVisible}
        onOk={handleTransfer}
        onCancel={() => setTransferModalVisible(false)}
        okText={t('buttons.transfer')}
        cancelText={t('buttons.cancel')}
      >
        <Alert
          message={t('buttons.transfer')}
          description={t('alerts.transferWarning')}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={transferForm} layout="vertical">
          <Form.Item
            name="targetPortId"
            label={t('fields.currentPort')}
            rules={[{ required: true, message: t('validation.targetPortIdRequired') }]}
          >
            <Input placeholder={t('placeholders.targetPortId')} />
          </Form.Item>
          <Form.Item name="operator" label={t('fields.operator')}>
            <Input placeholder={t('placeholders.operator')} />
          </Form.Item>
          <Form.Item name="notes" label={t('fields.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.operator')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 报废对话框 */}
      <Modal
        title={t('buttons.scrap')}
        open={scrapModalVisible}
        onOk={handleScrap}
        onCancel={() => setScrapModalVisible(false)}
        okText={t('buttons.scrap')}
        cancelText={t('buttons.cancel')}
        okButtonProps={{ danger: true }}
      >
        <Alert
          message={t('buttons.scrap')}
          description={t('alerts.scrappingWarning')}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={scrapForm} layout="vertical">
          <Form.Item name="operator" label={t('fields.operator')}>
            <Input placeholder={t('placeholders.operator')} />
          </Form.Item>
          <Form.Item
            name="notes"
            label={t('fields.notes')}
            rules={[{ required: true, message: t('validation.notesRequired') }]}
          >
            <Input.TextArea rows={3} placeholder={t('placeholders.scrappingReason')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
