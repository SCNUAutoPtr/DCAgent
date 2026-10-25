import type { CSSProperties, ReactNode } from 'react';
import { Button, Card, Col, Empty, Row, Skeleton, Table, Typography, theme } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CloudServerOutlined,
  DesktopOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
  InboxOutlined,
  LinkOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { DashboardOverview } from '@contracts/dashboard';
import { CABLE_STATES, DEVICE_TYPES, MODULE_STATUSES } from '@contracts/enums';
import { useDashboardOverview } from '@/api/hooks/dashboard';
import { paths } from '@/routes';
import { useUiPrefs } from '@/stores/uiPrefs';
import { seriesColors } from '@/theme';
import CountUp from '@/components/dashboard/CountUp';
import Donut from '@/components/dashboard/Donut';
import BarList from '@/components/dashboard/BarList';
import StackBar from '@/components/dashboard/StackBar';
import { paletteShortcut } from '@/components/CommandPalette/shortcut';

const { Title, Text } = Typography;

type RecentDevice = DashboardOverview['recentDevices'][number];

const SUBNETS_SHOWN = 6;
const rise = (i: number): CSSProperties => ({ animationDelay: `${i * 45}ms` });

interface StatProps {
  index: number;
  icon: ReactNode;
  color: string;
  title: string;
  value: number;
  decimals?: number;
  suffix?: string;
  sub: string;
  onClick: () => void;
  testId: string;
}

function StatCard({ index, icon, color, title, value, decimals, suffix, sub, onClick, testId }: StatProps) {
  const { token } = theme.useToken();
  return (
    <Card
      className="dash-stat dash-rise"
      style={rise(index)}
      styles={{ body: { padding: 18 } }}
      onClick={onClick}
      tabIndex={0}
      role="link"
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      data-testid={testId}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {title}
        </Text>
        <span className="dash-stat-icon" style={{ color, background: `${color}1f` }}>
          {icon}
        </span>
      </div>
      <div className="dash-value" style={{ color: token.colorText }}>
        <CountUp value={value} decimals={decimals} />
        {suffix && <span style={{ fontSize: 16, marginLeft: 2, color: token.colorTextSecondary }}>{suffix}</span>}
      </div>
      {/* subtitles may take two lines in en/ja instead of being cut off */}
      <Text type="secondary" style={{ fontSize: 12, display: 'block', lineHeight: '18px' }}>
        {sub}
      </Text>
    </Card>
  );
}

