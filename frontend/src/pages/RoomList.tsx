import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Popconfirm,
  Typography,
  Tag,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Room, DataCenter } from '@/types';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export default function RoomList() {
  const { t } = useTranslation(['room', 'common']);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [selectedDataCenter, setSelectedDataCenter] = useState<string>();
  const [form] = Form.useForm();

  // 加载数据中心列表
  const loadDataCenters = async () => {
    try {
      const data = await dataCenterService.getAll();
      setDataCenters(data);
    } catch (error) {
      console.error(error);
    }
  };

  // 加载机房列表
  const loadRooms = async (searchQuery?: string, dataCenterId?: string) => {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await roomService.search(searchQuery);
      } else if (dataCenterId) {
        data = await roomService.getAll(dataCenterId);
      } else {
        data = await roomService.getAll();
      }
      setRooms(data);
    } catch (error) {
      message.error(t('room:messages.loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDataCenters();
    loadRooms();
  }, []);

  // 打开创建/编辑对话框
  const handleOpenModal = (room?: Room) => {
    if (room) {
      setEditingRoom(room);
      form.setFieldsValue(room);
    } else {
      setEditingRoom(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingRoom(null);
    form.resetFields();
  };

  // 保存机房
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingRoom) {
        await roomService.update(editingRoom.id, values);
        message.success(t('room:messages.updateSuccess'));
      } else {
        await roomService.create(values);
        message.success(t('room:messages.createSuccess'));
      }
      handleCloseModal();
      loadRooms(undefined, selectedDataCenter);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingRoom ? t('room:messages.updateFailed') : t('room:messages.createFailed'));
      console.error(error);
    }
  };

  // 删除机房
  const handleDelete = async (id: string) => {
    try {
      await roomService.delete(id);
      message.success(t('room:messages.deleteSuccess'));
      loadRooms(undefined, selectedDataCenter);
    } catch (error) {
      message.error(t('room:messages.deleteFailed'));
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadRooms(value);
  };

  // 按数据中心过滤
  const handleDataCenterFilter = (value: string) => {
    setSelectedDataCenter(value);
    loadRooms(undefined, value);
  };

  const columns = [
    {
      title: t('room:fields.id'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: t('room:fields.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('room:fields.floor'),
      dataIndex: 'floor',
      key: 'floor',
      render: (text: string) => text || '-',
    },
    {
      title: t('room:fields.dataCenter'),
      dataIndex: 'dataCenterId',
      key: 'dataCenterId',
      render: (dataCenterId: string) => {
        const dc = dataCenters.find((d) => d.id === dataCenterId);
        return dc ? <Tag color="blue">{dc.name}</Tag> : '-';
      },
    },
    {
      title: t('room:fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: t('room:fields.actions'),
      key: 'actions',
      width: 150,
      render: (_: any, record: Room) => (
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
            title={t('room:messages.deleteConfirm')}
            description={t('room:messages.deleteWarning')}
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
        <HomeOutlined /> {t('room:title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        {t('room:description')}
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              {t('common:actions.create')} {t('room:createTitle')}
            </Button>
            <Select
              placeholder={t('room:placeholders.dataCenter')}
              allowClear
              style={{ width: 200 }}
              onChange={handleDataCenterFilter}
              onClear={() => loadRooms()}
            >
              {dataCenters.map((dc) => (
                <Option key={dc.id} value={dc.id}>
                  {dc.name}
                </Option>
              ))}
            </Select>
          </Space>
          <Search
            placeholder={t('room:placeholders.search')}
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={rooms}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('room:table.total', { total }),
          }}
        />
      </Card>

      <Modal
        title={editingRoom ? t('room:editTitle') : t('room:createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText={t('common:actions.save')}
        cancelText={t('common:actions.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('room:fields.name')}
            rules={[{ required: true, message: t('room:validation.nameRequired') }]}
          >
            <Input placeholder={t('room:placeholders.name')} />
          </Form.Item>
          <Form.Item name="floor" label={t('room:fields.floor')}>
            <Input placeholder={t('room:placeholders.floor')} />
          </Form.Item>
          <Form.Item
            name="dataCenterId"
            label={t('room:fields.dataCenter')}
            rules={[{ required: true, message: t('room:validation.dataCenterRequired') }]}
          >
            <Select placeholder={t('room:placeholders.dataCenter')}>
              {dataCenters.map((dc) => (
                <Option key={dc.id} value={dc.id}>
                  {dc.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
