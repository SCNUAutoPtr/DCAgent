import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Tooltip, Typography, message } from 'antd';
import { CalculatorOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { RoomDto } from '@contracts/hierarchy';
import type { IpStatistics, SubnetDto } from '@contracts/ip';
import { calculateSubnet, ipv4ToInt, isNetworkAddress, parseCidr, type SubnetCalculation } from '@contracts/ipv4';
import { subnetService } from '@/services/ipService';
import { roomService } from '@/services/hierarchyService';
import { deleteWithForce } from '@/components/confirmForce';
import { paths } from '@/routes';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;

interface FormValues {
  name: string;
  network: string;
  gateway?: string;
  vlan?: number | null;
  dnsServers?: string;
  description?: string;
  roomId?: string | null;
}

const ipRule = (message: string) => ({
  validator: (_: unknown, v?: string) => (!v || ipv4ToInt(v) !== null ? Promise.resolve() : Promise.reject(new Error(message))),
});

export default function IpManagement() {
  const { t } = useTranslation(['ip', 'common']);
  const navigate = useNavigate();
  const [subnets, setSubnets] = useState<SubnetDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [stats, setStats] = useState<IpStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<{ roomId?: string; search?: string }>({});
  const [vlan, setVlan] = useState<number | null>(null);
  const [editing, setEditing] = useState<SubnetDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [calc, setCalc] = useState<SubnetCalculation | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [calcForm] = Form.useForm<{ network: string }>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([subnetService.list(filter), subnetService.statistics()]);
      setSubnets(list);
      setStats(s);
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
    roomService.list().then(setRooms, () => undefined);
  }, []);

  const shown = useMemo(() => (vlan ? subnets.filter((s) => s.vlan === vlan) : subnets), [subnets, vlan]);

  const cidrRule = {
    validator: (_: unknown, v?: string) => {
      const c = v ? parseCidr(v) : null;
      return c && isNetworkAddress(c) ? Promise.resolve() : Promise.reject(new Error(t('ip:subnet.validation.invalidNetwork')));
    },
  };

  const open = (s?: SubnetDto) => {
    setEditing(s ?? null);
    form.resetFields();
    form.setFieldsValue({
      name: s?.name ?? '',
      network: s?.network ?? '',
      gateway: s?.gateway ?? '',
      vlan: s?.vlan ?? null,
      dnsServers: s?.dnsServers.join(', ') ?? '',
      description: s?.description ?? '',
      roomId: s?.roomId ?? undefined,
    });
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    const body = {
      name: v.name,
      network: v.network,
      gateway: v.gateway || null,
      vlan: v.vlan ?? null,
      dnsServers: (v.dnsServers ?? '')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
      description: v.description,
      roomId: v.roomId ?? null,
    };
    try {
      if (editing) await subnetService.update({ id: editing.id, ...body });
      else await subnetService.create(body);
      message.success(t(editing ? 'ip:subnet.messages.updateSuccess' : 'ip:subnet.messages.createSuccess'));
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const remove = async (s: SubnetDto) => {
    const ok = await deleteWithForce((force, opts) => subnetService.delete({ id: s.id, force }, opts), {
      code: 'NOT_EMPTY',
      title: t('ip:subnet.messages.forceDeleteTitle'),
      content: t('ip:subnet.messages.forceDeleteContent'),
      okText: t('ip:buttons.delete'),
      cancelText: t('ip:buttons.cancel'),
    });
    if (ok) {
      message.success(t('ip:subnet.messages.deleteSuccess'));
      load();
    }
  };

  const calculate = async () => {
    const v = await calcForm.validateFields();
    setCalc(calculateSubnet(parseCidr(v.network)!));
  };

  // Every column has a width and the scroll x is their sum, so the fixed actions column never covers another one.
  const columns = [
    {
      title: t('ip:subnet.fields.name'),
      dataIndex: 'name',
      key: 'name',
      width: 220,
      ellipsis: { showTitle: false },
      render: (name: string, s: SubnetDto) => (
        <Tooltip title={name} placement="topLeft">
          <Button type="link" style={{ padding: 0, maxWidth: '100%' }} onClick={() => navigate(paths.subnet(s.id))}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{name}</span>
          </Button>
        </Tooltip>
      ),
    },
    {
      title: t('ip:subnet.fields.network'),
      dataIndex: 'network',
      key: 'network',
      width: 160,
      render: (v: string) => (
        <Text code style={{ whiteSpace: 'nowrap' }}>
          {v}
        </Text>
      ),
    },
    {
      title: t('ip:subnet.fields.gateway'),
      dataIndex: 'gateway',
      key: 'gateway',
      width: 120,
      ellipsis: true,
      render: (v: string | null) => <span style={{ whiteSpace: 'nowrap' }}>{v || '-'}</span>,
    },
    { title: t('ip:subnet.fields.vlan'), dataIndex: 'vlan', key: 'vlan', width: 70, render: (v: number | null) => (v ? <Tag color="blue">{v}</Tag> : '-') },
    { title: t('ip:subnet.fields.room'), dataIndex: 'roomName', key: 'roomName', width: 90, ellipsis: true, render: (v: string | null) => v || '-' },
    { title: t('ip:subnet.fields.capacity'), key: 'capacity', width: 80, align: 'right' as const, render: (_: unknown, s: SubnetDto) => s.usage.capacity },
    { title: t('ip:subnet.fields.freeIps'), key: 'free', width: 80, align: 'right' as const, render: (_: unknown, s: SubnetDto) => <Text type="success">{s.usage.free}</Text> },
    { title: t('ip:subnet.fields.allocatedIps'), key: 'allocated', width: 80, align: 'right' as const, render: (_: unknown, s: SubnetDto) => <Text type="warning">{s.usage.allocated}</Text> },
    { title: t('ip:subnet.fields.reservedIps'), key: 'reserved', width: 80, align: 'right' as const, render: (_: unknown, s: SubnetDto) => s.usage.reserved },
    { title: t('ip:subnet.fields.utilizationRate'), key: 'util', width: 90, align: 'right' as const, render: (_: unknown, s: SubnetDto) => `${s.usage.utilization.toFixed(2)}%` },
    {
      title: t('ip:buttons.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 120,
      // icons only, each with a tooltip: keeps the fixed column narrow so it does not sit on the numbers
      render: (_: unknown, s: SubnetDto) => (
        <Space size={0}>
          <Tooltip title={t('ip:buttons.viewDetail')}>
            <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(paths.subnet(s.id))} aria-label={t('ip:buttons.viewDetail')} />
          </Tooltip>
          <Tooltip title={t('ip:buttons.edit')}>
            <Button type="link" icon={<EditOutlined />} onClick={() => open(s)} aria-label={t('ip:buttons.edit')} />
          </Tooltip>
          <Tooltip title={t('ip:buttons.delete')}>
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => remove(s)} aria-label={t('ip:buttons.delete')} />
          </Tooltip>
        </Space>
      ),
    },
  ];
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);

  return (
    <div>
      <Title level={2}>{t('ip:title')}</Title>
      <Text type="secondary">{t('ip:description')}</Text>

      {stats && (
        <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title={t('ip:statistics.totalSubnets')} value={stats.totalSubnets} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title={t('ip:statistics.totalIps')} value={stats.capacity} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title={t('ip:statistics.freeIps')} value={stats.free} valueStyle={{ color: '#3f8600' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('ip:statistics.utilizationRate')}
                value={stats.utilization}
                precision={2}
                suffix="%"
                valueStyle={{ color: stats.utilization > 80 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <SearchInput
              placeholder={t('ip:subnet.placeholders.search')}
              onSearch={(search) => setFilter((f) => ({ ...f, search: search || undefined }))}
              style={{ width: 250 }}
            />
            <Select
              placeholder={t('ip:filters.room')}
              onChange={(roomId?: string) => setFilter((f) => ({ ...f, roomId }))}
              style={{ width: 150 }}
              allowClear
              options={rooms.map((r) => ({ value: r.id, label: r.name }))}
            />
            <InputNumber placeholder={t('ip:filters.vlan')} min={1} max={4094} value={vlan} onChange={(v) => setVlan(v)} style={{ width: 120 }} />
          </Space>
          <Space>
            <Button icon={<CalculatorOutlined />} onClick={() => setCalcOpen(true)}>
              {t('ip:subnet.calculation.title')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
              {t('ip:buttons.createSubnet')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={load}>
              {t('ip:buttons.refresh')}
            </Button>
          </Space>
        </Space>
      </Card>

      <Card>
        <Table columns={columns} dataSource={shown} rowKey="id" loading={loading} tableLayout="fixed" scroll={{ x: tableWidth }} locale={{ emptyText: t('ip:noData.noSubnets') }} />
      </Card>

      <Modal
        title={editing ? t('ip:subnet.editTitle') : t('ip:subnet.createTitle')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        width={600}
        okText={t('ip:buttons.save')}
        cancelText={t('ip:buttons.cancel')}
        forceRender
      >
        <Form name="ip-management-form" form={form} layout="vertical">
          <Form.Item label={t('ip:subnet.fields.name')} name="name" rules={[{ required: true, message: t('ip:subnet.validation.nameRequired') }]}>
            <Input placeholder={t('ip:subnet.placeholders.name')} />
          </Form.Item>
          <Form.Item label={t('ip:subnet.fields.network')} name="network" rules={[{ required: true, message: t('ip:subnet.validation.networkRequired') }, cidrRule]}>
            <Input placeholder={t('ip:subnet.placeholders.network')} />
          </Form.Item>
          <Form.Item label={t('ip:subnet.fields.gateway')} name="gateway" rules={[ipRule(t('ip:subnet.validation.invalidGateway'))]}>
            <Input placeholder={t('ip:subnet.placeholders.gateway')} />
          </Form.Item>
          <Form.Item label={t('ip:subnet.fields.vlan')} name="vlan">
            <InputNumber min={1} max={4094} placeholder={t('ip:subnet.placeholders.vlan')} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label={t('ip:subnet.fields.dnsServers')}
            name="dnsServers"
            rules={[
              {
                validator: (_: unknown, v?: string) =>
                  (v ?? '')
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .every((x) => ipv4ToInt(x) !== null)
                    ? Promise.resolve()
                    : Promise.reject(new Error(t('ip:subnet.validation.invalidDns'))),
              },
            ]}
          >
            <Input placeholder={t('ip:subnet.placeholders.dnsServers')} />
          </Form.Item>
          <Form.Item label={t('ip:subnet.fields.room')} name="roomId">
            <Select placeholder={t('ip:filters.room')} allowClear options={rooms.map((r) => ({ value: r.id, label: r.name }))} />
          </Form.Item>
          <Form.Item label={t('ip:subnet.fields.description')} name="description">
            <Input.TextArea rows={3} placeholder={t('ip:subnet.placeholders.description')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('ip:subnet.calculation.title')}
        open={calcOpen}
        onCancel={() => {
          setCalcOpen(false);
          setCalc(null);
        }}
        footer={null}
        width={700}
        forceRender
      >
        <Form name="ip-management-calc-form" form={calcForm} layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item name="network" rules={[{ required: true, message: t('ip:subnet.validation.networkRequired') }, cidrRule]}>
            <Input placeholder={t('ip:subnet.placeholders.network')} style={{ width: 240 }} onPressEnter={calculate} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={calculate} icon={<CalculatorOutlined />}>
              {t('ip:subnet.calculation.calculate')}
            </Button>
          </Form.Item>
        </Form>
        {calc && (
          <Card>
            <Row gutter={[16, 16]}>
              {(
                [
                  ['subnet.calculation.networkAddress', calc.networkAddress],
                  ['subnet.calculation.broadcastAddress', calc.broadcastAddress],
                  ['subnet.fields.subnetMask', calc.subnetMask],
                  ['subnet.calculation.wildcardMask', calc.wildcardMask],
                  ['subnet.calculation.firstUsableIp', calc.firstUsableIp],
                  ['subnet.calculation.lastUsableIp', calc.lastUsableIp],
                  ['subnet.calculation.totalHosts', String(calc.totalHosts)],
                  ['subnet.calculation.usableHosts', String(calc.usableHosts)],
                ] as const
              ).map(([key, value]) => (
                <Col span={12} key={key}>
                  <Text strong>{t(`ip:${key}`)}: </Text>
                  <Text code>{value}</Text>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Modal>
    </div>
  );
}
