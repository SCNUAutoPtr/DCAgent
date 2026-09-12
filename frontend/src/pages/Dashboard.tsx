import { useCallback, useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Typography, Table, Tag, Button, Progress, message } from 'antd';
import {
  CloudServerOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  dashboardService,
  DashboardOverview,
  DashboardRecentDevice,
} from '@/services/dashboardService';

const { Title, Text } = Typography;

// 线缆入库状态配色，和线缆管理页保持一致
const CABLE_STATUS_COLORS = {
  notInventoried: '#d9d9d9',
  inventoried: '#faad14',
  inUse: '#52c41a',
};

export default function Dashboard() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getOverview();
      setOverview(data);
    } catch (error) {
      message.error(t('loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const counts = overview?.counts;
  const ports = overview?.ports;
  const cables = overview?.cables;

  const deviceColumns = [
    {
      title: t('fields.device'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: DashboardRecentDevice) => (
        <a onClick={() => navigate(`/cabinets?cabinetId=${record.cabinetId}&view=visual`)}>{name}</a>
      ),
    },
    {
      title: t('fields.model'),
      dataIndex: 'model',
      key: 'model',
      render: (model?: string | null) => model || '-',
    },
    {
      title: t('fields.location'),
      key: 'location',
      render: (record: DashboardRecentDevice) =>
        [record.roomName, record.cabinetName].filter(Boolean).join(' / ') || '-',
    },
    {
      title: t('fields.uPosition'),
      dataIndex: 'uPosition',
      key: 'uPosition',
      width: 80,
      render: (uPosition?: number | null) => (uPosition ? `U${uPosition}` : '-'),
    },
  ];

  const scaleItems = counts
    ? [
        { label: t('fields.dataCenters'), value: counts.dataCenters },
        { label: t('fields.rooms'), value: counts.rooms },
        { label: t('fields.cabinets'), value: counts.cabinets },
        { label: t('fields.panels'), value: counts.panels },
        { label: t('fields.ports'), value: counts.ports },
      ]
    : [];

  const cableItems = cables
    ? [
        {
          key: 'inUse',
          label: t('cableStatus.inUse'),
          value: cables.inUse,
          color: CABLE_STATUS_COLORS.inUse,
        },
        {
          key: 'inventoried',
          label: t('cableStatus.inventoried'),
          value: cables.inventoried,
          color: CABLE_STATUS_COLORS.inventoried,
        },
        {
          key: 'notInventoried',
          label: t('cableStatus.notInventoried'),
          value: cables.notInventoried,
          color: CABLE_STATUS_COLORS.notInventoried,
        },
      ]
    : [];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <div>
          <Title level={2}>{t('title')}</Title>
          <p style={{ color: '#8c8c8c', marginBottom: 24 }}>{t('description')}</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadOverview} loading={loading}>
          {t('refresh')}
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading && !overview}>
            <Statistic
              title={t('statistics.totalDevices')}
              value={counts?.devices ?? 0}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading && !overview}>
            <Statistic
              title={t('statistics.cableConnections')}
              value={counts?.cables ?? 0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading && !overview}>
            <Statistic
              title={t('statistics.cabinetCount')}
              value={counts?.cabinets ?? 0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card loading={loading && !overview}>
            <Statistic
              title={t('statistics.portOccupancy')}
              value={ports?.occupancyRate ?? 0}
              suffix="%"
              precision={1}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('portStatus.occupied')} {ports?.occupied ?? 0} / {ports?.total ?? 0}
            </Text>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={14}>
          <Card title={t('cards.recentDevices')} loading={loading && !overview}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              columns={deviceColumns}
              dataSource={overview?.recentDevices || []}
              locale={{ emptyText: t('emptyState') }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={t('cards.cableStatus')} loading={loading && !overview}>
            {cables && cables.total > 0 ? (
              cableItems.map((item) => (
                <div key={item.key} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text type="secondary">{item.label}</Text>
                    <Text>{item.value}</Text>
                  </div>
                  <Progress
                    percent={Math.round((item.value / cables.total) * 100)}
                    strokeColor={item.color}
                    showInfo={false}
                    size="small"
                  />
                </div>
              ))
            ) : (
              <Text type="secondary">{t('emptyState')}</Text>
            )}
          </Card>
        </Col>
      </Row>

      <Card title={t('cards.scale')} style={{ marginTop: 24 }} loading={loading && !overview}>
        <Row gutter={[16, 16]}>
          {scaleItems.map((item) => (
            <Col key={item.label} xs={12} sm={8} lg={4}>
              <Text type="secondary" style={{ display: 'block' }}>
                {item.label}
              </Text>
              <Tag style={{ marginTop: 4, fontSize: 16, padding: '2px 10px' }}>{item.value}</Tag>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
}
