import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  message,
  Space,
  Popconfirm,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { DataCenter } from '@/types';
import { dataCenterService } from '@/services/dataCenterService';

const { Title } = Typography;
const { Search } = Input;

export default function DataCenterList() {
  const { t } = useTranslation(['dataCenter', 'common']);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDataCenter, setEditingDataCenter] = useState<DataCenter | null>(null);
  const [form] = Form.useForm();

  // 加载数据中心列表
  const loadDataCenters = async (searchQuery?: string) => {
    setLoading(true);
    try {
      const data = searchQuery
        ? await dataCenterService.search(searchQuery)
        : await dataCenterService.getAll();
      setDataCenters(data);
    } catch (error) {
      message.error(t('dataCenter:messages.loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataCenters();
  }, []);

  // 打开创建/编辑对话框
  const handleOpenModal = (dataCenter?: DataCenter) => {
    if (dataCenter) {
      setEditingDataCenter(dataCenter);
      form.setFieldsValue(dataCenter);
    } else {
      setEditingDataCenter(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingDataCenter(null);
    form.resetFields();
  };

  // 保存数据中心
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingDataCenter) {
        await dataCenterService.update(editingDataCenter.id, values);
        message.success(t('dataCenter:messages.updateSuccess'));
      } else {
        await dataCenterService.create(values);
        message.success(t('dataCenter:messages.createSuccess'));
      }
      handleCloseModal();
      loadDataCenters();
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(editingDataCenter ? t('dataCenter:messages.updateFailed') : t('dataCenter:messages.createFailed'));
      console.error(error);
    }
  };

  // 删除数据中心
  const handleDelete = async (id: string) => {
    try {
      await dataCenterService.delete(id);
      message.success(t('dataCenter:messages.deleteSuccess'));
      loadDataCenters();
    } catch (error) {
      message.error(t('dataCenter:messages.deleteFailed'));
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadDataCenters(value);
  };

  const columns = [
    {
      title: t('dataCenter:fields.id'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: t('dataCenter:fields.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('dataCenter:fields.location'),
      dataIndex: 'location',
      key: 'location',
      render: (text: string) => text || '-',
    },
    {
      title: t('dataCenter:fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: t('dataCenter:fields.actions'),
      key: 'actions',
      width: 150,
      render: (_: any, record: DataCenter) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            {t('common:actions.edit')}
          </Button>
          <Popconfirm
            title={t('dataCenter:messages.deleteConfirm')}
            description={t('dataCenter:messages.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
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
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        {t('dataCenter:description')}
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
            {t('common:actions.create')} {t('dataCenter:createTitle')}
          </Button>
          <Search
            placeholder={t('dataCenter:placeholders.search')}
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={dataCenters}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('dataCenter:table.total', { total }),
          }}
        />
      </Card>

      <Modal
        title={editingDataCenter ? t('dataCenter:editTitle') : t('dataCenter:createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('dataCenter:fields.name')}
            rules={[{ required: true, message: t('dataCenter:validation.nameRequired') }]}
          >
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
