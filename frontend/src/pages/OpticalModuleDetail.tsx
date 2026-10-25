import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Popconfirm, Space, Spin, Tag, Timeline, Typography, message } from 'antd';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  ExportOutlined,
  HistoryOutlined,
  ImportOutlined,
  SyncOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { MovementType } from '@contracts/enums';
import { MODULE_FITS } from '@contracts/moduleFits';
import type { ModuleDto, ModuleMovementDto } from '@contracts/opticalModules';
import type { PortDto } from '@contracts/panels';
import { opticalModuleService } from '@/services/opticalModuleService';
import { PortPicker } from '@/components/PortPicker';
import { paths } from '@/routes';
import { MODULE_STATUS_COLORS } from '@/constants/colors';

const { Title, Text } = Typography;

const MOVEMENT_STYLE: Record<MovementType, { icon: ReactNode; color: string }> = {
  PURCHASE: { icon: <ImportOutlined />, color: 'blue' },
  INSTALL: { icon: <CheckCircleOutlined />, color: 'green' },
  UNINSTALL: { icon: <ExportOutlined />, color: 'orange' },
  TRANSFER: { icon: <SyncOutlined />, color: 'purple' },
  REPAIR: { icon: <ToolOutlined />, color: 'red' },
  RETURN: { icon: <CheckCircleOutlined />, color: 'cyan' },
  SCRAP: { icon: <CloseCircleOutlined />, color: 'gray' },
};

type Action = 'install' | 'uninstall' | 'transfer' | 'scrap';

interface ActionForm {
  portId?: string;
  operator?: string;
  notes?: string;
}

