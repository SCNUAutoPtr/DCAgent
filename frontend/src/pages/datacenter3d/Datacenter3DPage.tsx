import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Drawer, Empty, List, Progress, Result, Segmented, Select, Space, Spin, Switch, Tag, Tooltip, Typography } from 'antd';
import { AimOutlined, ExportOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { CableMedium, DeviceType } from '@contracts/enums';
import type { RoomScene, SceneCabinet, SceneDevice } from '@contracts/scene';
import { useRoomList, useRoomScene } from '@/api/hooks/rooms';
import { paths } from '@/routes';
import { DEVICE_TYPE_COLORS, MEDIUM_COLORS, deviceColor, occupancyColor, portUsage, uUsage, type ColorMode } from './layout';
import { useUText } from './useUText';
import './Datacenter3DPage.css';

const RoomScene3D = lazy(() => import('./RoomScene3D'));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const ok = gl !== null;
    (gl as WebGLRenderingContext | null)?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

/** Context creation can still fail after the probe (GPU blocklist, too many contexts): show the same fallback. */
class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Datacenter3DPage() {
  const { t } = useTranslation(['datacenter3d', 'device', 'cable', 'common']);
  const navigate = useNavigate();
  const { roomId = null, cabinetId = null } = useParams();
  const rooms = useRoomList();
  const scene = useRoomScene(roomId);
  const [colorMode, setColorMode] = useState<ColorMode>('type');
  const [showCables, setShowCables] = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const webgl = useMemo(webglAvailable, []);

  // no room in the path: open the first one
  useEffect(() => {
    if (!roomId && rooms.data?.length) navigate(paths.datacenter3d(rooms.data[0].id), { replace: true });
  }, [roomId, rooms.data, navigate]);

  useEffect(() => setSelectedDeviceId(null), [roomId]);

  const data = scene.data;
  const cabinet = data?.cabinets.find((c) => c.id === cabinetId) ?? null;
  const selectCabinet = (id: string | null) => {
    if (!roomId) return;
    if (id === null) setSelectedDeviceId(null);
    navigate(paths.datacenter3d(roomId, id ?? undefined));
  };
  const selectDevice = (deviceId: string, cabId: string) => {
    setSelectedDeviceId(deviceId);
    if (cabId !== cabinetId) selectCabinet(cabId);
  };

  const roomOptions = useMemo(() => {
    const groups = new Map<string, { label: string; options: { value: string; label: string }[] }>();
    for (const r of rooms.data ?? []) {
      const g = groups.get(r.dataCenterId) ?? { label: r.dataCenterName, options: [] };
      g.options.push({ value: r.id, label: r.name });
      groups.set(r.dataCenterId, g);
    }
    return [...groups.values()];
  }, [rooms.data]);

  const fallback = (
    <Result
      status="warning"
      title={t('webgl.title')}
      subTitle={t('webgl.description')}
      extra={roomId && <Button onClick={() => navigate(paths.room(roomId))}>{t('webgl.openRoom')}</Button>}
    />
  );

  return (
    <div className="dc3d-page">
      <div className="dc3d-toolbar">
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {t('title')}
          </Typography.Title>
          <Typography.Text type="secondary">{t('description')}</Typography.Text>
        </div>
        <Space wrap>
          <Select
            style={{ minWidth: 240 }}
            placeholder={t('roomPlaceholder')}
            loading={rooms.isLoading}
            value={roomId ?? undefined}
            options={roomOptions}
            showSearch
            optionFilterProp="label"
            onChange={(id: string) => navigate(paths.datacenter3d(id))}
          />
          <Segmented<ColorMode>
            value={colorMode}
            onChange={setColorMode}
            options={[
              { value: 'type', label: t('controls.colorType') },
              { value: 'occupancy', label: t('controls.colorOccupancy') },
            ]}
          />
          <Space size={4}>
            <Switch size="small" checked={showCables} onChange={setShowCables} />
            <span>{t('controls.cables')}</span>
          </Space>
          <Button icon={<ReloadOutlined />} onClick={() => (cabinetId ? selectCabinet(null) : setResetToken((n) => n + 1))}>
            {t('controls.resetView')}
          </Button>
          {roomId && (
            <Button icon={<HomeOutlined />} onClick={() => navigate(paths.room(roomId))}>
              {t('controls.openRoom')}
            </Button>
          )}
        </Space>
      </div>

      <div className="dc3d-stage">
        {!webgl ? (
          fallback
        ) : rooms.data && rooms.data.length === 0 ? (
          <Empty className="dc3d-center" description={t('noRooms')} />
        ) : scene.isError ? (
          <Result status="error" title={t('loadFailed')} extra={<Button onClick={() => scene.refetch()}>{t('retry')}</Button>} />
        ) : !data ? (
          <Spin className="dc3d-center" />
        ) : (
          <>
            <SceneBoundary fallback={fallback}>
              <Suspense fallback={<Spin className="dc3d-center" />}>
                <RoomScene3D
                  scene={data}
                  colorMode={colorMode}
                  showCables={showCables}
                  selectedCabinetId={cabinet?.id ?? null}
                  selectedDeviceId={selectedDeviceId}
                  resetToken={resetToken}
                  onSelectCabinet={selectCabinet}
                  onSelectDevice={selectDevice}
                />
              </Suspense>
            </SceneBoundary>
            <SceneStats scene={data} />
            <Legend colorMode={colorMode} showCables={showCables} scene={data} />
          </>
        )}
      </div>

      <CabinetDrawer
        cabinet={cabinet}
        colorMode={colorMode}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={(id) => cabinet && selectDevice(id, cabinet.id)}
        onClose={() => selectCabinet(null)}
      />
    </div>
  );
}

function SceneStats({ scene }: { scene: RoomScene }) {
  const { t } = useTranslation('datacenter3d');
  const devices = scene.cabinets.reduce((s, c) => s + c.devices.length, 0) + scene.looseDevices.length;
  const autoPlaced = scene.cabinets.filter((c) => c.fpX == null || c.fpY == null).length;
  const online = scene.workstations.filter((w) => w.online).length;
  return (
    <div className="dc3d-overlay dc3d-stats">
      <div className="dc3d-stats-row">
        <span>{t('stats.cabinets', { count: scene.cabinets.length })}</span>
        <span>{t('stats.devices', { count: devices })}</span>
        <span>{t('stats.links', { count: scene.links.length })}</span>
        {scene.workstations.length > 0 && <span>{t('stats.workstations', { online, count: scene.workstations.length })}</span>}
      </div>
      {scene.externalLinkCount > 0 && <div className="dc3d-stats-note">{t('stats.externalLinks', { count: scene.externalLinkCount })}</div>}
      {scene.looseDevices.length > 0 && <div className="dc3d-stats-note">{t('stats.looseDevices', { count: scene.looseDevices.length })}</div>}
      {autoPlaced > 0 && <div className="dc3d-stats-note">{t('stats.autoPlaced', { count: autoPlaced })}</div>}
    </div>
  );
}

function Legend({ colorMode, showCables, scene }: { colorMode: ColorMode; showCables: boolean; scene: RoomScene }) {
  const { t } = useTranslation(['datacenter3d', 'device', 'cable']);
  const types = useMemo(() => {
    const present = new Set<DeviceType>([...scene.cabinets.flatMap((c) => c.devices), ...scene.looseDevices].map((d) => d.type));
    return (Object.keys(DEVICE_TYPE_COLORS) as DeviceType[]).filter((k) => present.has(k));
  }, [scene]);
  const media = useMemo(() => [...new Set<CableMedium>(scene.links.map((l) => l.medium))], [scene.links]);
  return (
    <div className="dc3d-overlay dc3d-legend">
      {colorMode === 'type' ? (
        <>
          <div className="dc3d-legend-title">{t('legend.type')}</div>
          {types.map((k) => (
            <div key={k} className="dc3d-legend-item">
              <i style={{ background: DEVICE_TYPE_COLORS[k] }} />
              {t(`device:deviceTypes.${k}`)}
            </div>
          ))}
        </>
      ) : (
        <>
          <div className="dc3d-legend-title">{t('legend.occupancy')}</div>
          <div className="dc3d-legend-ramp" style={{ background: `linear-gradient(90deg, ${occupancyColor(0)}, ${occupancyColor(0.5)}, ${occupancyColor(1)})` }} />
          <div className="dc3d-legend-ramp-labels">
            <span>{t('legend.idle')}</span>
            <span>{t('legend.full')}</span>
          </div>
          <div className="dc3d-legend-item">
            <i style={{ background: occupancyColor(null) }} />
            {t('legend.noPorts')}
          </div>
        </>
      )}
      {showCables && media.length > 0 && (
        <>
          <div className="dc3d-legend-title">{t('legend.cables')}</div>
          {media.map((m) => (
            <div key={m} className="dc3d-legend-item">
              <i className="dc3d-legend-line" style={{ background: MEDIUM_COLORS[m] }} />
              {t(`cable:media.${m}`)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

interface DrawerProps {
  cabinet: SceneCabinet | null;
  colorMode: ColorMode;
  selectedDeviceId: string | null;
  onSelectDevice: (id: string) => void;
  onClose: () => void;
}

const byUDesc = (a: SceneDevice, b: SceneDevice) => (b.uPosition ?? -1) - (a.uPosition ?? -1);

function CabinetDrawer({ cabinet, colorMode, selectedDeviceId, onSelectDevice, onClose }: DrawerProps) {
  const uText = useUText();
  const { t } = useTranslation(['datacenter3d', 'device']);
  const auto = cabinet !== null && (cabinet.fpX == null || cabinet.fpY == null);
  const usage = cabinet ? uUsage(cabinet) : null;
  return (
    <Drawer
      open={cabinet !== null}
      onClose={onClose}
      mask={false}
      width={420}
      title={
        cabinet && (
          <Space>
            {cabinet.name}
            {cabinet.label && <Tag>{cabinet.label.shortId}</Tag>}
          </Space>
        )
      }
      extra={
        cabinet && (
          <Link to={paths.cabinet(cabinet.id)}>
            <Button size="small" icon={<ExportOutlined />}>
              {t('drawer.openCabinet')}
            </Button>
          </Link>
        )
      }
    >
      {cabinet && usage && (
        <>
          {auto && <Alert type="info" showIcon message={t('drawer.autoPlaced')} style={{ marginBottom: 12 }} />}
          <div className="dc3d-drawer-usage">
            <span>{t('drawer.uUsage', { used: usage.used, total: usage.total })}</span>
            <Progress percent={Math.round(usage.ratio * 100)} size="small" strokeColor={occupancyColor(usage.ratio)} />
          </div>
          <Typography.Title level={5}>{t('drawer.devices')}</Typography.Title>
          <List
            size="small"
            dataSource={[...cabinet.devices].sort(byUDesc)}
            locale={{ emptyText: t('drawer.noDevices') }}
            renderItem={(d) => {
              const ports = portUsage(d);
              const selected = d.id === selectedDeviceId;
              return (
                <List.Item
                  className={`dc3d-device-item${selected ? ' is-selected' : ''}`}
                  onClick={() => onSelectDevice(d.id)}
                  actions={[
                    <Tooltip key="hl" title={t('drawer.highlight')}>
                      <Button type="text" size="small" icon={<AimOutlined />} onClick={() => onSelectDevice(d.id)} />
                    </Tooltip>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<i className="dc3d-swatch" style={{ background: deviceColor(d, colorMode) }} />}
                    title={
                      <Space size={6} wrap>
                        <span>{d.name}</span>
                        <Tag>{t(`device:deviceTypes.${d.type}`)}</Tag>
                      </Space>
                    }
                    description={
                      <div className="dc3d-device-meta">
                        <div>
                          {d.uPosition == null ? t('drawer.unplaced') : uText(d.uPosition, d.uHeight)}
                          {d.deviceModel ? ` / ${d.deviceModel.name}` : ''}
                        </div>
                        <div>{ports.total ? t('tooltip.ports', { connected: ports.connected, total: ports.total }) : t('tooltip.noPorts')}</div>
                        {d.panels.length > 0 && (
                          <Space size={4} wrap onClick={(e) => e.stopPropagation()}>
                            {d.panels.map((p) => (
                              <Link key={p.id} to={paths.topologyPanel(p.id)} title={t('drawer.openPanel')}>
                                <Tag color="processing">
                                  {p.name} {p.connectedCount}/{p.portCount}
                                </Tag>
                              </Link>
                            ))}
                          </Space>
                        )}
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </>
      )}
    </Drawer>
  );
}
