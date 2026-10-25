import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './CabinetList.css';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Layout,
  List,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  AppstoreOutlined,
  BlockOutlined,
  CloudServerOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  InboxOutlined,
  PlusOutlined,
  SendOutlined,
  SettingOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import type { DanglingByDevice } from '@contracts/cables';
import type { DeviceDto } from '@contracts/devices';
import type { CabinetDto, RoomDto } from '@contracts/hierarchy';
import type { PanelDto } from '@contracts/panels';
import { formatShortId } from '@contracts/shortId';
import { cabinetService, roomService } from '@/services/hierarchyService';
import { cableService } from '@/services/cableService';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { panelTemplateService } from '@/services/panelTemplateService';
import { CabinetVisualizer, type CabinetVisualizerHandle, type ViewMode } from '@/components/CabinetVisualizer';
import { CabinetThumbnail } from '@/components/CabinetThumbnail';
import { DevicePanelEditor } from '@/components/DevicePanelEditor';
import { DeviceFormModal } from '@/components/DeviceFormModal';
import { PanelView } from '@/components/panel/PanelView';
import { LabelField } from '@/components/LabelField';
import { parseLabelInput, rebindIfChanged } from '@/utils/labels';
import { deleteWithForce } from '@/components/confirmForce';
import { DEVICE_TYPE_COLORS } from '@/constants/colors';
import { paths } from '@/routes';
import { uHeightText } from '@/utils/uHeight';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;
const { Sider, Content } = Layout;

interface CabinetForm {
  shortId?: string;
  name: string;
  positionCode?: string | null;
  heightU: number;
  roomId: string;
}

interface PlaceForm {
  cabinetId: string;
  uPosition: number;
}

const VIEW_MODE_KEY = 'cabinet-view-mode';

function readViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_MODE_KEY) === '3d' ? '3d' : '2d';
  } catch {
    return '2d';
  }
}

/**
 * /cabinets lists cabinets; /cabinets/:id shows that cabinet in the rack view.
 * Devices of the shown cabinet are loaded on their own, panels of a device in one request.
 */
