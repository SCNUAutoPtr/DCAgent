import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Select, Space, Table, Tag, Typography, message } from 'antd';
import { CloudServerOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { DeviceDto } from '@contracts/devices';
import { DEVICE_TYPES, type DeviceType } from '@contracts/enums';
import type { CabinetDto, RoomDto } from '@contracts/hierarchy';
import { deviceService } from '@/services/deviceService';
import { cabinetService, roomService } from '@/services/hierarchyService';
import { deleteWithForce } from '@/components/confirmForce';
import { DeviceFormModal } from '@/components/DeviceFormModal';
import { DEVICE_TYPE_COLORS } from '@/constants/colors';
import { SearchInput } from '@/components/SearchInput';
import { uHeightText } from '@/utils/uHeight';

const { Title } = Typography;

export default function DeviceList() {
  const { t } = useTranslation(['device', 'common']);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [cabinets, setCabinets] = useState<CabinetDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ cabinetId?: string; type?: DeviceType; search?: string }>({});
  const [editing, setEditing] = useState<DeviceDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDevices(await deviceService.list(filter));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    Promise.all([cabinetService.list(), roomService.list()]).then(
      ([c, r]) => {
        setCabinets(c);
        setRooms(r);
      },
      () => undefined,
    );
  }, []);

  const cabinetOptions = useMemo(() => {
    const dcOf = new Map(rooms.map((r) => [r.id, r.dataCenterName]));
    return cabinets.map((c) => ({ value: c.id, label: `${dcOf.get(c.roomId) ?? ''} - ${c.roomName} - ${c.name}` }));
  }, [cabinets, rooms]);

  const typeOptions = DEVICE_TYPES.map((type) => ({ value: type, label: t(`device:deviceTypes.${type}`) }));

  const open = (d?: DeviceDto) => {
    setEditing(d ?? null);
    setModalOpen(true);
  };

  const remove = async (d: DeviceDto) => {
    const ok = await deleteWithForce((force, opts) => deviceService.delete({ id: d.id, force }, opts), {
      code: 'NOT_EMPTY',
      title: t('device:messages.forceDeleteTitle'),
      content: t('device:messages.forceDeleteContent'),
      okText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
    });
    if (ok) {
      message.success(t('device:messages.deleteSuccess'));
      load();
    }
  };

  const columns = [
    { title: t('device:fields.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('device:fields.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: DeviceType) => <Tag color={DEVICE_TYPE_COLORS[type]}>{t(`device:deviceTypes.${type}`)}</Tag>,
    },
    { title: t('device:fields.sysname'), dataIndex: 'sysname', key: 'sysname', render: (v: string | null) => v || '-' },
    { title: t('device:fields.model'), key: 'model', render: (_: unknown, d: DeviceDto) => (d.deviceModel ? `${d.deviceModel.vendor} ${d.deviceModel.name}`.trim() : '-') },
    { title: t('device:fields.serialNo'), dataIndex: 'serialNo', key: 'serialNo', render: (v: string | null) => v || '-' },
    {
      title: t('device:fields.uPosition'),
      key: 'uPosition',
      render: (_: unknown, d: DeviceDto) => (d.uPosition ? `U${d.uPosition} (${uHeightText(d.uHeight, t('device:fields.uHeightUnknown'))})` : '-'),
    },
    {
      title: t('device:fields.cabinet'),
      key: 'location',
      render: (_: unknown, d: DeviceDto) => (
        <Space size={4} wrap>
          {d.locationRoomName && <Tag color="green">{d.locationRoomName}</Tag>}
          {d.cabinetName && <Tag color="orange">{d.cabinetName}</Tag>}
        </Space>
      ),
    },
    { title: t('device:fields.panelCount'), dataIndex: 'panelCount', key: 'panelCount', width: 80 },
    {
      title: t('device:fields.actions'),
      key: 'actions',
      width: 170,
      fixed: 'right' as const,
      render: (_: unknown, d: DeviceDto) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => open(d)}>
            {t('device:buttons.edit')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(d)} data-testid="device-delete-btn">
            {t('device:buttons.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <CloudServerOutlined /> {t('device:title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>{t('device:description')}</p>
      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
              {t('device:buttons.create')}
            </Button>
            <Select
              placeholder={t('device:filters.selectCabinet')}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 260 }}
              options={cabinetOptions}
              onChange={(cabinetId?: string) => setFilter((f) => ({ ...f, cabinetId }))}
            />
            <Select
              placeholder={t('device:filters.selectType')}
              allowClear
              style={{ width: 130 }}
              options={typeOptions}
              onChange={(type?: DeviceType) => setFilter((f) => ({ ...f, type }))}
            />
          </Space>
          <SearchInput placeholder={t('device:placeholders.search')} onSearch={(v) => setFilter((f) => ({ ...f, search: v || undefined }))} style={{ width: 300 }} />
        </Space>
        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('device:table.total', { total }) }}
        />
      </Card>

      <DeviceFormModal
        open={modalOpen}
        device={editing}
        defaultCabinetId={filter.cabinetId}
        onClose={(changed) => {
          setModalOpen(false);
          if (changed) load();
        }}
      />
    </div>
  );
}
