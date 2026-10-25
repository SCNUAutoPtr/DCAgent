import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Button, Card, Col, Descriptions, Divider, Form, Input, InputNumber, Modal, Popconfirm, Progress, Row, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PlusOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import type { DeviceDto } from '@contracts/devices';
import { IP_STATUSES, type IpStatus } from '@contracts/enums';
import type { IpAddressDto, IpConflict, SubnetDto } from '@contracts/ip';
import { ipv4ToInt } from '@contracts/ipv4';
import type { PanelDto } from '@contracts/panels';
import { ipAddressService, subnetService } from '@/services/ipService';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { paths } from '@/routes';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<IpStatus, string> = { ALLOCATED: 'processing', RESERVED: 'warning', BLOCKED: 'default' };
type OwnerKind = 'NONE' | 'PORT' | 'DEVICE';

interface FormValues {
  address?: string;
  status: IpStatus;
  ownerKind: OwnerKind;
  deviceId?: string;
  panelId?: string;
  portId?: string;
  hostname?: string;
  macAddress?: string;
  description?: string;
}

export default function SubnetDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation(['ip', 'common']);
  const navigate = useNavigate();
  const [subnet, setSubnet] = useState<SubnetDto | null>(null);
  const [rows, setRows] = useState<IpAddressDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ current: 1, pageSize: 50 });
  const [filter, setFilter] = useState<{ status?: IpStatus; search?: string }>({});
  const [loading, setLoading] = useState(false);
  const [conflicts, setConflicts] = useState<IpConflict[] | null>(null);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [panels, setPanels] = useState<PanelDto[]>([]);
  const [editing, setEditing] = useState<IpAddressDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nextFree, setNextFree] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchCount, setBatchCount] = useState<number | null>(1);
  const [form] = Form.useForm<FormValues>();
  const ownerKind: OwnerKind = Form.useWatch('ownerKind', form) ?? 'NONE';
  const deviceId = Form.useWatch('deviceId', form);
  const panelId = Form.useWatch('panelId', form);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [s, list] = await Promise.all([
        subnetService.get({ id }),
        ipAddressService.list({ subnetId: id, ...filter, take: page.pageSize, skip: (page.current - 1) * page.pageSize }),
      ]);
      setSubnet(s);
      setRows(list.items);
      setTotal(list.total);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [id, filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    deviceService.list().then(setDevices, () => undefined);
  }, []);

  // ports of the chosen device, loaded in one request
  useEffect(() => {
    if (!deviceId || ownerKind !== 'PORT') {
      setPanels([]);
      return;
    }
    panelService.list({ deviceId, includePorts: true }).then(setPanels, () => setPanels([]));
  }, [deviceId, ownerKind]);

  const open = async (ip?: IpAddressDto) => {
    setEditing(ip ?? null);
    form.resetFields();
    const kind: OwnerKind = ip?.portId ? 'PORT' : ip?.deviceId ? 'DEVICE' : 'NONE';
    form.setFieldsValue({
      address: ip?.address ?? '',
      status: ip?.status ?? 'ALLOCATED',
      ownerKind: kind,
      deviceId: ip?.owner?.deviceId ?? ip?.deviceId ?? undefined,
      portId: ip?.portId ?? undefined,
      hostname: ip?.hostname ?? '',
      macAddress: ip?.macAddress ?? '',
      description: ip?.description ?? '',
    });
    setNextFree(null);
    setModalOpen(true);
    if (!ip && id) {
      try {
        const r = await ipAddressService.nextAvailable({ subnetId: id });
        setNextFree(r.addresses[0] ?? null);
      } catch {
        // reported by rpc
      }
    }
  };

  // a port's panel is only known once panels are loaded
  useEffect(() => {
    const portId = form.getFieldValue('portId');
    if (portId && !panelId) {
      const p = panels.find((x) => x.ports?.some((port) => port.id === portId));
      if (p) form.setFieldValue('panelId', p.id);
    }
  }, [panels, panelId, form]);

  const save = async () => {
    const v = await form.validateFields();
    const owner = {
      portId: v.ownerKind === 'PORT' ? v.portId ?? null : null,
      deviceId: v.ownerKind === 'DEVICE' ? v.deviceId ?? null : null,
    };
    const extra = { status: v.status, hostname: v.hostname, macAddress: v.macAddress || null, description: v.description };
    try {
      if (editing) await ipAddressService.update({ id: editing.id, ...owner, ...extra });
      else await ipAddressService.allocate({ subnetId: id!, address: v.address || undefined, ...owner, ...extra });
      message.success(t(editing ? 'ip:ipAddress.messages.updateSuccess' : 'ip:ipAddress.messages.allocateSuccess'));
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const release = async (ip: IpAddressDto) => {
    try {
      await ipAddressService.release({ id: ip.id });
      message.success(t('ip:ipAddress.messages.releaseSuccess'));
      load();
    } catch {
      // reported by rpc
    }
  };

  const reserveBlock = async () => {
    if (!id || !batchCount) return;
    try {
      const r = await ipAddressService.batchAllocate({ subnetId: id, count: batchCount, status: 'RESERVED' });
      message.success(t('ip:ipAddress.messages.batchReserveSuccess', { count: r.addresses.length }));
      setBatchOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const checkConflicts = async () => {
    try {
      setConflicts(await ipAddressService.checkConflicts({ subnetId: id }));
    } catch {
      // reported by rpc
    }
  };

  const ownerCell = (ip: IpAddressDto) => {
    if (!ip.owner) return '-';
    const color = ip.owner.kind === 'PORT' ? 'blue' : ip.owner.kind === 'DEVICE' ? 'green' : 'purple';
    const label = `${t(`ip:ipAddress.ownerKinds.${ip.owner.kind}`)}: ${ip.owner.name}`;
    return ip.owner.kind === 'PORT' ? (
      <Tag color={color} style={{ cursor: 'pointer' }} onClick={() => navigate(paths.port(ip.owner!.id))}>
        {label}
      </Tag>
    ) : (
      <Tag color={color}>{label}</Tag>
    );
  };

  const columns = [
    { title: t('ip:ipAddress.fields.address'), dataIndex: 'address', key: 'address', render: (v: string) => <Text code>{v}</Text> },
    { title: t('ip:ipAddress.fields.status'), dataIndex: 'status', key: 'status', render: (s: IpStatus) => <Tag color={STATUS_COLORS[s]}>{t(`ip:ipAddress.status.${s}`)}</Tag> },
    { title: t('ip:ipAddress.fields.owner'), key: 'owner', render: (_: unknown, ip: IpAddressDto) => ownerCell(ip) },
    { title: t('ip:ipAddress.fields.hostname'), dataIndex: 'hostname', key: 'hostname', render: (v: string | null) => v || '-' },
    { title: t('ip:ipAddress.fields.macAddress'), dataIndex: 'macAddress', key: 'macAddress', render: (v: string | null) => (v ? <Text code>{v}</Text> : '-') },
    { title: t('ip:ipAddress.fields.description'), dataIndex: 'description', key: 'description', ellipsis: true, render: (v: string | null) => v || '-' },
    {
      title: t('ip:buttons.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 170,
      render: (_: unknown, ip: IpAddressDto) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => open(ip)} />
          <Popconfirm title={t('ip:ipAddress.messages.releaseConfirm')} onConfirm={() => release(ip)} okText={t('ip:buttons.confirm')} cancelText={t('ip:buttons.cancel')}>
            <Button size="small" danger>
              {t('ip:buttons.release')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!subnet) {
    return <Card loading />;
  }

  const ports = panels.find((p) => p.id === panelId)?.ports ?? [];

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(paths.ipManagement())}>
          {t('ip:buttons.back')}
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          {subnet.name}
        </Title>
      </Space>

      <Card title={t('ip:subnet.detailTitle')} style={{ marginBottom: 24 }}>
        <Descriptions column={3} bordered>
          <Descriptions.Item label={t('ip:subnet.fields.network')}>
            <Text code>{subnet.network}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('ip:subnet.fields.gateway')}>{subnet.gateway ? <Text code>{subnet.gateway}</Text> : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ip:subnet.fields.vlan')}>{subnet.vlan ? <Tag color="blue">{subnet.vlan}</Tag> : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ip:subnet.fields.room')}>{subnet.roomName ?? '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ip:subnet.fields.dnsServers')}>{subnet.dnsServers.length ? subnet.dnsServers.map((d) => <Tag key={d}>{d}</Tag>) : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('ip:subnet.fields.description')}>{subnet.description || '-'}</Descriptions.Item>
        </Descriptions>
        <Divider />
        <Row gutter={16}>
          {(
            [
              ['capacity', subnet.usage.capacity, undefined],
              ['freeIps', subnet.usage.free, '#52c41a'],
              ['allocatedIps', subnet.usage.allocated, '#1890ff'],
              ['reservedIps', subnet.usage.reserved, '#faad14'],
            ] as const
          ).map(([key, value, color]) => (
            <Col span={5} key={key}>
              <Card size="small" style={{ textAlign: 'center' }}>
                <Text type="secondary">{t(`ip:subnet.fields.${key}`)}</Text>
                <Title level={3} style={{ margin: '8px 0', color }}>
                  {value}
                </Title>
              </Card>
            </Col>
          ))}
          <Col span={4}>
            <Card size="small" style={{ textAlign: 'center' }}>
              <Text type="secondary">{t('ip:subnet.fields.utilizationRate')}</Text>
              <Title level={3} style={{ margin: '8px 0' }}>
                {subnet.usage.utilization.toFixed(2)}%
              </Title>
              <Progress percent={subnet.usage.utilization} showInfo={false} strokeColor={subnet.usage.utilization > 80 ? '#ff4d4f' : '#52c41a'} />
            </Card>
          </Col>
        </Row>
      </Card>

      {conflicts && (
        <Alert
          style={{ marginBottom: 16 }}
          type={conflicts.length ? 'warning' : 'success'}
          showIcon
          closable
          onClose={() => setConflicts(null)}
          message={conflicts.length ? t('ip:conflicts.foundConflicts', { count: conflicts.length }) : t('ip:conflicts.noConflicts')}
          description={
            conflicts.length ? (
              <ul style={{ margin: 0 }}>
                {conflicts.map((c) => (
                  <li key={`${c.kind}-${c.value}`}>
                    {t(`ip:conflicts.kinds.${c.kind}`)}: <Text code>{c.value}</Text> ({c.ipAddressIds.length})
                  </li>
                ))}
              </ul>
            ) : undefined
          }
        />
      )}

      <Card
        title={t('ip:ipAddress.title')}
        extra={
          <Space wrap>
            <SearchInput
              placeholder={t('ip:ipAddress.placeholders.search')}
              onSearch={(search) => {
                setFilter((f) => ({ ...f, search: search || undefined }));
                setPage((p) => ({ ...p, current: 1 }));
              }}
              style={{ width: 250 }}
            />
            <Select
              placeholder={t('ip:filters.status')}
              allowClear
              style={{ width: 120 }}
              options={IP_STATUSES.map((s) => ({ value: s, label: t(`ip:ipAddress.status.${s}`) }))}
              onChange={(status?: IpStatus) => {
                setFilter((f) => ({ ...f, status }));
                setPage((p) => ({ ...p, current: 1 }));
              }}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
              {t('ip:ipAddress.allocate')}
            </Button>
            <Button onClick={() => setBatchOpen(true)}>{t('ip:ipAddress.batchReserve')}</Button>
            <Button icon={<WarningOutlined />} onClick={checkConflicts}>
              {t('ip:buttons.checkConflicts')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load}>
              {t('ip:buttons.refresh')}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          locale={{ emptyText: t('ip:noData.noIpAddresses') }}
          pagination={{
            ...page,
            total,
            showSizeChanger: true,
            showTotal: (n) => t('ip:ipAddress.total', { total: n }),
            onChange: (current, pageSize) => setPage({ current, pageSize }),
          }}
        />
      </Card>

      <Modal
        title={editing ? t('ip:ipAddress.editTitle', { address: editing.address }) : t('ip:ipAddress.allocate')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText={t('ip:buttons.save')}
        cancelText={t('ip:buttons.cancel')}
        forceRender
      >
        <Form name="subnet-detail-form" form={form} layout="vertical">
          {!editing && (
            <Form.Item
              label={t('ip:ipAddress.fields.address')}
              name="address"
              extra={nextFree ? t('ip:ipAddress.messages.nextAvailable', { address: nextFree }) : undefined}
              rules={[{ validator: (_: unknown, v?: string) => (!v || ipv4ToInt(v) !== null ? Promise.resolve() : Promise.reject(new Error(t('ip:ipAddress.validation.invalidAddress')))) }]}
            >
              <Input placeholder={t('ip:ipAddress.placeholders.address')} />
            </Form.Item>
          )}
          <Form.Item label={t('ip:ipAddress.fields.status')} name="status">
            <Select options={IP_STATUSES.map((s) => ({ value: s, label: t(`ip:ipAddress.status.${s}`) }))} />
          </Form.Item>
          <Form.Item label={t('ip:ipAddress.fields.ownerKind')} name="ownerKind">
            <Select
              disabled={!!editing?.workstationId}
              options={(['NONE', 'PORT', 'DEVICE'] as const).map((k) => ({ value: k, label: t(`ip:ipAddress.ownerKinds.${k}`) }))}
            />
          </Form.Item>
          {ownerKind !== 'NONE' && (
            <Form.Item label={t('ip:ipAddress.fields.device')} name="deviceId" rules={[{ required: true }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={t('ip:ipAddress.placeholders.selectDevice')}
                options={devices.map((d) => ({ value: d.id, label: `${d.name} (${d.type})` }))}
                onChange={() => form.setFieldsValue({ panelId: undefined, portId: undefined })}
              />
            </Form.Item>
          )}
          {ownerKind === 'PORT' && (
            <Space style={{ width: '100%' }} align="start">
              <Form.Item label={t('ip:ipAddress.fields.panel')} name="panelId" style={{ width: 260 }}>
                <Select
                  placeholder={t('ip:ipAddress.placeholders.selectPanel')}
                  options={panels.map((p) => ({ value: p.id, label: p.name }))}
                  onChange={() => form.setFieldValue('portId', undefined)}
                />
              </Form.Item>
              <Form.Item label={t('ip:ipAddress.fields.port')} name="portId" rules={[{ required: true }]} style={{ width: 260 }}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('ip:ipAddress.placeholders.selectPort')}
                  options={ports.map((p) => ({ value: p.id, label: p.ifName ? `${p.number} (${p.ifName})` : p.number }))}
                />
              </Form.Item>
            </Space>
          )}
          <Divider />
          <Form.Item label={t('ip:ipAddress.fields.hostname')} name="hostname">
            <Input placeholder={t('ip:ipAddress.placeholders.hostname')} />
          </Form.Item>
          <Form.Item
            label={t('ip:ipAddress.fields.macAddress')}
            name="macAddress"
            rules={[{ pattern: /^[0-9A-Fa-f]{2}([:-]?[0-9A-Fa-f]{2}){5}$/, message: t('ip:ipAddress.validation.invalidMacAddress') }]}
          >
            <Input placeholder={t('ip:ipAddress.placeholders.macAddress')} />
          </Form.Item>
          <Form.Item label={t('ip:ipAddress.fields.description')} name="description">
            <Input.TextArea rows={2} placeholder={t('ip:ipAddress.placeholders.description')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('ip:ipAddress.batchReserve')} open={batchOpen} onOk={reserveBlock} onCancel={() => setBatchOpen(false)}>
        <Space>
          <Text>{t('ip:ipAddress.fields.count')}</Text>
          <InputNumber min={1} max={1024} value={batchCount} onChange={setBatchCount} />
        </Space>
      </Modal>
    </div>
  );
}
