import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Form,
  Input,
  Row,
  Segmented,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DeviceDto } from '@contracts/devices';
import type { RoomDto } from '@contracts/hierarchy';
import type {
  FlowEndpoint,
  FlowStatus,
  GrowthFindingDto,
  PortFinding,
  PortObservationDto,
  SeatDto,
  SwitchSnapshotResult,
  SwitchSummary,
  TopFlowRow,
  UnmatchedDto,
} from '@contracts/observability';
import { shortIfName } from '@contracts/ifName';
import { roomService } from '@/services/hierarchyService';
import { deviceService } from '@/services/deviceService';
import { observabilityService } from '@/services/observabilityService';
import { PortPicker } from '@/components/PortPicker';
import { formatBps, formatBytes, trafficBorderWidth } from '@/utils/observabilityFormat';

const { Title, Text } = Typography;
const { TextArea } = Input;

const SEAT_REFRESH_MS = 10000;
const SEAT_ROOM_KEY = 'observability-seat-room';

function readSeatRoom(): string | null {
  try {
    return localStorage.getItem(SEAT_ROOM_KEY);
  } catch {
    return null;
  }
}

function writeSeatRoom(id: string) {
  try {
    localStorage.setItem(SEAT_ROOM_KEY, id);
  } catch {
    // per-viewer convenience only
  }
}
const PX_PER_METER = 56;
// 交换机色条，按名字排序后依次取色
const SWITCH_PALETTE = ['#1677ff', '#fa8c16', '#722ed1', '#13c2c2', '#eb2f96', '#a0d911', '#2f54eb', '#faad14'];
const FLOW_REFRESH_MS = 5000;

type SeatStatus = 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'FAULTY' | 'RETIRED';
const STATUS_COLORS: Record<SeatStatus, string> = {
  ONLINE: '#52c41a',
  OFFLINE: '#d9d9d9',
  MAINTENANCE: '#faad14',
  FAULTY: '#ff4d4f',
  RETIRED: '#8c8c8c',
};
const seatStatus = (s: SeatDto): SeatStatus => (s.adminState !== 'ACTIVE' ? s.adminState : s.online ? 'ONLINE' : 'OFFLINE');
const seatSwitch = (s: SeatDto) => (s.attachedPort ? s.attachedPort.sysname ?? s.attachedPort.deviceName : null);
const seatPort = (s: SeatDto) => (s.attachedPort ? shortIfName(s.attachedPort.ifName ?? s.attachedPort.number) : null);
type Finding = PortFinding | GrowthFindingDto;

// 定时刷新：enabled 为 false 时不跑
function useInterval(fn: () => void, ms: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(fn, ms);
    return () => window.clearInterval(timer);
  }, [fn, ms, enabled]);
}

function SeatCard({ seat: s, style, stripe }: { seat: SeatDto; style: React.CSSProperties; stripe?: string }) {
  const { t } = useTranslation('observability');
  const bps = s.traffic.inBps + s.traffic.outBps;
  return (
    <Tooltip
      title={
        <div>
          <div>{s.name}</div>
          <div>{s.ip?.address}</div>
          <div>{t('seats.switchPort')}: {s.attachedPort ? `${seatSwitch(s)} ${seatPort(s)}` : '-'}</div>
          <div>{t('seats.traffic')}: {formatBps(s.traffic.inBps)} / {formatBps(s.traffic.outBps)}</div>
          <div>{t('seats.lastSeen')}: {s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString() : '-'}</div>
        </div>
      }
    >
      <div
        data-testid={`seat-${s.name}`}
        style={{
          boxSizing: 'border-box',
          padding: '2px 4px',
          borderRadius: 4,
          background: STATUS_COLORS[seatStatus(s)],
          border: `${trafficBorderWidth(bps)}px solid ${bps > 0 ? '#1677ff' : '#bfbfbf'}`,
          borderTop: stripe ? `4px solid ${stripe}` : undefined,
          fontSize: 11,
          lineHeight: '14px',
          overflow: 'hidden',
          ...style,
        }}
      >
        <div style={{ fontWeight: 600 }}>{s.name.replace(/^C\d+[A-Z]?-/, '')}</div>
        {/* 卡片窄，只显示口号（GE0/0/11 显示 11），完整信息在悬停提示里 */}
        <div style={{ color: '#595959', whiteSpace: 'nowrap' }}>{seatPort(s)?.split('/').pop() ?? '-'}</div>
      </div>
    </Tooltip>
  );
}

