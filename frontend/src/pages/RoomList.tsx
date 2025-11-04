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
import { Room, DataCenter } from '@/types';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

export default function RoomList() {
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
      message.error('加载机房列表失败');
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
        message.success('机房更新成功');
      } else {
        await roomService.create(values);
        message.success('机房创建成功');
      }
      handleCloseModal();
      loadRooms(undefined, selectedDataCenter);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingRoom ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除机房
  const handleDelete = async (id: string) => {
    try {
      await roomService.delete(id);
      message.success('机房删除成功');
      loadRooms(undefined, selectedDataCenter);
    } catch (error) {
      message.error('删除失败');
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
      title: 'ID',
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: '机房名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
      render: (text: string) => text || '-',
    },
    {
      title: '所属数据中心',
      dataIndex: 'dataCenterId',
      key: 'dataCenterId',
      render: (dataCenterId: string) => {
        const dc = dataCenters.find((d) => d.id === dataCenterId);
        return dc ? <Tag color="blue">{dc.name}</Tag> : '-';
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
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
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个机房吗？"
            description="删除后将同时删除其下所有机柜和设备"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <HomeOutlined /> 机房管理
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        管理数据中心内的所有机房
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              新建机房
            </Button>
            <Select
              placeholder="选择数据中心"
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
            placeholder="搜索机房名称"
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
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingRoom ? '编辑机房' : '新建机房'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="机房名称"
            rules={[{ required: true, message: '请输入机房名称' }]}
          >
            <Input placeholder="例如：A区机房" />
          </Form.Item>
          <Form.Item name="floor" label="楼层">
            <Input placeholder="例如：3F" />
          </Form.Item>
          <Form.Item
            name="dataCenterId"
            label="所属数据中心"
            rules={[{ required: true, message: '请选择数据中心' }]}
          >
            <Select placeholder="选择数据中心">
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