export default function CabinetList() {
  const { t } = useTranslation(['cabinet', 'device', 'panel', 'common']);
  const { id: routeCabinetId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cabinets, setCabinets] = useState<CabinetDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ roomId?: string; search?: string }>({});
  const [activeTab, setActiveTab] = useState(routeCabinetId ? 'visual' : 'list');
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [devices, setDevices] = useState<DeviceDto[]>([]);

  const [cabinetModalOpen, setCabinetModalOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<CabinetDto | null>(null);
  const [cabinetForm] = Form.useForm<CabinetForm>();

  const [deviceModal, setDeviceModal] = useState<{ open: boolean; device: DeviceDto | null }>({ open: false, device: null });
  const [placeAction, setPlaceAction] = useState<{ kind: 'move' | 'copy'; device: DeviceDto } | null>(null);
  const [placeForm] = Form.useForm<PlaceForm>();

  const [viewingDevice, setViewingDevice] = useState<DeviceDto | null>(null);
  const [devicePanels, setDevicePanels] = useState<PanelDto[]>([]);
  const [dangling, setDangling] = useState<DanglingByDevice | null>(null);
  const [panelEditor, setPanelEditor] = useState<{ open: boolean; panelId?: string; device: DeviceDto | null }>({ open: false, device: null });

  const mainViewRef = useRef<CabinetVisualizerHandle>(null);
  const selected = useMemo(() => cabinets.find((c) => c.id === routeCabinetId) ?? null, [cabinets, routeCabinetId]);

  const loadCabinets = useCallback(async () => {
    setLoading(true);
    try {
      setCabinets(await cabinetService.list(filter));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadDevices = useCallback(async () => {
    if (!routeCabinetId) {
      setDevices([]);
      return;
    }
    try {
      setDevices(await deviceService.list({ cabinetId: routeCabinetId }));
    } catch {
      setDevices([]);
    }
  }, [routeCabinetId]);

  useEffect(() => {
    loadCabinets();
  }, [loadCabinets]);

  useEffect(() => {
    roomService.list().then(setRooms, () => undefined);
  }, []);

  useEffect(() => {
    loadDevices();
    if (routeCabinetId) setActiveTab('visual');
  }, [loadDevices, routeCabinetId]);

  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, `${r.dataCenterName} - ${r.name}`])), [rooms]);
  const cabinetOptions = cabinets.map((c) => ({ value: c.id, label: `${roomLabel.get(c.roomId) ?? c.roomName} - ${c.name}` }));
  const rackDevices = useMemo(() => devices.filter((d) => d.uPosition !== null).sort((a, b) => (b.uPosition ?? 0) - (a.uPosition ?? 0)), [devices]);
  // in the cabinet but without a U position: not drawn in the rack, listed separately so they can be edited and racked
  const unplacedDevices = useMemo(() => devices.filter((d) => d.uPosition === null), [devices]);

  const changeViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // per-viewer convenience only
    }
  };

  // ---------- cabinets ----------

  const openCabinetModal = (c?: CabinetDto) => {
    setEditingCabinet(c ?? null);
    cabinetForm.resetFields();
    cabinetForm.setFieldsValue({
      shortId: c?.label ? formatShortId(c.label.shortId) : '',
      name: c?.name ?? '',
      positionCode: c?.positionCode ?? '',
      heightU: c?.heightU ?? 42,
      roomId: c?.roomId ?? filter.roomId,
    });
    setCabinetModalOpen(true);
  };

  const saveCabinet = async () => {
    const v = await cabinetForm.validateFields();
    const shortId = parseLabelInput(v.shortId);
    try {
      if (editingCabinet) {
        await cabinetService.update({ id: editingCabinet.id, name: v.name, positionCode: v.positionCode, heightU: v.heightU, roomId: v.roomId });
        await rebindIfChanged({ kind: 'CABINET', id: editingCabinet.id }, editingCabinet.label?.shortId, shortId);
        message.success(t('cabinet:messages.updateSuccess'));
      } else {
        await cabinetService.create({ name: v.name, positionCode: v.positionCode, heightU: v.heightU, roomId: v.roomId, labelShortId: shortId });
        message.success(t('cabinet:messages.createSuccess'));
      }
      setCabinetModalOpen(false);
      loadCabinets();
    } catch {
      // reported by rpc
    }
  };

  const deleteCabinet = async (id: string) => {
    try {
      await cabinetService.delete({ id });
      message.success(t('cabinet:messages.deleteSuccess'));
      if (id === routeCabinetId) navigate(paths.cabinets());
      loadCabinets();
    } catch {
      // reported by rpc
    }
  };

  // ---------- devices ----------

  const refreshDevices = () => {
    loadDevices();
    loadCabinets();
  };

  const deleteDevice = async (d: DeviceDto) => {
    const ok = await deleteWithForce((force, opts) => deviceService.delete({ id: d.id, force }, opts), {
      code: 'NOT_EMPTY',
      title: t('device:messages.forceDeleteTitle'),
      content: t('device:messages.forceDeleteContent'),
      okText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
    });
    if (ok) {
      message.success(t('cabinet:messages.deviceDeleted'));
      refreshDevices();
    }
  };

  const openPlace = (kind: 'move' | 'copy', device: DeviceDto) => {
    placeForm.resetFields();
    placeForm.setFieldsValue({ cabinetId: device.cabinetId ?? routeCabinetId });
    setPlaceAction({ kind, device });
  };

  const submitPlace = async () => {
    if (!placeAction) return;
    const v = await placeForm.validateFields();
    const d = placeAction.device;
    try {
      if (placeAction.kind === 'move') {
        await deviceService.move({ id: d.id, cabinetId: v.cabinetId, roomId: null, uPosition: v.uPosition });
        message.success(t('cabinet:messages.deviceTransferSuccess'));
      } else {
        await deviceService.create({
          name: `${d.name}_${t('cabinet:buttons.deviceCopy')}`,
          type: d.type,
          deviceModelId: d.deviceModelId,
          cabinetId: v.cabinetId,
          uPosition: v.uPosition,
          uHeight: d.uHeight,
        });
        message.success(t('cabinet:messages.deviceCopySuccess'));
      }
      setPlaceAction(null);
      refreshDevices();
    } catch {
      // reported by rpc
    }
  };

  // ---------- panels of a device ----------

  const loadDevicePanels = useCallback(async (device: DeviceDto) => {
    try {
      const [panels, dang] = await Promise.all([
        panelService.list({ deviceId: device.id, includePorts: true }),
        cableService.danglingByDevice({ deviceId: device.id }),
      ]);
      setDevicePanels(panels);
      setDangling(dang);
    } catch {
      // reported by rpc
    }
  }, []);

  const showDevicePanels = async (device: DeviceDto) => {
    setViewingDevice(device);
    await loadDevicePanels(device);
  };

  const closeDevicePanels = () => {
    setViewingDevice(null);
    setDevicePanels([]);
    setDangling(null);
  };

  const deletePanel = async (panel: PanelDto) => {
    const ok = await deleteWithForce((force, opts) => panelService.delete({ id: panel.id, force }, opts), {
      code: 'PORT_HAS_DEPENDENTS',
      title: t('panel:messages.forceDeleteTitle'),
      content: t('panel:messages.forceDeleteContent'),
      okText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
    });
    if (ok && viewingDevice) {
      message.success(t('panel:messages.deleteSuccess'));
      loadDevicePanels(viewingDevice);
    }
  };

  const unbindTemplate = async (panelId: string) => {
    try {
      await panelTemplateService.unbind({ panelId });
      message.success(t('cabinet:messages.panelUnbindSuccess'));
      if (viewingDevice) loadDevicePanels(viewingDevice);
    } catch {
      // reported by rpc
    }
  };

  const columns = [
    {
      title: t('cabinet:fields.label'),
      key: 'label',
      width: 110,
      render: (_: unknown, c: CabinetDto) => (c.label ? <Text code>{formatShortId(c.label.shortId)}</Text> : '-'),
    },
    { title: t('cabinet:fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('cabinet:fields.position'), dataIndex: 'positionCode', key: 'positionCode', render: (v: string | null) => v || '-' },
    { title: t('cabinet:fields.height'), dataIndex: 'heightU', key: 'heightU', render: (v: number) => `${v}U` },
    { title: t('cabinet:fields.usedU'), key: 'usedU', render: (_: unknown, c: CabinetDto) => `${c.usedU}/${c.heightU}U` },
    { title: t('cabinet:fields.deviceCount'), dataIndex: 'deviceCount', key: 'deviceCount', width: 90 },
    {
      title: t('cabinet:fields.room'),
      key: 'room',
      render: (_: unknown, c: CabinetDto) => {
        const room = rooms.find((r) => r.id === c.roomId);
        return (
          <Space>
            {room && <Tag color="blue">{room.dataCenterName}</Tag>}
            <Tag color="green">{c.roomName}</Tag>
          </Space>
        );
      },
    },
    {
      title: t('cabinet:fields.actions'),
      key: 'actions',
      width: 240,
      render: (_: unknown, c: CabinetDto) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(paths.cabinet(c.id))} data-testid="cabinet-view-btn">
            {t('cabinet:buttons.visualize')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openCabinetModal(c)}>
            {t('cabinet:buttons.edit')}
          </Button>
          <Popconfirm
            title={t('cabinet:messages.deleteConfirm')}
            description={t('cabinet:messages.deleteWarning')}
            onConfirm={() => deleteCabinet(c.id)}
            okText={t('cabinet:buttons.confirm')}
            cancelText={t('cabinet:buttons.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('cabinet:buttons.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const deviceIconButton = (icon: React.ReactNode, onClick: () => void, extra: Record<string, unknown> = {}) => (
    <Button type="text" size="small" icon={icon} onClick={onClick} style={{ padding: '0 4px', height: 20 }} {...extra} />
  );

  const deviceItem = (device: DeviceDto) => (
    <li style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0', listStyle: 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <Text strong style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={device.name}>
          {device.name}
        </Text>
        <Tag color={DEVICE_TYPE_COLORS[device.type]} style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
          {t(`device:deviceTypes.${device.type}`)}
        </Tag>
      </div>
      <Text type="secondary" style={{ fontSize: 10 }}>
        {device.uPosition === null ? t('cabinet:panels.noUPosition') : `U${device.uPosition}`} ({uHeightText(device.uHeight, t('device:fields.uHeightUnknown'))})
      </Text>
      <Space size={4} wrap style={{ display: 'flex' }}>
        {deviceIconButton(<EditOutlined />, () => setDeviceModal({ open: true, device }))}
        {deviceIconButton(<SettingOutlined />, () => setPanelEditor({ open: true, device }), { 'data-testid': 'cabinet-device-panel-btn' })}
        {device.uPosition === null ? (
          <Tooltip title={t('cabinet:buttons.setUPosition')}>
            {deviceIconButton(<VerticalAlignTopOutlined />, () => openPlace('move', device), { 'data-testid': 'cabinet-device-set-u' })}
          </Tooltip>
        ) : (
          deviceIconButton(<SendOutlined />, () => openPlace('move', device))
        )}
        {deviceIconButton(<CopyOutlined />, () => openPlace('copy', device))}
        {deviceIconButton(<DeleteOutlined />, () => deleteDevice(device), { danger: true })}
      </Space>
    </li>
  );

  const listTab = (
    <Card>
      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCabinetModal()}>
            {t('cabinet:buttons.create')}
          </Button>
          <Select
            placeholder={t('cabinet:buttons.selectRoom')}
            allowClear
            style={{ width: 240 }}
            onChange={(roomId?: string) => setFilter((f) => ({ ...f, roomId }))}
            options={rooms.map((r) => ({ value: r.id, label: `${r.dataCenterName} - ${r.name}` }))}
          />
        </Space>
        <SearchInput placeholder={t('cabinet:placeholders.search')} onSearch={(search) => setFilter((f) => ({ ...f, search: search || undefined }))} style={{ width: 300 }} />
      </Space>
      <Table
        columns={columns}
        dataSource={cabinets}
        loading={loading}
        rowKey="id"
        onRow={(c) => ({ onClick: () => navigate(paths.cabinet(c.id)), style: { cursor: 'pointer' } })}
        rowClassName={(c) => (c.id === routeCabinetId ? 'highlighted-row' : '')}
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('cabinet:table.total', { total }) }}
      />
    </Card>
  );

  const visualTab = (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, marginBottom: 12, display: 'flex', justifyContent: 'flex-end' }}>
        <Space.Compact size="small">
          <Tooltip title={t('cabinet:views.2dFrontPanel')}>
            <Button type={viewMode === '2d' ? 'primary' : 'default'} icon={<AppstoreOutlined />} onClick={() => changeViewMode('2d')}>
              2D
            </Button>
          </Tooltip>
          <Tooltip title={t('cabinet:views.3dView')}>
            <Button type={viewMode === '3d' ? 'primary' : 'default'} icon={<BlockOutlined />} onClick={() => changeViewMode('3d')}>
              3D
            </Button>
          </Tooltip>
        </Space.Compact>
      </div>

      <Layout style={{ background: '#fff', flex: 1, overflow: 'hidden' }}>
        <Sider width={260} style={{ background: '#fafafa', borderRight: '1px solid #e8e8e8', overflowY: 'auto', height: '100%' }}>
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                {t('cabinet:views.selectCabinet')}
              </Text>
              <Select
                showSearch
                style={{ width: '100%' }}
                placeholder={t('cabinet:labels.selectCabinetPlaceholder')}
                value={selected?.id}
                optionFilterProp="label"
                onChange={(id: string) => navigate(paths.cabinet(id))}
                options={cabinetOptions}
              />
            </div>

            {selected ? (
              <>
                <div style={{ padding: '8px 12px', background: '#fafafa', borderRadius: 4, marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    {selected.name} {selected.label && <Text code>{formatShortId(selected.label.shortId)}</Text>}
                  </div>
                  <Space size={8} wrap>
                    <Tag color="blue" style={{ margin: 0 }}>
                      {selected.heightU}U
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {t('cabinet:labels.deviceCount', { count: selected.deviceCount })}
                    </Text>
                    <Text style={{ fontSize: 11 }}>
                      {selected.usedU}/{selected.heightU}U
                    </Text>
                  </Space>
                </div>
                <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size={4}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => setDeviceModal({ open: true, device: null })} block size="small">
                    {t('cabinet:buttons.addDevice')}
                  </Button>
                  <Button icon={<EditOutlined />} onClick={() => openCabinetModal(selected)} block size="small">
                    {t('cabinet:buttons.editCabinet')}
                  </Button>
                </Space>
                <Card title={t('cabinet:panels.devicePanels')} size="small" styles={{ body: { padding: '8px 0' } }}>
                  <List dataSource={rackDevices} size="small" split={false} renderItem={(device) => deviceItem(device)} />
                </Card>
                {unplacedDevices.length > 0 && (
                  <Card
                    title={t('cabinet:panels.unplacedDevices', { count: unplacedDevices.length })}
                    size="small"
                    style={{ marginTop: 12 }}
                    styles={{ body: { padding: '8px 0' } }}
                    data-testid="cabinet-unplaced-devices"
                  >
                    <Text type="secondary" style={{ fontSize: 11, display: 'block', padding: '0 12px 4px' }}>
                      {t('cabinet:panels.unplacedHint')}
                    </Text>
                    <List dataSource={unplacedDevices} size="small" split={false} renderItem={(device) => deviceItem(device)} />
                  </Card>
                )}
              </>
            ) : (
              <Empty description={t('cabinet:messages.selectCabinet')} />
            )}
          </div>
        </Sider>

        <Content style={{ padding: 24, height: '100%', overflow: 'hidden' }}>
          {selected ? (
            <CabinetVisualizer ref={mainViewRef} cabinet={selected} devices={rackDevices} viewMode={viewMode} onDeviceClick={(d) => {
                const device = devices.find((x) => x.id === d.id);
                if (device) showDevicePanels(device);
              }} />
          ) : (
            <Empty description={t('cabinet:messages.selectCabinetVisual')} style={{ marginTop: 100 }} />
          )}
        </Content>

        <Sider width={260} style={{ background: '#fafafa', borderLeft: '1px solid #e8e8e8', overflow: 'hidden', height: '100%' }}>
          <div style={{ padding: 16 }}>
            {selected ? (
              <>
                <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, paddingLeft: 4 }}>
                  <InboxOutlined style={{ marginRight: 4 }} />
                  {t('cabinet:labels.cabinetOverview')}
                </div>
                <CabinetThumbnail cabinet={selected} devices={rackDevices} containerHeight={600} mainViewRef={mainViewRef} />
              </>
            ) : (
              <Empty description={t('cabinet:messages.selectCabinet')} />
            )}
          </div>
        </Sider>
      </Layout>
    </div>
  );

  const danglingCount = dangling?.total ?? 0;

  return (
    <div style={{ height: 'calc(100vh - 192px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>
          <InboxOutlined /> {t('cabinet:title')}
        </Title>
        <Text type="secondary" style={{ fontSize: 14 }}>
          {t('cabinet:description')}
        </Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          if (key === 'list' && routeCabinetId) navigate(paths.cabinets());
        }}
        type="card"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        className="full-height-tabs"
        items={[
          {
            key: 'list',
            label: (
              <span>
                <InboxOutlined /> {t('cabinet:tabs.cabinetList')}
              </span>
            ),
            children: listTab,
          },
          {
            key: 'visual',
            label: (
              <span>
                <EyeOutlined /> {t('cabinet:tabs.visualization')}
              </span>
            ),
            children: visualTab,
          },
        ]}
      />

      <Modal
        title={
          <Space>
            <InboxOutlined />
            {editingCabinet ? t('cabinet:editTitle') : t('cabinet:createTitle')}
          </Space>
        }
        open={cabinetModalOpen}
        onOk={saveCabinet}
        onCancel={() => setCabinetModalOpen(false)}
        okText={t('cabinet:buttons.save')}
        cancelText={t('cabinet:buttons.cancel')}
        forceRender
        wrapProps={{ 'data-testid': 'cabinet-modal' }}
      >
        <Form name="cabinet-list-cabinet-form" form={cabinetForm} layout="vertical" data-testid="cabinet-form">
          <LabelField name="shortId" autoAllocate self={editingCabinet ? { kind: 'CABINET', id: editingCabinet.id } : undefined} testId="cabinet-shortid-input" />
          <Form.Item name="name" label={t('cabinet:labels.cabinetName')} rules={[{ required: true, message: t('cabinet:validation.nameRequired') }]}>
            <Input placeholder={t('cabinet:placeholders.name')} data-testid="cabinet-name-input" />
          </Form.Item>
          <Form.Item name="positionCode" label={t('cabinet:labels.position')}>
            <Input placeholder={t('cabinet:placeholders.position')} data-testid="cabinet-position-input" />
          </Form.Item>
          <Form.Item name="heightU" label={t('cabinet:labels.uHeight')} rules={[{ required: true, message: t('cabinet:validation.heightRequired') }]}>
            <InputNumber min={1} max={60} style={{ width: '100%' }} data-testid="cabinet-height-input" />
          </Form.Item>
          <Form.Item name="roomId" label={t('cabinet:labels.selectRoom')} rules={[{ required: true, message: t('cabinet:validation.roomRequired') }]}>
            <Select
              placeholder={t('cabinet:labels.selectRoom')}
              showSearch
              optionFilterProp="label"
              data-testid="cabinet-room-select"
              options={rooms.map((r) => ({ value: r.id, label: `${r.dataCenterName} - ${r.name}` }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <DeviceFormModal
        open={deviceModal.open}
        device={deviceModal.device}
        defaultCabinetId={routeCabinetId}
        onClose={(changed) => {
          setDeviceModal({ open: false, device: null });
          if (changed) refreshDevices();
        }}
      />

      <Modal
        title={
          <Space>
            {placeAction?.kind === 'copy' ? <CopyOutlined /> : <SendOutlined />}
            {placeAction?.kind === 'copy' ? t('cabinet:copy.title') : t('cabinet:transfer.title')}
          </Space>
        }
        open={!!placeAction}
        onOk={submitPlace}
        onCancel={() => setPlaceAction(null)}
        okText={placeAction?.kind === 'copy' ? t('cabinet:buttons.confirmCopy') : t('cabinet:buttons.confirmTransfer')}
        cancelText={t('cabinet:buttons.cancel')}
        width={600}
        forceRender
      >
        {placeAction && (
          <Alert
            message={placeAction.kind === 'copy' ? t('cabinet:copy.description', { deviceName: placeAction.device.name }) : t('cabinet:transfer.description', { deviceName: placeAction.device.name })}
            type={placeAction.kind === 'copy' ? 'info' : 'warning'}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
        <Form name="cabinet-list-place-form" form={placeForm} layout="vertical">
          <Form.Item name="cabinetId" label={t('cabinet:labels.targetCabinet')} rules={[{ required: true, message: t('cabinet:validation.cabinetRequired') }]}>
            <Select placeholder={t('cabinet:labels.targetCabinet')} showSearch optionFilterProp="label" options={cabinetOptions} />
          </Form.Item>
          <Form.Item name="uPosition" label={t('cabinet:labels.targetUPosition')} rules={[{ required: true, message: t('cabinet:validation.uPositionRequired') }]}>
            <InputNumber style={{ width: '100%' }} min={1} max={60} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <CloudServerOutlined />
            {viewingDevice?.name} - {t('cabinet:panels.title')}
          </Space>
        }
        open={!!viewingDevice}
        onCancel={closeDevicePanels}
        footer={[
          <Button
            key="edit"
            icon={<EditOutlined />}
            onClick={() => {
              const d = viewingDevice;
              closeDevicePanels();
              setDeviceModal({ open: true, device: d });
            }}
          >
            {t('cabinet:buttons.editDeviceButton')}
          </Button>,
          <Button key="close" type="primary" onClick={closeDevicePanels}>
            {t('cabinet:buttons.cancel')}
          </Button>,
        ]}
        width={1000}
        style={{ top: 20 }}
      >
        {viewingDevice && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('cabinet:descriptions.deviceType')}>
                <Tag color={DEVICE_TYPE_COLORS[viewingDevice.type]}>{t(`device:deviceTypes.${viewingDevice.type}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('cabinet:descriptions.model')}>{viewingDevice.deviceModel?.name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cabinet:descriptions.serialNo')}>{viewingDevice.serialNo ?? '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cabinet:descriptions.uPosition')}>
                {viewingDevice.uPosition ? `U${viewingDevice.uPosition} (${uHeightText(viewingDevice.uHeight, t('device:fields.uHeightUnknown'))})` : '-'}
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">{t('cabinet:panels.title')}</Divider>

            {danglingCount > 0 && (
              <Alert type="warning" showIcon style={{ marginBottom: 16 }} message={t('cabinet:messages.dangling', { count: danglingCount })} />
            )}

            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setPanelEditor({ open: true, device: viewingDevice })} data-testid="cabinet-add-panel-btn">
                {t('cabinet:buttons.addPanel')}
              </Button>
            </div>

            {devicePanels.length === 0 ? (
              <Empty description={t('cabinet:panels.noPanels')} />
            ) : (
              <Tabs
                items={devicePanels.map((panel) => {
                  const parked = dangling?.panels.find((p) => p.panelId === panel.id)?.endpoints ?? [];
                  return {
                    key: panel.id,
                    label: (
                      <Space>
                        {panel.name}
                        {panel.label && <Text code>{formatShortId(panel.label.shortId)}</Text>}
                        {panel.templateId && <Tag color="blue">{t('cabinet:panels.templateBound')}</Tag>}
                        {panel.templateOutdated && <Tag color="orange">{t('cabinet:messages.outdated')}</Tag>}
                        {parked.length > 0 && <Tag color="warning">{t('cabinet:messages.danglingTag', { count: parked.length })}</Tag>}
                      </Space>
                    ),
                    children: (
                      <div>
                        <Space style={{ marginBottom: 16 }} wrap>
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => setPanelEditor({ open: true, panelId: panel.id, device: viewingDevice })}
                            data-testid="cabinet-edit-panel-btn"
                          >
                            {t('cabinet:buttons.editPanel')}
                          </Button>
                          <Button danger icon={<DeleteOutlined />} onClick={() => deletePanel(panel)}>
                            {t('panel:editor.delete')}
                          </Button>
                          {panel.templateId && (
                            <Popconfirm
                              title={t('cabinet:panels.unbindConfirmTitle')}
                              description={t('cabinet:panels.unbindConfirmDesc')}
                              onConfirm={() => unbindTemplate(panel.id)}
                              okText={t('cabinet:buttons.confirm')}
                              cancelText={t('cabinet:buttons.cancel')}
                            >
                              <Button type="link" size="small">
                                {t('cabinet:buttons.unbindTemplate')}
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                        {parked.length > 0 && (
                          <Space wrap style={{ marginBottom: 12 }}>
                            {parked.map((ep) => (
                              <Tag key={ep.id} color="warning" style={{ cursor: 'pointer' }} onClick={() => navigate(paths.cable(ep.cableId))}>
                                {ep.label ? formatShortId(ep.label.shortId) : ep.cableId.slice(0, 8)}
                              </Tag>
                            ))}
                          </Space>
                        )}
                        <PanelView panel={panel} ports={panel.ports ?? []} onPortClick={(port) => navigate(paths.port(port.id))} scale={1.6} />
                      </div>
                    ),
                  };
                })}
              />
            )}
          </div>
        )}
      </Modal>

      {panelEditor.device && (
        <DevicePanelEditor
          open={panelEditor.open}
          device={panelEditor.device}
          panelId={panelEditor.panelId}
          onClose={(changed) => {
            const device = panelEditor.device;
            setPanelEditor({ open: false, device: null });
            if (changed && device && viewingDevice?.id === device.id) loadDevicePanels(device);
          }}
        />
      )}
    </div>
  );
}