function HealthRow({ ok, label, value, onClick }: { ok: boolean; label: string; value: number; onClick: () => void }) {
  const { token } = theme.useToken();
  const { t } = useTranslation('dashboard');
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
    >
      {ok ? <CheckCircleFilled style={{ color: token.colorSuccess }} /> : <ExclamationCircleFilled style={{ color: token.colorWarning }} />}
      <span style={{ flex: 1 }}>{label}</span>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t(ok ? 'health.ok' : 'health.attention')}
      </Text>
      <span style={{ minWidth: 32, textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

/** Isometric rack sketch for the 3D entry card (decorative). */
function RackArt() {
  const racks = [0, 1, 2];
  return (
    <svg className="dash-3d-art" width="210" height="150" viewBox="0 0 210 150" aria-hidden>
      {racks.map((i) => {
        const x = 30 + i * 52;
        const y = 40 - i * 10;
        return (
          <g key={i}>
            <polygon points={`${x},${y} ${x + 36},${y - 12} ${x + 60},${y} ${x + 24},${y + 12}`} fill="#3b6fe0" opacity="0.55" />
            <polygon points={`${x},${y} ${x + 24},${y + 12} ${x + 24},${y + 102} ${x},${y + 90}`} fill="#1c3b86" />
            <polygon points={`${x + 24},${y + 12} ${x + 60},${y} ${x + 60},${y + 90} ${x + 24},${y + 102}`} fill="#25489f" />
            {[0, 1, 2, 3, 4, 5].map((u) => (
              <line key={u} x1={x + 3} y1={y + 18 + u * 12} x2={x + 21} y2={y + 27 + u * 12} stroke={u % 2 ? '#19b3c9' : '#7fb0ff'} strokeWidth="2" opacity="0.85" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const { t, i18n } = useTranslation('dashboard');
  const { t: tDevice } = useTranslation('device');
  const { t: tModule } = useTranslation('opticalModule');
  const { token } = theme.useToken();
  const mode = useUiPrefs((s) => s.theme);
  const series = seriesColors(mode);
  const navigate = useNavigate();
  const { data: o, isLoading, isFetching, refetch, dataUpdatedAt } = useDashboardOverview();

  const ipAllocated = o?.subnets.reduce((s, x) => s + x.usage.allocated, 0) ?? 0;
  const cableTotal = o ? o.cables.STOCK + o.cables.IN_USE : 0;

  const stats: Omit<StatProps, 'index'>[] = o
    ? [
        { testId: 'stat-devices', icon: <CloudServerOutlined />, color: series[0], title: t('stats.devices'), value: o.counts.devices, sub: t('sub.devices', { rooms: o.counts.rooms, dataCenters: o.counts.dataCenters }), onClick: () => navigate(paths.devices()) },
        { testId: 'stat-cabinets', icon: <InboxOutlined />, color: series[6], title: t('stats.cabinets'), value: o.counts.cabinets, sub: t('sub.cabinets', { missing: o.labelsMissing }), onClick: () => navigate(paths.cabinets()) },
        { testId: 'stat-panels', icon: <AppstoreOutlined />, color: series[2], title: t('stats.panels'), value: o.counts.panels, sub: t('sub.panels', { ports: o.ports.total }), onClick: () => navigate(paths.panels()) },
        { testId: 'stat-ports', icon: <ApiOutlined />, color: series[1], title: t('stats.ports'), value: o.ports.usageRate, decimals: 1, suffix: '%', sub: t('sub.ports', { connected: o.ports.connected, total: o.ports.total }), onClick: () => navigate(paths.topology()) },
        { testId: 'stat-cables', icon: <LinkOutlined />, color: series[0], title: t('stats.cables'), value: o.counts.cables, sub: t('sub.cables', { inUse: o.cables.IN_USE, stock: o.cables.STOCK }), onClick: () => navigate(paths.topology()) },
        { testId: 'stat-modules', icon: <ThunderboltOutlined />, color: series[3], title: t('stats.opticalModules'), value: o.counts.opticalModules, sub: t('sub.opticalModules', { installed: o.opticalModules.INSTALLED, total: o.counts.opticalModules }), onClick: () => navigate(paths.opticalModules()) },
        { testId: 'stat-ips', icon: <GlobalOutlined />, color: series[2], title: t('stats.ipAddresses'), value: ipAllocated, sub: t('sub.ipAddresses', { subnets: o.subnets.length }), onClick: () => navigate(paths.ipManagement()) },
        { testId: 'stat-workstations', icon: <DesktopOutlined />, color: series[4], title: t('stats.workstations'), value: o.workstations.online, sub: t('sub.workstations', { total: o.workstations.total }), onClick: () => navigate(paths.rooms()) },
      ]
    : [];

  const portSegments = o
    ? [
        { key: 'connected', label: t('ports.connected'), value: o.ports.connected, color: series[0] },
        { key: 'free', label: t('ports.free'), value: o.ports.free, color: token.colorFillSecondary },
      ]
    : [];

  const deviceBars = o
    ? DEVICE_TYPES.map((type, i) => ({ key: type, label: tDevice(`deviceTypes.${type}`), value: o.devicesByType[type], color: series[i] }))
        .filter((b) => b.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  const subnets = o ? [...o.subnets].sort((a, b) => b.usage.utilization - a.usage.utilization) : [];
  const subnetBars = subnets.slice(0, SUBNETS_SHOWN).map((s) => {
    const usable = Math.max(0, s.usage.capacity - s.usage.reserved - s.usage.blocked);
    return {
      key: s.id,
      label: s.name || s.network,
      value: s.usage.utilization,
      ratio: s.usage.utilization / 100,
      display: `${s.usage.utilization.toFixed(1)}%`,
      color: series[0],
      tooltip: `${s.network}  ${t('subnets.usage', { allocated: s.usage.allocated, usable })}`,
      onClick: () => navigate(paths.subnet(s.id)),
    };
  });

  const deviceColumns = [
    { title: t('fields.device'), dataIndex: 'name', key: 'name', render: (name: string) => <a onClick={() => navigate(paths.devices())}>{name}</a> },
    { title: t('fields.type'), dataIndex: 'type', key: 'type', render: (type: RecentDevice['type']) => tDevice(`deviceTypes.${type}`) },
    { title: t('fields.location'), dataIndex: 'location', key: 'location', render: (v: string) => v || '-' },
    { title: t('fields.createdAt'), dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleDateString(i18n.language) },
  ];

  const card = (i: number): CSSProperties => ({ height: '100%', ...rise(i) });

  return (
    <div data-testid="dashboard">
      <div className="dash-hero dash-rise">
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ minWidth: 260 }}>
            <Title level={2} style={{ color: '#fff', margin: 0 }}>
              {t('title')}
            </Title>
            <div style={{ color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{t('description')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              <Button ghost icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()} style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.55)' }}>
                {t('refresh')}
              </Button>
              {dataUpdatedAt > 0 && (
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                  {t('updatedAt', { time: new Date(dataUpdatedAt).toLocaleTimeString(i18n.language) })}
                </span>
              )}
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{t('paletteHint', { key: paletteShortcut() })}</span>
            </div>
          </div>
          {o && (
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[
                { label: t('hero.portUsage'), node: <><CountUp value={o.ports.usageRate} decimals={1} />%</> },
                { label: t('hero.cablesInUse'), node: <CountUp value={o.cables.IN_USE} /> },
                { label: t('hero.workstationsOnline'), node: <><CountUp value={o.workstations.online} /><span style={{ fontSize: 16, opacity: 0.6 }}> / {o.workstations.total}</span></> },
              ].map((h) => (
                <div key={h.label}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{h.label}</div>
                  <div style={{ fontSize: 30, fontWeight: 650, letterSpacing: -0.5 }}>{h.node}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {isLoading
          ? Array.from({ length: 8 }, (_, i) => (
              <Col key={i} xs={12} md={8} lg={6} xxl={3}>
                <Card styles={{ body: { padding: 18 } }}>
                  <Skeleton active paragraph={{ rows: 1 }} />
                </Card>
              </Col>
            ))
          : stats.map((s, i) => (
              <Col key={s.testId} xs={12} md={8} lg={6} xxl={3}>
                <StatCard index={i + 1} {...s} />
              </Col>
            ))}
      </Row>

      {o && (
        <>
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={8}>
              <Card title={t('cards.ports')} className="dash-rise" style={card(9)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <Donut
                    segments={portSegments}
                    track={token.colorFillTertiary}
                    center={
                      <>
                        <div style={{ fontSize: 26, fontWeight: 650 }}>
                          <CountUp value={o.ports.usageRate} decimals={1} />%
                        </div>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {t('ports.usage')}
                        </Text>
                      </>
                    }
                  />
                  <div style={{ flex: 1, minWidth: 120 }}>
                    {[
                      { key: 'connected', color: series[0], label: t('ports.connected'), value: o.ports.connected },
                      { key: 'free', color: token.colorFillSecondary, label: t('ports.free'), value: o.ports.free },
                      { key: 'reserved', color: null, label: t('ports.reserved'), value: o.ports.reserved },
                      { key: 'faulty', color: null, label: t('ports.faulty'), value: o.ports.faulty },
                    ].map((r) => (
                      <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color ?? 'transparent', border: r.color ? undefined : `1px solid ${token.colorBorder}` }} />
                        <Text type="secondary" style={{ flex: 1 }}>
                          {r.label}
                        </Text>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title={t('cards.deviceTypes')} className="dash-rise" style={card(10)}>
                {deviceBars.length ? <BarList items={deviceBars} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('emptyState')} />}
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title={t('cards.inventory')} className="dash-rise" style={card(11)}>
                <Text strong>{t('inventory.cables')}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {cableTotal}
                </Text>
                <div style={{ margin: '10px 0 22px' }}>
                  <StackBar parts={CABLE_STATES.map((s, i) => ({ key: s, label: t(`cableStatus.${s}`), value: o.cables[s], color: series[i] }))} />
                </div>
                <Text strong>{t('inventory.opticalModules')}</Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  {o.counts.opticalModules}
                </Text>
                <div style={{ marginTop: 10 }}>
                  <StackBar parts={MODULE_STATUSES.map((s, i) => ({ key: s, label: tModule(`moduleStatus.${s}`), value: o.opticalModules[s], color: series[i + 2] }))} />
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={12}>
              <Card
                title={t('cards.subnets')}
                className="dash-rise"
                style={card(12)}
                extra={<a onClick={() => navigate(paths.ipManagement())}><ArrowRightOutlined /></a>}
              >
                {subnetBars.length ? (
                  <>
                    <BarList items={subnetBars} />
                    {subnets.length > SUBNETS_SHOWN && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('subnets.more', { count: subnets.length - SUBNETS_SHOWN })}
                      </Text>
                    )}
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('subnets.empty')} />
                )}
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <Card title={t('cards.health')} className="dash-rise" style={card(13)}>
                <HealthRow ok={o.labelsMissing === 0} label={t('health.labelsMissing')} value={o.labelsMissing} onClick={() => navigate(paths.labels())} />
                <HealthRow ok={o.labelsToPrint === 0} label={t('health.labelsToPrint')} value={o.labelsToPrint} onClick={() => navigate(paths.labels())} />
                <HealthRow ok={o.observationUnmatched === 0} label={t('health.observationUnmatched')} value={o.observationUnmatched} onClick={() => navigate(paths.observability())} />
              </Card>
            </Col>
            <Col xs={24} md={12} lg={6}>
              <div
                className="dash-3d dash-rise"
                style={rise(14)}
                role="link"
                tabIndex={0}
                onClick={() => navigate(paths.datacenter3d())}
                onKeyDown={(e) => e.key === 'Enter' && navigate(paths.datacenter3d())}
                data-testid="dashboard-3d-entry"
              >
                <RackArt />
                <div style={{ position: 'relative', zIndex: 1, maxWidth: '75%' }}>
                  <div style={{ fontSize: 18, fontWeight: 650 }}>{t('datacenter3d.title')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 6 }}>{t('datacenter3d.description')}</div>
                  <Button type="primary" icon={<ArrowRightOutlined />} iconPosition="end" style={{ marginTop: 18, whiteSpace: 'nowrap' }}>
                    {t('datacenter3d.enter')}
                  </Button>
                </div>
              </div>
            </Col>
          </Row>

          <Card title={t('cards.recentDevices')} className="dash-rise" style={{ marginTop: 16, ...rise(15) }}>
            <Table
              size="small"
              rowKey="id"
              pagination={false}
              columns={deviceColumns}
              dataSource={o.recentDevices}
              locale={{ emptyText: t('emptyState') }}
              scroll={{ x: true }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
