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
  Cascader,
  Tabs,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  EyeOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Cabinet, Room, DataCenter, Device, DeviceType } from '@/types';
import { cabinetService } from '@/services/cabinetService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';
import { deviceService } from '@/services/deviceService';
import { CabinetVisualizer } from '@/components/CabinetVisualizer';


interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

export default function CabinetList() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>();
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [form] = Form.useForm();
  const [deviceForm] = Form.useForm();

  // 加载所有相关数据
  const loadAllData = async () => {
    try {
      const [dcData, roomData, deviceData] = await Promise.all([
        dataCenterService.getAll(),
        roomService.getAll(),
        deviceService.getAll(),
      ]);
      setDataCenters(dcData);
      setRooms(roomData);
      setDevices(deviceData);
    } catch (error) {
      console.error(error);
    }
  };

  // 加载机柜列表
  const loadCabinets = async (searchQuery?: string, roomId?: string) => {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await cabinetService.search(searchQuery);
      } else if (roomId) {
        data = await cabinetService.getAll(roomId);
      } else {
        data = await cabinetService.getAll();
      }
      setCabinets(data);
    } catch (error) {
      message.error('加载机柜列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    loadCabinets();
  }, []);

  // 构建级联选择器选项
  const getCascaderOptions = (): CascaderOption[] => {
    return dataCenters.map((dc) => ({
      value: dc.id,
      label: dc.name,
      children: rooms
        .filter((r) => r.dataCenterId === dc.id)
        .map((r) => ({
          value: r.id,
          label: r.name,
        })),
    }));
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (cabinet?: Cabinet) => {
    if (cabinet) {
      setEditingCabinet(cabinet);
      form.setFieldsValue(cabinet);
    } else {
      setEditingCabinet(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingCabinet(null);
    form.resetFields();
  };

  // 保存机柜
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingCabinet) {
        await cabinetService.update(editingCabinet.id, values);
        message.success('机柜更新成功');
      } else {
        await cabinetService.create(values);
        message.success('机柜创建成功');
      }
      handleCloseModal();
      loadCabinets(undefined, selectedRoom);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingCabinet ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除机柜
  const handleDelete = async (id: string) => {
    try {
      await cabinetService.delete(id);
      message.success('机柜删除成功');
      loadCabinets(undefined, selectedRoom);
    } catch (error) {
      message.error('删除失败');
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadCabinets(value);
  };

  // 按机房过滤
  const handleRoomFilter = (value: string) => {
    setSelectedRoom(value);
    loadCabinets(undefined, value);
  };

  // 获取机柜设备
  const getCabinetDevices = (cabinetId: string) => {
    return devices.filter((device) => device.cabinetId === cabinetId);
  };

  // 选择机柜进行可视化
  const handleSelectCabinet = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
  };

  // 打开设备编辑对话框
  const handleOpenDeviceModal = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      deviceForm.setFieldsValue(device);
    } else {
      setEditingDevice(null);
      deviceForm.resetFields();
      if (selectedCabinet) {
        deviceForm.setFieldsValue({ cabinetId: selectedCabinet.id });
      }
    }
    setDeviceModalVisible(true);
  };

  // 保存设备
  const handleSaveDevice = async () => {
    try {
      const values = await deviceForm.validateFields();
      if (editingDevice) {
        await deviceService.update(editingDevice.id, values);
        message.success('设备更新成功');
      } else {
        await deviceService.create(values);
        message.success('设备创建成功');
      }
      setDeviceModalVisible(false);
      deviceForm.resetFields();
      await loadAllData();
      await loadCabinets();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingDevice ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除设备
  const handleDeleteDevice = async (device: Device) => {
    Modal.confirm({
      title: '确定要删除这个设备吗？',
      content: `设备 ${device.name} (${device.model || '未知型号'})`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deviceService.delete(device.id);
          message.success('设备删除成功');
          await loadAllData();
          await loadCabinets();
        } catch (error) {
          message.error('删除失败');
          console.error(error);
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: '机柜名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '位置',
      dataIndex: 'position',
      key: 'position',
      render: (text: string) => text || '-',
    },
    {
      title: 'U数',
      dataIndex: 'height',
      key: 'height',
      render: (height: number) => `${height}U`,
    },
    {
      title: '所属机房',
      dataIndex: 'roomId',
      key: 'roomId',
      render: (roomId: string) => {
        const room = rooms.find((r) => r.id === roomId);
        if (!room) return '-';
        const dc = dataCenters.find((d) => d.id === room.dataCenterId);
        return (
          <Space>
            <Tag color="blue">{dc?.name}</Tag>
            <Tag color="green">{room.name}</Tag>
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
      render: (_: any, record: Cabinet) => (
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
            title="确定要删除这个机柜吗？"
            description="删除后将同时删除其下所有设备"
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
        <InboxOutlined /> 机柜管理
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        管理机房内的所有机柜和U位，支持2.5D可视化视图
      </p>

      <Tabs defaultActiveKey="list" type="card">
        <TabPane tab={<span><InboxOutlined />机柜列表</span>} key="list">
          <Card>
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                  新建机柜
                </Button>
                <Select
                  placeholder="选择机房"
                  allowClear
                  style={{ width: 200 }}
                  onChange={handleRoomFilter}
                  onClear={() => loadCabinets()}
                >
                  {rooms.map((room) => {
                    const dc = dataCenters.find((d) => d.id === room.dataCenterId);
                    return (
                      <Option key={room.id} value={room.id}>
                        {dc?.name} - {room.name}
                      </Option>
                    );
                  })}
                </Select>
              </Space>
              <Search
                placeholder="搜索机柜名称"
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
              />
            </Space>

            <Table
              columns={columns}
              dataSource={cabinets}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><EyeOutlined />可视化视图</span>} key="visual">
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                新建机柜
              </Button>
              <Select
                placeholder="选择机柜进行可视化"
                allowClear
                style={{ width: 250 }}
                value={selectedCabinet?.id}
                onChange={(value) => {
                  const cabinet = cabinets.find(c => c.id === value);
                  if (cabinet) {
                    handleSelectCabinet(cabinet);
                  } else {
                    setSelectedCabinet(null);
                  }
                }}
              >
                {cabinets.map((cabinet) => {
                  const room = rooms.find((r) => r.id === cabinet.roomId);
                  const dc = dataCenters.find((d) => d.id === room?.dataCenterId);
                  const cabinetDevices = getCabinetDevices(cabinet.id);
                  const usedUnits = cabinetDevices.reduce((sum, device) => sum + (device.uHeight || 1), 0);
                  const utilization = Math.round((usedUnits / cabinet.height) * 100);

                  return (
                    <Option key={cabinet.id} value={cabinet.id}>
                      <div>
                        <div>{dc?.name} - {room?.name} - {cabinet.name}</div>
                        <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                          {cabinet.height}U • {cabinetDevices.length}设备 • {utilization}%占用
                        </div>
                      </div>
                    </Option>
                  );
                })}
              </Select>
              {selectedCabinet && (
                <Button icon={<PlusOutlined />} onClick={() => handleOpenDeviceModal()}>
                  添加设备
                </Button>
              )}
            </Space>
          </div>

          {selectedCabinet ? (
            <div>
              <CabinetVisualizer
                cabinet={selectedCabinet}
                devices={getCabinetDevices(selectedCabinet.id)}
                onDeviceClick={handleOpenDeviceModal}
                onDeviceEdit={handleOpenDeviceModal}
                onDeviceDelete={handleDeleteDevice}
              />
            </div>
          ) : (
            <Card>
              <Empty
                description="请选择一个机柜进行可视化展示"
                style={{ padding: '60px 0' }}
              />
            </Card>
          )}
        </TabPane>
      </Tabs>

      <Modal
        title={editingCabinet ? '编辑机柜' : '新建机柜'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="机柜名称"
            rules={[{ required: true, message: '请输入机柜名称' }]}
          >
            <Input placeholder="例如：A-01" />
          </Form.Item>
          <Form.Item name="position" label="位置">
            <Input placeholder="例如：第一排第三列" />
          </Form.Item>
          <Form.Item
            name="height"
            label="U数"
            initialValue={42}
            rules={[{ required: true, message: '请输入U数' }]}
          >
            <InputNumber min={1} max={52} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="roomId"
            label="所属机房"
            rules={[{ required: true, message: '请选择机房' }]}
          >
            <Select placeholder="选择机房" showSearch optionFilterProp="children">
              {rooms.map((room) => {
                const dc = dataCenters.find((d) => d.id === room.dataCenterId);
                return (
                  <Option key={room.id} value={room.id}>
                    {dc?.name} - {room.name}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设备编辑对话框 */}
      <Modal
        title={editingDevice ? '编辑设备' : '新建设备'}
        open={deviceModalVisible}
        onOk={handleSaveDevice}
        onCancel={() => {
          setDeviceModalVisible(false);
          setEditingDevice(null);
          deviceForm.resetFields();
        }}
        width={600}
      >
        <Form form={deviceForm} layout="vertical">
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
              <Option value="SERVER">服务器</Option>
              <Option value="SWITCH">交换机</Option>
              <Option value="ROUTER">路由器</Option>
              <Option value="FIREWALL">防火墙</Option>
              <Option value="STORAGE">存储</Option>
              <Option value="PDU">PDU</Option>
              <Option value="OTHER">其他</Option>
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
