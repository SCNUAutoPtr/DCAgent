import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
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
  CloudServerOutlined,
} from '@ant-design/icons';
import { Device, DeviceType, Cabinet, Room, DataCenter } from '@/types';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/cabinetService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

// 设备类型中文映射
const deviceTypeMap: Record<DeviceType, { label: string; color: string }> = {
  SERVER: { label: '服务器', color: 'blue' },
  SWITCH: { label: '交换机', color: 'green' },
  ROUTER: { label: '路由器', color: 'orange' },
  FIREWALL: { label: '防火墙', color: 'red' },
  STORAGE: { label: '存储', color: 'purple' },
  PDU: { label: 'PDU', color: 'cyan' },
  OTHER: { label: '其他', color: 'default' },
};

export default function DeviceList() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<string>();
  const [selectedType, setSelectedType] = useState<DeviceType>();
  const [form] = Form.useForm();

  // 加载机柜、机房和数据中心
  const loadRelatedData = async () => {
    try {
      const [cabinetData, roomData, dcData] = await Promise.all([
        cabinetService.getAll(),
        roomService.getAll(),
        dataCenterService.getAll(),
      ]);
      setCabinets(cabinetData);
      setRooms(roomData);
      setDataCenters(dcData);
    } catch (error) {
      console.error(error);
    }
  };

  // 加载设备列表
  const loadDevices = async (searchQuery?: string, cabinetId?: string) => {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await deviceService.search(searchQuery);
      } else if (cabinetId) {
        data = await deviceService.getByCabinet(cabinetId);
      } else {
        data = await deviceService.getAll();
      }
      setDevices(data);
    } catch (error) {
      message.error('加载设备列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelatedData();
    loadDevices();
  }, []);

  // 获取设备位置信息
  const getDeviceLocation = (cabinetId: string) => {
    const cabinet = cabinets.find((c) => c.id === cabinetId);
    if (!cabinet) return null;
    const room = rooms.find((r) => r.id === cabinet.roomId);
    if (!room) return null;
    const dc = dataCenters.find((d) => d.id === room.dataCenterId);
    return { cabinet, room, dc };
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      form.setFieldsValue(device);
    } else {
      setEditingDevice(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingDevice(null);
    form.resetFields();
  };

  // 保存设备
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingDevice) {
        await deviceService.update(editingDevice.id, values);
        message.success('设备更新成功');
      } else {
        await deviceService.create(values);
        message.success('设备创建成功');
      }
      handleCloseModal();
      loadDevices(undefined, selectedCabinet);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingDevice ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除设备
  const handleDelete = async (id: string) => {
    try {
      await deviceService.delete(id);
      message.success('设备删除成功');
      loadDevices(undefined, selectedCabinet);
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadDevices(value);
  };

  // 按机柜过滤
  const handleCabinetFilter = (value: string) => {
    setSelectedCabinet(value);
    loadDevices(undefined, value);
  };

  // 按类型过滤
  const handleTypeFilter = (value: DeviceType) => {
    setSelectedType(value);
    // 过滤已加载的设备
    if (value) {
      setDevices(devices.filter((d) => d.type === value));
    } else {
      loadDevices();
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: DeviceType) => {
        const config = deviceTypeMap[type];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => text || '-',
    },
    {
      title: '序列号',
      dataIndex: 'serialNo',
      key: 'serialNo',
      render: (text: string) => text || '-',
    },
    {
      title: 'U位',
      key: 'uPosition',
      render: (_: any, record: Device) =>
        record.uPosition ? `${record.uPosition}U (高${record.uHeight}U)` : '-',
    },
    {
      title: '所在位置',
      dataIndex: 'cabinetId',
      key: 'cabinetId',
      render: (cabinetId: string) => {
        const location = getDeviceLocation(cabinetId);
        if (!location) return '-';
        return (
          <Space size={4} wrap>
            <Tag color="blue">{location.dc?.name}</Tag>
            <Tag color="green">{location.room.name}</Tag>
            <Tag color="orange">{location.cabinet.name}</Tag>
          </Space>
        );
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
      fixed: 'right' as const,
      render: (_: any, record: Device) => (
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
            title="确定要删除这个设备吗？"
            description="删除后将同时删除其下所有面板和端口"
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
        <CloudServerOutlined /> 设备管理
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        管理机柜内的所有设备，包括服务器、交换机、路由器等
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              新建设备
            </Button>
            <Select
              placeholder="选择机柜"
              allowClear
              style={{ width: 200 }}
              onChange={handleCabinetFilter}
              onClear={() => {
                setSelectedCabinet(undefined);
                loadDevices();
              }}
            >
              {cabinets.map((cabinet) => {
                const room = rooms.find((r) => r.id === cabinet.roomId);
                const dc = dataCenters.find((d) => d.id === room?.dataCenterId);
                return (
                  <Option key={cabinet.id} value={cabinet.id}>
                    {dc?.name} - {room?.name} - {cabinet.name}
                  </Option>
                );
              })}
            </Select>
            <Select
              placeholder="选择类型"
              allowClear
              style={{ width: 120 }}
              onChange={handleTypeFilter}
              onClear={() => {
                setSelectedType(undefined);
                loadDevices();
              }}
            >
              {Object.entries(deviceTypeMap).map(([key, value]) => (
                <Option key={key} value={key}>
                  {value.label}
                </Option>
              ))}
            </Select>
          </Space>
          <Search
            placeholder="搜索设备名称或型号"
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={devices}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      <Modal
        title={editingDevice ? '编辑设备' : '新建设备'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="设备名称"
            rules={[{ required: true, message: '请输入设备名称' }]}
          >
            <Input placeholder="例如：WEB-Server-01" />
          </Form.Item>
          <Form.Item
            name="type"
            label="设备类型"
            rules={[{ required: true, message: '请选择设备类型' }]}
          >
            <Select placeholder="选择设备类型">
              {Object.entries(deviceTypeMap).map(([key, value]) => (
                <Option key={key} value={key}>
                  {value.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="例如：Dell PowerEdge R740" />
          </Form.Item>
          <Form.Item name="serialNo" label="序列号">
            <Input placeholder="例如：SN123456789" />
          </Form.Item>
          <Form.Item
            name="cabinetId"
            label="所属机柜"
            rules={[{ required: true, message: '请选择机柜' }]}
          >
            <Select placeholder="选择机柜" showSearch optionFilterProp="children">
              {cabinets.map((cabinet) => {
                const room = rooms.find((r) => r.id === cabinet.roomId);
                const dc = dataCenters.find((d) => d.id === room?.dataCenterId);
                return (
                  <Option key={cabinet.id} value={cabinet.id}>
                    {dc?.name} - {room?.name} - {cabinet.name}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="uPosition" label="起始U位" style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={52} placeholder="1" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="uHeight" label="占用U数" initialValue={1} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={10} placeholder="1" style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