// Drawn from the real seat layout: workstation fpX/fpY in metres; the top stripe is the switch it is wired to
function SeatLayout({ seats, room }: { seats: SeatDto[]; room?: RoomDto }) {
  const { t } = useTranslation('observability');
  const placed = seats.filter((s) => s.fpX !== null && s.fpY !== null);
  const switches = [...new Set(placed.map((s) => seatSwitch(s) ?? ''))].sort();
  const colorOf = (name: string | null) => (name ? SWITCH_PALETTE[switches.indexOf(name) % SWITCH_PALETTE.length] : '#8c8c8c');
  const width = (room?.widthM ?? Math.max(...placed.map((s) => s.fpX! + 1))) * PX_PER_METER;
  const height = (room?.depthM ?? Math.max(...placed.map((s) => s.fpY! + 1))) * PX_PER_METER;
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap>
        {switches.map((name) => (
          <Tag key={name || 'none'} color={colorOf(name || null)}>
            {name || t('seats.unlocated')}
          </Tag>
        ))}
      </Space>
      <div style={{ overflowX: 'auto' }}>
        <div
          data-testid="observability-seat-layout"
          style={{ position: 'relative', width, height, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8 }}
        >
          <div style={{ position: 'absolute', left: 0, right: 0, top: 4, textAlign: 'center', color: '#8c8c8c', fontSize: 12 }}>
            {t('seats.front')}
          </div>
          {placed.map((s) => (
            <SeatCard
              key={s.id}
              seat={s}
              stripe={colorOf(seatSwitch(s))}
              style={{
                position: 'absolute',
                left: s.fpX! * PX_PER_METER,
                top: s.fpY! * PX_PER_METER,
                width: (s.fpW ?? 0.7) * PX_PER_METER,
                height: (s.fpD ?? 0.6) * PX_PER_METER,
              }}
            />
          ))}
        </div>
      </div>
    </Space>
  );
}

