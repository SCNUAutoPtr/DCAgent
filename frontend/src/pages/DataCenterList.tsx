import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Typography, message } from 'antd';
import { DatabaseOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DataCenterDto } from '@contracts/hierarchy';
import { dataCenterService } from '@/services/hierarchyService';
import { SearchInput } from '@/components/SearchInput';

const { Title } = Typography;

interface FormValues {
  name: string;
  location?: string | null;
}

export default function DataCenterList() {
  const { t } = useTranslation(['dataCenter', 'common']);
  const [rows, setRows] = useState<DataCenterDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DataCenterDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await dataCenterService.list({ search: search || undefined }));
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (dc?: DataCenterDto) => {
    setEditing(dc ?? null);
    form.setFieldsValue({ name: dc?.name ?? '', location: dc?.location ?? '' });
    setModalOpen(true);
  };

  const save = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await dataCenterService.update({ id: editing.id, ...values });
        message.success(t('dataCenter:messages.updateSuccess'));
      } else {
        await dataCenterService.create(values);
        message.success(t('dataCenter:messages.createSuccess'));
      }
      setModalOpen(false);
      load();
    } catch {
      // reported by rpc
    }
  };

  const remove = async (id: string) => {
    try {
      await dataCenterService.delete({ id });
      message.success(t('dataCenter:messages.deleteSuccess'));
      load();
    } catch {
      // reported by rpc
    }
  };

  const columns = [
    { title: t('dataCenter:fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('dataCenter:fields.location'), dataIndex: 'location', key: 'location', render: (v: string | null) => v || '-' },
    { title: t('dataCenter:fields.roomCount'), dataIndex: 'roomCount', key: 'roomCount', width: 100 },
    { title: t('dataCenter:fields.createdAt'), dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
    {
      title: t('dataCenter:fields.actions'),
      key: 'actions',
      width: 180,
      render: (_: unknown, record: DataCenterDto) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => open(record)}>
            {t('common:actions.edit')}
          </Button>
          <Popconfirm
            title={t('dataCenter:messages.deleteConfirm')}
            description={t('dataCenter:messages.deleteWarning')}
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
        <DatabaseOutlined /> {t('dataCenter:title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>{t('dataCenter:description')}</p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>
            {t('dataCenter:createTitle')}
          </Button>
          <SearchInput placeholder={t('dataCenter:placeholders.search')} onSearch={setSearch} style={{ width: 300 }} />
        </Space>
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => t('dataCenter:table.total', { total }) }}
        />
      </Card>

      <Modal
        title={editing ? t('dataCenter:editTitle') : t('dataCenter:createTitle')}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
        forceRender
      >
        <Form name="data-center-list-form" form={form} layout="vertical">
          <Form.Item name="name" label={t('dataCenter:fields.name')} rules={[{ required: true, message: t('dataCenter:validation.nameRequired') }]}>
            <Input placeholder={t('dataCenter:placeholders.name')} />
          </Form.Item>
          <Form.Item name="location" label={t('dataCenter:fields.location')}>
            <Input placeholder={t('dataCenter:placeholders.location')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
