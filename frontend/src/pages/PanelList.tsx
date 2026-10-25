import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ApartmentOutlined, DeleteOutlined, EditOutlined, NodeIndexOutlined, PlusOutlined } from '@ant-design/icons';
import type { DeviceDto } from '@contracts/devices';
import { PANEL_FACES, PANEL_TYPES, type PanelFace, type PanelType } from '@contracts/enums';
import type { PanelDto } from '@contracts/panels';
import { formatShortId } from '@contracts/shortId';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { LabelField } from '@/components/LabelField';
import { parseLabelInput, rebindIfChanged } from '@/utils/labels';
import { deleteWithForce } from '@/components/confirmForce';
import { paths } from '@/routes';
import { PANEL_TYPE_COLORS } from '@/constants/colors';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;

interface FormValues {
  shortId?: string;
  name: string;
  type: PanelType;
  face: PanelFace;
  deviceId: string;
  notes?: string | null;
}

export default function PanelList() {
  const { t } = useTranslation(['panel', 'common']);
  const navigate = useNavigate();
  const [panels, setPanels] = useState<PanelDto[]>([]);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ deviceId?: string; type?: PanelType }>({});
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PanelDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPanels(await panelService.list(filter));
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
    deviceService.list().then(setDevices, () => undefined);
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? panels.filter((p) => `${p.name} ${p.deviceName} ${p.label ? formatShortId(p.label.shortId) : ''}`.toLowerCase().includes(q)) : panels;
  }, [panels, search]);

  const typeOptions = PANEL_TYPES.map((type) => ({ value: type, label: t(`panel:panelTypes.${type}`) }));

  const open = (p?: PanelDto) => {
    setEditing(p ?? null);
    form.resetFields();
    form.setFieldsValue({
      shortId: p?.label ? formatShortId(p.label.shortId) : '',
      name: p?.name ?? '',
      type: p?.type,
      face: p?.face ?? 'FRONT',
      deviceId: p?.deviceId ?? filter.deviceId,
      notes: p?.notes ?? '',
    });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    const shortId = parseLabelInput(v.shortId);
    try {
      if (editing) {
        await panelService.update({ id: editing.id, name: v.name, type: v.type, face: v.face, notes: v.notes });
        await rebindIfChanged({ kind: 'PANEL', id: editing.id }, editing.label?.shortId, shortId);
        message.success(t('panel:messages.updateSuccess'));
      } else {
        await panelService.create({ deviceId: v.deviceId, name: v.name, type: v.type, face: v.face, notes: v.notes, labelShortId: shortId });
        message.success(t('panel:messages.createSuccess'));
      }
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const remove = async (p: PanelDto) => {
    const ok = await deleteWithForce((force, opts) => panelService.delete({ id: p.id, force }, opts), {
      code: 'PORT_HAS_DEPENDENTS',
      title: t('panel:messages.forceDeleteTitle'),
      content: t('panel:messages.forceDeleteContent'),
      okText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
    });
    if (ok) {
      message.success(t('panel:messages.deleteSuccess'));
      load();
    }
  };

  const columns = [
    {
      title: t('panel:fields.label'),
      key: 'label',
      width: 120,
      render: (_: unknown, p: PanelDto) => (p.label ? <Text code>{formatShortId(p.label.shortId)}</Text> : '-'),
    },
    { title: t('panel:fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('panel:fields.type'), dataIndex: 'type', key: 'type', render: (type: PanelType) => <Tag color={PANEL_TYPE_COLORS[type]}>{t(`panel:panelTypes.${type}`)}</Tag> },
    { title: t('panel:fields.face'), dataIndex: 'face', key: 'face', render: (f: PanelFace) => t(`panel:faces.${f}`) },
    { title: t('panel:fields.device'), dataIndex: 'deviceName', key: 'deviceName', render: (v: string) => <Tag color="green">{v}</Tag> },
    { title: t('panel:fields.portCount'), dataIndex: 'portCount', key: 'portCount', width: 80 },
    { title: t('panel:fields.connected'), dataIndex: 'connectedCount', key: 'connectedCount', width: 80 },
    {
      title: t('panel:fields.actions'),
      key: 'actions',
      width: 240,
      render: (_: unknown, p: PanelDto) => (
        <Space>
          <Button type="link" size="small" icon={<NodeIndexOutlined />} onClick={() => navigate(paths.topologyPanel(p.id))} />
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => open(p)} data-testid="panel-edit-btn">
            {t('panel:buttons.edit')}
          </Button>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => remove(p)} data-testid="panel-delete-btn">
            {t('panel:buttons.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <ApartmentOutlined /> {t('panel:title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>{t('panel:description')}</p>
      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()} data-testid="panel-create-btn">
              {t('panel:buttons.create')}
            </Button>
            <Select
              placeholder={t('panel:filters.selectDevice')}
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 220 }}
              options={devices.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(deviceId?: string) => setFilter((f) => ({ ...f, deviceId }))}
            />
            <Select
              placeholder={t('panel:filters.selectType')}
              allowClear
              style={{ width: 130 }}
              options={typeOptions}
              onChange={(type?: PanelType) => setFilter((f) => ({ ...f, type }))}
            />
          </Space>
          <SearchInput placeholder={t('panel:placeholders.search')} onSearch={setSearch} style={{ width: 300 }} />
        </Space>
        <Table
          columns={columns}
          dataSource={shown}
          loading={loading}
          rowKey="id"
          data-testid="panel-table"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('panel:table.total', { total }) }}
        />
      </Card>

      <Modal
        title={editing ? t('panel:editTitle') : t('panel:createTitle')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        okText={t('panel:buttons.save')}
        cancelText={t('panel:buttons.cancel')}
        okButtonProps={{ 'data-testid': 'panel-save-btn' } as React.ComponentProps<typeof Button>}
        forceRender
        wrapProps={{ 'data-testid': 'panel-modal' }}
      >
        <Form name="panel-list-form" form={form} layout="vertical" data-testid="panel-form">
          <LabelField name="shortId" autoAllocate self={editing ? { kind: 'PANEL', id: editing.id } : undefined} testId="panel-shortid-input" />
          <Form.Item name="name" label={t('panel:fields.name')} rules={[{ required: true, message: t('panel:validation.nameRequired') }]}>
            <Input placeholder={t('panel:placeholders.name')} data-testid="panel-name-input" />
          </Form.Item>
          <Space style={{ width: '100%' }} align="start">
            <Form.Item name="type" label={t('panel:fields.type')} rules={[{ required: true, message: t('panel:validation.typeRequired') }]} style={{ width: 220 }}>
              <Select placeholder={t('panel:placeholders.type')} data-testid="panel-type-select" options={typeOptions} />
            </Form.Item>
            <Form.Item name="face" label={t('panel:fields.face')} style={{ width: 160 }}>
              <Select options={PANEL_FACES.map((f) => ({ value: f, label: t(`panel:faces.${f}`) }))} />
            </Form.Item>
          </Space>
          <Form.Item name="deviceId" label={t('panel:fields.device')} rules={[{ required: true, message: t('panel:validation.deviceRequired') }]}>
            <Select
              placeholder={t('panel:placeholders.device')}
              showSearch
              optionFilterProp="label"
              disabled={!!editing}
              data-testid="panel-device-select"
              options={devices.map((d) => ({ value: d.id, label: `${d.name} (${d.type})` }))}
            />
          </Form.Item>
          <Form.Item name="notes" label={t('panel:fields.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