function SeatsTab() {
  const { t } = useTranslation('observability');
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [roomId, setRoomId] = useState<string>();
  const [seats, setSeats] = useState<SeatDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);
  const [view, setView] = useState<'layout' | 'switch'>('layout');

  useEffect(() => {
    roomService.list().then(
      (list) => {
        setRooms(list);
        // the last room this viewer looked at, else the first room with a seat layout, else one with workstations
        const remembered = list.find((r) => r.id === readSeatRoom());
        const first = remembered ?? list.find((r) => r.seatLayoutCount > 0) ?? list.find((r) => r.workstationCount > 0) ?? list[0];
        if (first) setRoomId(first.id);
      },
      () => undefined,
    );
  }, []);

  useEffect(() => {
    if (roomId) writeSeatRoom(roomId);
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      setSeats(await observabilityService.seatMap({ roomId }));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);
  useInterval(load, SEAT_REFRESH_MS, auto);

  const groups = useMemo(() => {
    const map = new Map<string, SeatDto[]>();
    for (const s of seats) {
      const key = seatSwitch(s) ?? '';
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  }, [seats]);

  const online = seats.filter((s) => s.online).length;
  const hasLayout = seats.some((s) => s.fpX !== null);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }} data-testid="observability-seats">
      <Space wrap>
        <Text>{t('seats.room')}</Text>
        <Select
          style={{ width: 200 }}
          placeholder={t('seats.selectRoom')}
          value={roomId}
          onChange={setRoomId}
          options={rooms.map((r) => ({ value: r.id, label: r.name }))}
          data-testid="observability-room-select"
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          {t('common.refresh')}
        </Button>
        <Space>
          <Switch checked={auto} onChange={setAuto} size="small" />
          <Text>{t('common.autoRefresh')}</Text>
        </Space>
        <Segmented
          value={view}
          onChange={(v) => setView(v as 'layout' | 'switch')}
          options={[
            { value: 'layout', label: t('seats.byLayout') },
            { value: 'switch', label: t('seats.bySwitch') },
          ]}
        />
        <Tag color="green">{t('seats.online')} {online}</Tag>
        <Tag>{t('seats.offline')} {seats.length - online}</Tag>
      </Space>
      <Text type="secondary">{t(view === 'layout' ? 'seats.layoutLegend' : 'seats.legend')}</Text>
      {seats.length > 0 && view === 'layout' && !hasLayout && (
        <Alert type="info" showIcon message={t('seats.noLayout')} data-testid="observability-no-layout" />
      )}
      {seats.length > 0 && !seats.some((s) => s.attachedPort) && (
        <Alert type="info" showIcon message={t('seats.noWiring')} data-testid="observability-no-wiring" />
      )}
      {seats.length === 0 ? (
        <Empty description={t('common.empty')} />
      ) : view === 'layout' && hasLayout ? (
        <SeatLayout seats={seats} room={rooms.find((r) => r.id === roomId)} />
      ) : (
        groups.map(([switchName, list]) => (
          <Card key={switchName || 'none'} size="small" title={switchName || t('seats.unlocated')}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {list.map((s) => (
                <SeatCard key={s.id} seat={s} style={{ width: 92 }} />
              ))}
            </div>
          </Card>
        ))
      )}
    </Space>
  );
}

function endpointLabel(ip: string, ep: FlowEndpoint | null) {
  if (!ep) return <Text code>{ip}</Text>;
  return (
    <Tooltip title={[ip, ep.location].filter(Boolean).join(' / ')}>
      <span>
        {ep.name} <Text type="secondary">({ip})</Text>
      </span>
    </Tooltip>
  );
}

function FlowsTab() {
  const { t } = useTranslation('observability');
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [sampler, setSampler] = useState<string>('');
  const [limit, setLimit] = useState(20);
  const [rows, setRows] = useState<TopFlowRow[]>([]);
  const [status, setStatus] = useState<FlowStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [auto, setAuto] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [top, st] = await Promise.all([
        observabilityService.topFlows({ windowSeconds, limit, sampler: sampler || undefined }),
        observabilityService.flowStatus(),
      ]);
      setRows(top);
      setStatus(st);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [windowSeconds, limit, sampler]);

  useEffect(() => {
    load();
  }, [load]);
  useInterval(load, FLOW_REFRESH_MS, auto);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }} data-testid="observability-flows">
      <Space wrap>
        <Text>{t('flows.window')}</Text>
        <Select
          style={{ width: 110 }}
          value={windowSeconds}
          onChange={setWindowSeconds}
          options={[10, 60, 300, 900, 3600].map((s) => ({ value: s, label: s < 60 ? `${s}s` : `${s / 60}min` }))}
        />
        <Text>{t('flows.sampler')}</Text>
        <Select
          style={{ width: 170 }}
          value={sampler}
          onChange={setSampler}
          options={[{ value: '', label: t('flows.allSamplers') }, ...(status?.samplers ?? []).map((s) => ({ value: s, label: s }))]}
        />
        <Text>{t('flows.limit')}</Text>
        <Select style={{ width: 80 }} value={limit} onChange={setLimit} options={[10, 20, 50, 100].map((n) => ({ value: n, label: n }))} />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
          {t('common.refresh')}
        </Button>
        <Space>
          <Switch checked={auto} onChange={setAuto} size="small" />
          <Text>{t('common.autoRefresh')}</Text>
        </Space>
        <Text type="secondary">
          {t('flows.buffered')}: {status?.buffered ?? 0}
        </Text>
      </Space>
      <Text type="secondary">{t('flows.hint')}</Text>
      <Table<TopFlowRow>
        size="small"
        rowKey={(r) => `${r.src}|${r.dst}|${r.proto}|${r.dstPort}`}
        dataSource={rows}
        pagination={false}
        locale={{ emptyText: t('common.empty') }}
        columns={[
          { title: t('flows.source'), render: (_, r) => endpointLabel(r.src, r.srcEndpoint) },
          { title: t('flows.destination'), render: (_, r) => endpointLabel(r.dst, r.dstEndpoint) },
          { title: t('flows.protocol'), width: 120, render: (_, r) => `${r.proto}/${r.dstPort}` },
          { title: t('flows.bytes'), width: 110, align: 'right', render: (_, r) => formatBytes(r.bytes) },
          { title: t('flows.rate'), width: 120, align: 'right', render: (_, r) => formatBps(r.bitsPerSecond) },
          { title: t('flows.records'), width: 90, align: 'right', dataIndex: 'records' },
        ]}
      />
    </Space>
  );
}

