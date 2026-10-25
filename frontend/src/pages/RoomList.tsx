import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, Typography, message } from 'antd';
import { DeleteOutlined, EditOutlined, HomeOutlined, LayoutOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import type { DataCenterDto, RoomDto } from '@contracts/hierarchy';
import type { RoomScene } from '@contracts/scene';
import { formatShortId } from '@contracts/shortId';
import { cabinetService, dataCenterService, roomService } from '@/services/hierarchyService';
import { workstationService } from '@/services/workstationService';
import { FloorPlanEditor, type FloorPlanCabinetInput, type FloorPlanSaveUpdates } from '@/components/FloorPlanEditor';
import { LabelField } from '@/components/LabelField';
import { parseLabelInput, rebindIfChanged } from '@/utils/labels';
import { paths } from '@/routes';
import { SearchInput } from '@/components/SearchInput';

const { Title } = Typography;

interface FormValues {
  name: string;
  floor?: string | null;
  dataCenterId: string;
  shortId?: string;
}

export default function RoomList() {
  const { t } = useTranslation(['room', 'common']);
  const navigate = useNavigate();
  const { id: sceneRoomId } = useParams();
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dataCenterId, setDataCenterId] = useState<string>();
  const [editing, setEditing] = useState<RoomDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [scene, setScene] = useState<RoomScene | null>(null);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRooms(await roomService.list({ dataCenterId, search: search || undefined }));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [dataCenterId, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    dataCenterService.list().then(setDataCenters, () => undefined);
  }, []);

  // /rooms/:id opens the floor plan of that room
  const loadScene = useCallback(async (roomId: string) => {
    try {
      setScene(await roomService.scene({ roomId }));
    } catch {
      setScene(null);
    }
  }, []);

  useEffect(() => {
    if (sceneRoomId) loadScene(sceneRoomId);
    else setScene(null);
  }, [sceneRoomId, loadScene]);

  const open = (room?: RoomDto) => {
    setEditing(room ?? null);
    form.setFieldsValue({
      name: room?.name ?? '',
      floor: room?.floor ?? '',
      dataCenterId: room?.dataCenterId ?? dataCenterId ?? dataCenters[0]?.id,
      shortId: room?.label ? formatShortId(room.label.shortId) : '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    const shortId = parseLabelInput(values.shortId);
    try {
      if (editing) {
        await roomService.update({ id: editing.id, name: values.name, floor: values.floor });
        await rebindIfChanged({ kind: 'ROOM', id: editing.id }, editing.label?.shortId, shortId);
        message.success(t('room:messages.updateSuccess'));
      } else {
        await roomService.create({ dataCenterId: values.dataCenterId, name: values.name, floor: values.floor, labelShortId: shortId });
        message.success(t('room:messages.createSuccess'));
      }
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const remove = async (id: string) => {
    try {
      await roomService.delete({ id });
      message.success(t('room:messages.deleteSuccess'));
      load();
    } catch {
      // reported by rpc
    }
  };

  // the editor only hands back what changed; a failure is rethrown so it keeps the edits
  const saveFloorPlan = async (updates: FloorPlanSaveUpdates) => {
    if (!scene) return;
    const roomId = scene.room.id;
    if (updates.roomSize) await roomService.update({ id: roomId, widthM: updates.roomSize.width, depthM: updates.roomSize.height });
    await Promise.all([
      ...(updates.cabinets ?? []).map((c) => cabinetService.update({ id: c.id, fpX: c.position.x, fpY: c.position.y })),
      ...(updates.workstations ?? []).map((w) => workstationService.update({ id: w.id, fpX: w.position.x, fpY: w.position.y })),
    ]);
    message.success(t('common:messages.saveSuccess'));
    await loadScene(roomId);
  };

  const createCabinet = async (input: FloorPlanCabinetInput) => {
    if (!scene) return;
    await cabinetService.create({
      roomId: scene.room.id,
      name: input.name,
      heightU: input.height,
      labelShortId: input.shortId,
      fpX: input.position.x,
      fpY: input.position.y,
    });
    message.success(t('room:floorPlan.createSuccess'));
    await loadScene(scene.room.id);
    load();
  };

  const columns = [
    {
      title: t('room:fields.label'),
      key: 'label',
      width: 110,
      render: (_: unknown, r: RoomDto) => (r.label ? <Tag>{formatShortId(r.label.shortId)}</Tag> : '-'),
    },
    { title: t('room:fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('room:fields.floor'), dataIndex: 'floor', key: 'floor', render: (v: string | null) => v || '-' },
    { title: t('room:fields.dataCenter'), dataIndex: 'dataCenterName', key: 'dataCenterName', render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: t('room:fields.cabinetCount'), dataIndex: 'cabinetCount', key: 'cabinetCount', width: 90 },
    { title: t('room:fields.workstationCount'), dataIndex: 'workstationCount', key: 'workstationCount', width: 100 },
    {
      title: t('room:fields.actions'),
      key: 'actions',
      width: 260,
      render: (_: unknown, record: RoomDto) => (
        <Space>
          <Button type="link" size="small" icon={<LayoutOutlined />} onClick={() => navigate(paths.room(record.id))}>
            {t('room:actions.floorPlan')}
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => open(record)}>
            {t('common:actions.edit')}
          </Button>
          <Popconfirm
            title={t('room:messages.deleteConfirm')}
            description={t('room:messages.deleteWarning')}
            onConfirm={() => remove(record.id)}
            okText={t('common:actions.confirm')}
            cancelText={t('common:actions.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('common:actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <HomeOutlined /> {t('room:title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>{t('room:description')}</p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
              {t('room:createTitle')}
            </Button>
            <Select
              placeholder={t('room:placeholders.dataCenter')}
              allowClear
              style={{ width: 200 }}
              value={dataCenterId}
              onChange={setDataCenterId}
              options={dataCenters.map((dc) => ({ value: dc.id, label: dc.name }))}
            />
          </Space>
          <SearchInput placeholder={t('room:placeholders.search')} onSearch={setSearch} style={{ width: 300 }} />
        </Space>
        <Table
          columns={columns}
          dataSource={rooms}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('room:table.total', { total }) }}
        />
      </Card>

      <Modal
        title={editing ? t('room:editTitle') : t('room:createTitle')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        forceRender
        wrapProps={{ 'data-testid': 'room-modal' }}
      >
        <Form name="room-list-form" form={form} layout="vertical" data-testid="room-form">
          <LabelField name="shortId" self={editing ? { kind: 'ROOM', id: editing.id } : undefined} testId="room-shortid-input" />
          <Form.Item name="name" label={t('room:fields.name')} rules={[{ required: true, message: t('room:validation.nameRequired') }]}>
            <Input placeholder={t('room:placeholders.name')} data-testid="room-name-input" />
          </Form.Item>
          <Form.Item name="floor" label={t('room:fields.floor')}>
            <Input placeholder={t('room:placeholders.floor')} data-testid="room-floor-input" />
          </Form.Item>
          <Form.Item name="dataCenterId" label={t('room:fields.dataCenter')} rules={[{ required: true, message: t('room:validation.dataCenterRequired') }]}>
            <Select
              placeholder={t('room:placeholders.dataCenter')}
              data-testid="room-datacenter-select"
              disabled={!!editing}
              options={dataCenters.map((dc) => ({ value: dc.id, label: dc.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={null} open={!!sceneRoomId && !!scene} onCancel={() => navigate(paths.rooms())} footer={null} width="90%" style={{ top: 20 }} destroyOnHidden>
        {scene && (
          <FloorPlanEditor scene={scene} onSave={saveFloorPlan} onCreateCabinet={createCabinet} onCabinetClick={(id) => navigate(paths.cabinet(id))} />
        )}
      </Modal>
    </div>
  );
}
