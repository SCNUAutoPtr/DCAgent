import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AutoComplete, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Typography, message } from 'antd';
import { BarcodeOutlined, DeleteOutlined, EditOutlined, PlusOutlined, SearchOutlined, ToolOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { MODULE_STATUSES, TRANSCEIVER_FORMS, type ModuleStatus, type TransceiverForm } from '@contracts/enums';
import type { ModuleDto, ModuleStatistics } from '@contracts/opticalModules';
import { opticalModuleService } from '@/services/opticalModuleService';
import { paths } from '@/routes';
import { MODULE_STATUS_COLORS } from '@/constants/colors';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;

const VENDORS = ['Cisco', 'Huawei', 'H3C', 'Mellanox', 'Finisar', 'FS'];

interface FormValues {
  serialNo: string;
  model: string;
  vendor: string;
  moduleType: TransceiverForm;
  wavelength?: string;
  distance?: string;
  ddmSupport?: boolean;
  supplier?: string;
  price?: number | null;
  purchaseDate?: Dayjs | null;
  warrantyExpiry?: Dayjs | null;
  notes?: string;
}

export default function OpticalModuleList() {
  const { t } = useTranslation('opticalModule');
  const navigate = useNavigate();
  const [modules, setModules] = useState<ModuleDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState({ current: 1, pageSize: 20 });
  const [filter, setFilter] = useState<{ status?: ModuleStatus; moduleType?: TransceiverForm; search?: string }>({});
  const [stats, setStats] = useState<ModuleStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<ModuleDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        opticalModuleService.list({ ...filter, take: page.pageSize, skip: (page.current - 1) * page.pageSize }),
        opticalModuleService.statistics(),
      ]);
      setModules(list.items);
      setTotal(list.total);
      setStats(s);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (m?: ModuleDto) => {
    setEditing(m ?? null);
    form.resetFields();
    if (m) {
      form.setFieldsValue({
        ...m,
        wavelength: m.wavelength ?? '',
        distance: m.distance ?? '',
        supplier: m.supplier ?? '',
        notes: m.notes ?? '',
        purchaseDate: m.purchaseDate ? dayjs(m.purchaseDate) : null,
        warrantyExpiry: m.warrantyExpiry ? dayjs(m.warrantyExpiry) : null,
      });
    }
    setModalOpen(true);
  };

  const save = async () => {
    const v = await form.validateFields();
    const body = {
      model: v.model,
      vendor: v.vendor,
      moduleType: v.moduleType,
      wavelength: v.wavelength,
      distance: v.distance,
      ddmSupport: v.ddmSupport ?? false,
      supplier: v.supplier,
      price: v.price ?? null,
      purchaseDate: v.purchaseDate ? v.purchaseDate.toDate() : null,
      warrantyExpiry: v.warrantyExpiry ? v.warrantyExpiry.toDate() : null,
      notes: v.notes,
    };
    try {
      if (editing) await opticalModuleService.update({ id: editing.id, ...body });
      else await opticalModuleService.create({ serialNo: v.serialNo, ...body });
      message.success(t(editing ? 'messages.updateSuccess' : 'messages.createSuccess'));
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const remove = async (id: string) => {
    try {
      await opticalModuleService.delete({ id });
      message.success(t('messages.deleteSuccess'));
      load();
    } catch {
      // reported by rpc
    }
  };

  const columns = [
    {
      title: t('fields.serialNo'),
      dataIndex: 'serialNo',
      key: 'serialNo',
      width: 170,
      render: (v: string, m: ModuleDto) => (
        <Button type="link" onClick={() => navigate(paths.opticalModule(m.id))}>
          <BarcodeOutlined /> {v}
        </Button>
      ),
    },
    { title: t('fields.model'), dataIndex: 'model', key: 'model', width: 150 },
    { title: t('fields.vendor'), dataIndex: 'vendor', key: 'vendor', width: 120 },
    { title: t('fields.moduleType'), dataIndex: 'moduleType', key: 'moduleType', width: 140, render: (type: TransceiverForm) => <Tag color="blue">{t(`moduleTypes.${type}`)}</Tag> },
    {
      title: `${t('fields.wavelength')}/${t('fields.distance')}`,
      key: 'specs',
      width: 150,
      render: (_: unknown, m: ModuleDto) => (
        <Space direction="vertical" size={0}>
          {m.wavelength && <Text type="secondary">{m.wavelength}</Text>}
          {m.distance && <Text type="secondary">{m.distance}</Text>}
        </Space>
      ),
    },
    { title: t('fields.status'), dataIndex: 'status', key: 'status', width: 100, render: (s: ModuleStatus) => <Tag color={MODULE_STATUS_COLORS[s]}>{t(`moduleStatus.${s}`)}</Tag> },
    {
      title: t('fields.currentPort'),
      key: 'location',
      width: 220,
      render: (_: unknown, m: ModuleDto) =>
        m.currentPort ? (
          <Space direction="vertical" size={0}>
            <Text strong>{m.currentPort.deviceName}</Text>
            <a onClick={() => navigate(paths.port(m.currentPort!.id))}>
              {m.currentPort.panelName} / {m.currentPort.number}
            </a>
          </Space>
        ) : (
          <Text type="secondary">{t('noData.noLocation')}</Text>
        ),
    },
    {
      title: t('fields.purchaseInfo'),
      key: 'purchase',
      width: 180,
      render: (_: unknown, m: ModuleDto) => (
        <Space direction="vertical" size={0}>
          {m.supplier && (
            <Text type="secondary">
              {t('fields.supplier')}: {m.supplier}
            </Text>
          )}
          {m.price !== null && (
            <Text type="secondary">
              {t('fields.price')}: {m.price}
            </Text>
          )}
          {m.purchaseDate && (
            <Text type="secondary">
              {t('fields.purchaseDate')}: {dayjs(m.purchaseDate).format('YYYY-MM-DD')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('fields.actions'),
      key: 'actions',
      width: 230,
      fixed: 'right' as const,
      render: (_: unknown, m: ModuleDto) => (
        <Space>
          <Button type="link" icon={<SearchOutlined />} onClick={() => navigate(paths.opticalModule(m.id))}>
            {t('buttons.viewDetail')}
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => open(m)}>
            {t('buttons.edit')}
          </Button>
          {m.status === 'IN_STOCK' && (
            <Popconfirm title={t('messages.deleteConfirm')} onConfirm={() => remove(m.id)} okText={t('buttons.confirm')} cancelText={t('buttons.cancel')}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                {t('buttons.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const statusOptions = MODULE_STATUSES.map((s) => ({ value: s, label: t(`moduleStatus.${s}`) }));
  const typeOptions = TRANSCEIVER_FORMS.map((f) => ({ value: f, label: t(`moduleTypes.${f}`) }));

  return (
    <div>
      <Title level={2}>
        <ToolOutlined /> {t('title')}
      </Title>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title={t('statistics.total')} value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title={t('statistics.inStock')} value={stats.byStatus.IN_STOCK} valueStyle={{ color: '#999' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title={t('statistics.installed')} value={stats.byStatus.INSTALLED} valueStyle={{ color: '#52c41a' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title={t('statistics.faulty')} value={stats.byStatus.FAULTY} valueStyle={{ color: '#ff4d4f' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <SearchInput
            placeholder={t('filters.search')}
            onSearch={(search) => {
              setFilter((f) => ({ ...f, search: search || undefined }));
              setPage((p) => ({ ...p, current: 1 }));
            }}
            style={{ width: 280 }}
          />
          <Select
            placeholder={t('filters.status')}
            style={{ width: 140 }}
            allowClear
            options={statusOptions}
            onChange={(status?: ModuleStatus) => {
              setFilter((f) => ({ ...f, status }));
              setPage((p) => ({ ...p, current: 1 }));
            }}
          />
          <Select
            placeholder={t('filters.moduleType')}
            style={{ width: 170 }}
            allowClear
            options={typeOptions}
            onChange={(moduleType?: TransceiverForm) => {
              setFilter((f) => ({ ...f, moduleType }));
              setPage((p) => ({ ...p, current: 1 }));
            }}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
            {t('buttons.create')}
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={modules}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            ...page,
            total,
            showSizeChanger: true,
            showTotal: (n) => t('pagination.total', { total: n }),
            onChange: (current, pageSize) => setPage({ current, pageSize }),
          }}
        />
      </Card>

      <Modal
        title={editing ? t('editTitle') : t('createTitle')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        width={800}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
        forceRender
      >
        <Form name="optical-module-list-form" form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="serialNo" label={t('fields.serialNo')} rules={[{ required: true, message: t('validation.serialNoRequired') }]}>
                <Input placeholder={t('placeholders.serialNo')} disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label={t('fields.model')} rules={[{ required: true, message: t('validation.modelRequired') }]}>
                <Input placeholder={t('placeholders.model')} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor" label={t('fields.vendor')} rules={[{ required: true, message: t('validation.vendorRequired') }]}>
                <AutoComplete placeholder={t('placeholders.vendor')} options={VENDORS.map((v) => ({ value: v }))} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="moduleType" label={t('fields.moduleType')} rules={[{ required: true, message: t('validation.moduleTypeRequired') }]}>
                <Select placeholder={t('placeholders.moduleType')} options={typeOptions} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="wavelength" label={t('fields.wavelength')}>
                <Input placeholder={t('placeholders.wavelength')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="distance" label={t('fields.distance')}>
                <Input placeholder={t('placeholders.distance')} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="ddmSupport" label={t('fields.ddmSupport')} valuePropName="checked">
            <Switch />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier" label={t('fields.supplier')}>
                <Input placeholder={t('placeholders.supplier')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label={t('fields.price')}>
                <InputNumber style={{ width: '100%' }} placeholder={t('placeholders.price')} min={0} precision={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="purchaseDate" label={t('fields.purchaseDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warrantyExpiry" label={t('fields.warranty')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label={t('fields.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.notes')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