function PortsTab() {
  const { t } = useTranslation('observability');
  const [form] = Form.useForm();
  const [result, setResult] = useState<SwitchSnapshotResult | null>(null);
  const [switches, setSwitches] = useState<SwitchSummary[]>([]);
  const [history, setHistory] = useState<{ title: string; rows: PortObservationDto[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadSwitches = useCallback(async () => {
    try {
      setSwitches(await observabilityService.listSwitches());
    } catch {
      // reported by rpc
    }
  }, []);

  useEffect(() => {
    loadSwitches();
  }, [loadSwitches]);

  const analyze = async () => {
    const values = await form.validateFields();
    setLoading(true);
    try {
      const res = await observabilityService.snapshot({
        sysname: values.sysname.trim(),
        interfaceBrief: values.interfaceBrief || undefined,
        transceiver: values.transceiver || undefined,
        save: values.save,
      });
      setResult(res);
      setHistory(null);
      if (res.saved > 0) {
        message.success(t('ports.saved', { count: res.saved }));
        loadSwitches();
      }
      if (res.unmatched > 0) message.warning(t('ports.unmatched', { sysname: res.sysname, count: res.unmatched }));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  };

  const showHistory = async (deviceId: string | null, title: string, ifName: string) => {
    if (!deviceId) {
      message.info(t('ports.noDevice'));
      return;
    }
    try {
      const rows = await observabilityService.portHistory({ deviceId, ifName, limit: 50 });
      setHistory({ title: `${title} ${shortIfName(ifName)}`, rows });
    } catch {
      // reported by rpc
    }
  };

  const severityTag = (s: Finding['severity']) => (
    <Tag color={s === 'critical' ? 'red' : 'orange'}>{t(`ports.${s}`)}</Tag>
  );

  return (
    <Row gutter={16} data-testid="observability-ports">
      <Col xs={24} lg={10}>
        <Form name="observability-page-form" form={form} layout="vertical" initialValues={{ save: true }}>
          <Form.Item name="sysname" label={t('ports.switchName')} rules={[{ required: true }]}>
            <Input placeholder={t('ports.switchNamePlaceholder')} data-testid="observability-switch-name" />
          </Form.Item>
          <Form.Item name="interfaceBrief" label={t('ports.interfaceBrief')}>
            <TextArea rows={8} style={{ fontFamily: 'monospace', fontSize: 12 }} data-testid="observability-brief" />
          </Form.Item>
          <Form.Item name="transceiver" label={t('ports.transceiver')}>
            <TextArea rows={6} style={{ fontFamily: 'monospace', fontSize: 12 }} data-testid="observability-transceiver" />
          </Form.Item>
          <Form.Item name="save" valuePropName="checked">
            <Checkbox>{t('ports.save')}</Checkbox>
          </Form.Item>
          <Button type="primary" onClick={analyze} loading={loading} data-testid="observability-analyze">
            {t('ports.analyze')}
          </Button>
        </Form>
        <Card size="small" title={t('ports.switches')} style={{ marginTop: 16 }}>
          <Table<SwitchSummary>
            size="small"
            rowKey="deviceId"
            dataSource={switches}
            pagination={false}
            locale={{ emptyText: t('common.empty') }}
            columns={[
              { title: t('ports.switchName'), render: (_, r) => r.sysname ?? r.deviceName },
              { title: t('ports.lastCollected'), render: (_, r) => (r.lastCollectedAt ? new Date(r.lastCollectedAt).toLocaleString() : '-') },
              { title: t('ports.observations'), dataIndex: 'observations', align: 'right' },
            ]}
          />
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        {result && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small" title={`${t('ports.findings')} - ${result.sysname}`}>
              {result.findings.length === 0 ? (
                <Alert type="success" showIcon message={t('ports.noFindings')} />
              ) : (
                <Table<Finding>
                  size="small"
                  rowKey={(r) => `${r.interface}|${r.kind}`}
                  dataSource={result.findings}
                  pagination={false}
                  data-testid="observability-findings"
                  columns={[
                    { title: t('ports.severity'), width: 80, render: (_, r) => severityTag(r.severity) },
                    {
                      title: t('ports.interfaces'),
                      width: 110,
                      render: (_, r) => <a onClick={() => showHistory(result.deviceId, result.sysname, r.interface)}>{r.shortName}</a>,
                    },
                    { title: t('ports.kind'), width: 100, render: (_, r) => t(`ports.kinds.${r.kind}`) },
                    { title: t('ports.value'), width: 90, align: 'right', dataIndex: 'value' },
                    { title: t('ports.margin'), width: 90, align: 'right', render: (_, r) => ('marginDb' in r ? r.marginDb ?? '-' : '-') },
                    { title: t('ports.message'), dataIndex: 'message' },
                  ]}
                />
              )}
            </Card>
            {history && (
              <Card size="small" title={`${t('ports.history')} - ${history.title}`}>
                <Table<PortObservationDto>
                  size="small"
                  rowKey="id"
                  dataSource={history.rows}
                  pagination={false}
                  columns={[
                    { title: t('ports.lastCollected'), render: (_, r) => new Date(r.collectedAt).toLocaleString() },
                    { title: t('ports.inErrors'), dataIndex: 'inErrors', align: 'right' },
                    { title: t('ports.outErrors'), dataIndex: 'outErrors', align: 'right' },
                    { title: 'Rx(dBm)', dataIndex: 'rxPowerDbm', align: 'right' },
                    { title: 'Tx(dBm)', dataIndex: 'txPowerDbm', align: 'right' },
                  ]}
                />
              </Card>
            )}
            {result.interfaces.length > 0 && (
              <Card size="small" title={t('ports.interfaces')}>
                <Table
                  size="small"
                  rowKey="interface"
                  // 只看起来的物理口，NULL0 / Vlanif 这些逻辑接口没有意义
                  dataSource={result.interfaces.filter((r) => r.phy.includes('up') && /Ethernet|GE/.test(r.interface))}
                  pagination={{ pageSize: 20 }}
                  columns={[
                    {
                      title: t('ports.interfaces'),
                      render: (_, r) => <a onClick={() => showHistory(result.deviceId, result.sysname, r.interface)}>{r.shortName}</a>,
                    },
                    { title: t('ports.phy'), dataIndex: 'phy' },
                    { title: t('ports.inUtil'), align: 'right', render: (_, r) => (r.inUtilPercent === null ? '-' : `${r.inUtilPercent}%`) },
                    { title: t('ports.outUtil'), align: 'right', render: (_, r) => (r.outUtilPercent === null ? '-' : `${r.outUtilPercent}%`) },
                    { title: t('ports.inErrors'), dataIndex: 'inErrors', align: 'right' },
                    { title: t('ports.outErrors'), dataIndex: 'outErrors', align: 'right' },
                  ]}
                />
              </Card>
            )}
          </Space>
        )}
      </Col>
    </Row>
  );
}

function UnmatchedTab() {
  const { t } = useTranslation('observability');
  const [rows, setRows] = useState<UnmatchedDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ current: 1, pageSize: 50 });
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [resolving, setResolving] = useState<UnmatchedDto | null>(null);
  const [target, setTarget] = useState<{ deviceId?: string; portId?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await observabilityService.unmatched.list({ take: page.pageSize, skip: (page.current - 1) * page.pageSize });
      setRows(r.items);
      setTotal(r.total);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    deviceService.list({ type: 'SWITCH' }).then(setDevices, () => undefined);
  }, []);

  const resolve = async () => {
    if (!resolving) return;
    try {
      await observabilityService.unmatched.resolve({ id: resolving.id, ...target });
      message.success(t('unmatched.resolved'));
      setResolving(null);
      load();
    } catch {
      // reported by rpc
    }
  };

  return (
    <>
      <Table<UnmatchedDto>
        size="small"
        rowKey="id"
        loading={loading}
        dataSource={rows}
        locale={{ emptyText: t('common.empty') }}
        pagination={{ ...page, total, onChange: (current, pageSize) => setPage({ current, pageSize }) }}
        columns={[
          { title: t('unmatched.source'), width: 140, render: (_, r) => <Tag>{t(`unmatched.sources.${r.source}`)}</Tag> },
          { title: t('unmatched.sysname'), dataIndex: 'sysname' },
          { title: t('unmatched.ifName'), render: (_, r) => r.ifName ?? '-' },
          { title: t('unmatched.workstation'), render: (_, r) => r.workstationName ?? '-' },
          { title: t('unmatched.createdAt'), render: (_, r) => new Date(r.createdAt).toLocaleString() },
          {
            title: '',
            width: 90,
            render: (_, r) => (
              <Button
                size="small"
                onClick={() => {
                  setTarget({});
                  setResolving(r);
                }}
              >
                {t('unmatched.resolve')}
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={t('unmatched.resolveTitle')}
        open={!!resolving}
        onOk={resolve}
        onCancel={() => setResolving(null)}
        okButtonProps={{ disabled: resolving?.source === 'WORKSTATION_ATTACH' ? !target.portId : !target.deviceId }}
        width={720}
        destroyOnHidden
      >
        {resolving?.source === 'WORKSTATION_ATTACH' ? (
          <PortPicker value={target.portId} onChange={(portId) => setTarget({ portId })} testIdPrefix="unmatched-port" />
        ) : (
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 300 }}
            placeholder={t('unmatched.device')}
            value={target.deviceId}
            onChange={(deviceId: string) => setTarget({ deviceId })}
            options={devices.map((d) => ({ value: d.id, label: d.sysname ? `${d.sysname} (${d.name})` : d.name }))}
          />
        )}
      </Modal>
    </>
  );
}

export default function ObservabilityPage() {
  const { t } = useTranslation('observability');
  return (
    <div>
      <Title level={3} style={{ marginTop: 0 }}>
        {t('title')}
      </Title>
      <Text type="secondary">{t('description')}</Text>
      <Tabs
        style={{ marginTop: 16 }}
        destroyOnHidden
        items={[
          { key: 'seats', label: t('tabs.seats'), children: <SeatsTab /> },
          { key: 'flows', label: t('tabs.flows'), children: <FlowsTab /> },
          { key: 'ports', label: t('tabs.ports'), children: <PortsTab /> },
          { key: 'unmatched', label: t('tabs.unmatched'), children: <UnmatchedTab /> },
        ]}
      />
    </div>
  );
}