export default function OpticalModuleDetail() {
  const { t } = useTranslation('opticalModule');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<ModuleDto | null>(null);
  const [movements, setMovements] = useState<ModuleMovementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<Action | null>(null);
  const [form] = Form.useForm<ActionForm>();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [m, h] = await Promise.all([opticalModuleService.get({ id }), opticalModuleService.history({ id })]);
      setModule(m);
      setMovements(h);
    } catch {
      setModule(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /** a cage takes the module when its form fits and it holds no module yet */
  const fits = (port: PortDto) => !port.hasModule && !!module && (MODULE_FITS[port.portType] ?? []).includes(module.moduleType);

  const openAction = (a: Action) => {
    form.resetFields();
    setAction(a);
  };

  const submit = async () => {
    if (!module || !action) return;
    const v = await form.validateFields();
    const op = { operator: v.operator, notes: v.notes };
    try {
      if (action === 'install') await opticalModuleService.install({ id: module.id, portId: v.portId!, ...op });
      if (action === 'transfer') await opticalModuleService.transfer({ id: module.id, toPortId: v.portId!, ...op });
      if (action === 'uninstall') await opticalModuleService.uninstall({ id: module.id, ...op });
      if (action === 'scrap') await opticalModuleService.scrap({ id: module.id, ...op });
      message.success(t(`messages.${action}Success`));
      setAction(null);
      load();
    } catch {
      // reported by rpc
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }
  if (!module) return <Alert message={t('noData.moduleNotFound')} type="error" showIcon />;

  const needsPort = action === 'install' || action === 'transfer';
  const alertKey = {
    install: 'alerts.installInfo',
    uninstall: 'alerts.uninstallWarning',
    transfer: 'alerts.transferWarning',
    scrap: 'alerts.scrappingWarning',
  } as const;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(paths.opticalModules())}>
          {t('buttons.back')}
        </Button>
        {module.status === 'IN_STOCK' && (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => openAction('install')}>
            {t('buttons.install')}
          </Button>
        )}
        {module.status === 'INSTALLED' && (
          <>
            <Button icon={<ExportOutlined />} onClick={() => openAction('uninstall')}>
              {t('buttons.uninstall')}
            </Button>
            <Button icon={<SyncOutlined />} onClick={() => openAction('transfer')}>
              {t('buttons.transfer')}
            </Button>
          </>
        )}
        {module.status !== 'SCRAPPED' && (
          <Popconfirm
            title={t('messages.scrappingConfirm')}
            description={t('messages.scrappingWarning')}
            onConfirm={() => openAction('scrap')}
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

      <Card title={t('tabs.basicInfo')} style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label={t('fields.serialNo')} span={2}>
            <Text strong copyable>
              {module.serialNo}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.model')}>{module.model}</Descriptions.Item>
          <Descriptions.Item label={t('fields.vendor')}>{module.vendor}</Descriptions.Item>
          <Descriptions.Item label={t('fields.moduleType')}>{t(`moduleTypes.${module.moduleType}`)}</Descriptions.Item>
          <Descriptions.Item label={t('fields.status')}>
            <Tag color={MODULE_STATUS_COLORS[module.status]}>{t(`moduleStatus.${module.status}`)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('fields.wavelength')}>{module.wavelength || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.distance')}>{module.distance || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.ddmSupport')} span={2}>
            {module.ddmSupport ? <Tag color="green">{t('ddm.yes')}</Tag> : <Tag>{t('ddm.no')}</Tag>}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {module.currentPort && (
        <Card title={t('tabs.currentLocation')} style={{ marginBottom: 16 }}>
          <Descriptions bordered column={3}>
            <Descriptions.Item label={t('fields.device')}>{module.currentPort.deviceName}</Descriptions.Item>
            <Descriptions.Item label={t('fields.panel')}>{module.currentPort.panelName}</Descriptions.Item>
            <Descriptions.Item label={t('fields.port')}>
              <a onClick={() => navigate(paths.port(module.currentPort!.id))}>{module.currentPort.number}</a>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card title={t('tabs.purchaseInfo')} style={{ marginBottom: 16 }}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label={t('fields.supplier')}>{module.supplier || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.price')}>{module.price !== null ? module.price : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.purchaseDate')}>{module.purchaseDate ? dayjs(module.purchaseDate).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.warranty')}>{module.warrantyExpiry ? dayjs(module.warrantyExpiry).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('fields.notes')} span={2}>
            {module.notes || '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={
          <>
            <HistoryOutlined /> {t('tabs.movementHistory')}
          </>
        }
      >
        {movements.length === 0 ? (
          <Text type="secondary">{t('noData.noHistory')}</Text>
        ) : (
          <Timeline
            items={movements.map((m) => ({
              color: MOVEMENT_STYLE[m.movementType].color,
              dot: MOVEMENT_STYLE[m.movementType].icon,
              children: (
                <Space direction="vertical" size={4}>
                  <Text strong>{t(`movementTypes.${m.movementType}`)}</Text>
                  <Text type="secondary">{dayjs(m.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                  {m.operator && (
                    <Text type="secondary">
                      {t('fields.operator')}: {m.operator}
                    </Text>
                  )}
                  {m.fromPort && (
                    <Text type="secondary">
                      {t('movement.from')}: {m.fromPort}
                    </Text>
                  )}
                  {m.toPort && (
                    <Text type="secondary">
                      {t('movement.to')}: {m.toPort}
                    </Text>
                  )}
                  {m.notes && (
                    <Text type="secondary">
                      {t('fields.notes')}: {m.notes}
                    </Text>
                  )}
                </Space>
              ),
            }))}
          />
        )}
      </Card>

      <Modal
        title={action ? t(`buttons.${action}`) : ''}
        open={!!action}
        onOk={submit}
        onCancel={() => setAction(null)}
        okText={action ? t(`buttons.${action}`) : ''}
        cancelText={t('buttons.cancel')}
        okButtonProps={{ danger: action === 'scrap' }}
        width={needsPort ? 720 : 520}
        forceRender
      >
        {action && <Alert description={t(alertKey[action])} type={action === 'install' ? 'info' : 'warning'} showIcon style={{ marginBottom: 16 }} />}
        <Form name="optical-module-detail-form" form={form} layout="vertical">
          {needsPort && (
            <Form.Item name="portId" label={t('fields.port')} rules={[{ required: true, message: t('validation.portIdRequired') }]}>
              <PortPicker selectable={fits} testIdPrefix="module-port" />
            </Form.Item>
          )}
          <Form.Item name="operator" label={t('fields.operator')}>
            <Input placeholder={t('placeholders.operator')} />
          </Form.Item>
          <Form.Item name="notes" label={t('fields.notes')} rules={action === 'scrap' ? [{ required: true, message: t('validation.notesRequired') }] : []}>
            <Input.TextArea rows={3} placeholder={action === 'scrap' ? t('placeholders.scrappingReason') : undefined} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
