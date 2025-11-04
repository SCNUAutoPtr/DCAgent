import { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  List,
  Typography,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Empty,
  Divider,
  Collapse,
  Statistic,
  Row,
  Col,
  Radio,
  Tooltip,
} from 'antd';
import {
  InboxOutlined,
  CloudServerOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  EyeOutlined,
  SettingOutlined,
  AppstoreOutlined,
  BlockOutlined,
} from '@ant-design/icons';
import {
  Cabinet,
  Device,
  DeviceType,
  Room,
  DataCenter,
} from '@/types';
import { cabinetService } from '@/services/cabinetService';
import { deviceService } from '@/services/deviceService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';
import { CabinetVisualizer, ViewMode } from '@/components/CabinetVisualizer';
import './CabinetVisualizationPage.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { Panel: CollapsePanel } = Collapse;

// 设备类型配置
const deviceTypeMap: Record<DeviceType, { label: string; color: string }> = {
  SERVER: { label: '服务器', color: 'blue' },
  SWITCH: { label: '交换机', color: 'green' },
  ROUTER: { label: '路由器', color: 'orange' },
  FIREWALL: { label: '防火墙', color: 'red' },
  STORAGE: { label: '存储', color: 'purple' },
  PDU: { label: 'PDU', color: 'cyan' },
  OTHER: { label: '其他', color: 'default' },
};

export default function CabinetVisualizationPage() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // 从 localStorage 读取用户偏好，默认使用 2D
    const saved = localStorage.getItem('cabinet-view-mode');
    return (saved === '3d' ? '3d' : '2d') as ViewMode;
  });
  const [loading, setLoading] = useState(false);

  // 对话框状态
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [cabinetModalVisible, setCabinetModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);

  const [deviceForm] = Form.useForm();
  const [cabinetForm] = Form.useForm();

  // 加载所有数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [cabinetData, deviceData, roomData, dcData] = await Promise.all([
        cabinetService.getAll(),
        deviceService.getAll(),
        roomService.getAll(),
        dataCenterService.getAll(),
      ]);
      setCabinets(cabinetData);
      setDevices(deviceData);
      setRooms(roomData);
      setDataCenters(dcData);
    } catch (error) {
      message.error('加载数据失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 视图模式切换处理
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('cabinet-view-mode', mode);
  };

  // 选择机柜
  const handleSelectCabinet = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
  };

  // 获取机柜设备
  const getCabinetDevices = (cabinetId: string) => {
    return devices
      .filter((device) => device.cabinetId === cabinetId)
      .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0));
  };

  // 计算机柜统计
  const getCabinetStats = (cabinet: Cabinet) => {
    const cabinetDevices = getCabinetDevices(cabinet.id);
    const usedUnits = cabinetDevices.reduce(
      (sum, device) => sum + (device.uHeight || 1),
      0
    );
    const availableUnits = cabinet.height - usedUnits;
    const utilization = (usedUnits / cabinet.height) * 100;

    return {
      totalDevices: cabinetDevices.length,
      usedUnits,
      availableUnits,
      utilization: Math.round(utilization),
    };
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
      await loadData();
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
          await loadData();
        } catch (error) {
          message.error('删除失败');
          console.error(error);
        }
      },
    });
  };

  // 打开机柜编辑对话框
  const handleOpenCabinetModal = (cabinet?: Cabinet) => {
    if (cabinet) {
      setEditingCabinet(cabinet);
      cabinetForm.setFieldsValue(cabinet);
    } else {
      setEditingCabinet(null);
      cabinetForm.resetFields();
    }
    setCabinetModalVisible(true);
  };

  // 保存机柜
  const handleSaveCabinet = async () => {
    try {
      const values = await cabinetForm.validateFields();
      if (editingCabinet) {
        await cabinetService.update(editingCabinet.id, values);
        message.success('机柜更新成功');
      } else {
        await cabinetService.create(values);
        message.success('机柜创建成功');
      }
      setCabinetModalVisible(false);
      cabinetForm.resetFields();
      await loadData();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingCabinet ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除机柜
  const handleDeleteCabinet = async (cabinet: Cabinet) => {
    const cabinetDevices = getCabinetDevices(cabinet.id);
    if (cabinetDevices.length > 0) {
      message.error('请先删除机柜中的所有设备');
      return;
    }

    Modal.confirm({
      title: '确定要删除这个机柜吗？',
      content: `机柜 ${cabinet.name}`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await cabinetService.delete(cabinet.id);
          message.success('机柜删除成功');
          if (selectedCabinet?.id === cabinet.id) {
            setSelectedCabinet(null);
          }
          await loadData();
        } catch (error) {
          message.error('删除失败');
          console.error(error);
        }
      },
    });
  };

  // 按机房分组机柜
  const cabinetsByRoom = rooms.map((room) => ({
    room,
    cabinets: cabinets.filter((c) => c.roomId === room.id),
  }));

  return (
    <div className="cabinet-visualization-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <InboxOutlined /> 机柜可视化
          </Title>
          <Text type="secondary">
            {viewMode === '3d' ? '2.5D立体视图展示机柜U位分布和设备布局' : '2D前面板视图展示机柜设备详情'}
          </Text>
        </div>

        {/* 视图模式切换器 */}
        <Space>
          <Text type="secondary">视图模式：</Text>
          <Button.Group>
            <Tooltip title="2D前面板视图">
              <Button
                type={viewMode === '2d' ? 'primary' : 'default'}
                icon={<AppstoreOutlined />}
                onClick={() => handleViewModeChange('2d')}
              >
                2D视图
              </Button>
            </Tooltip>
            <Tooltip title="3D立体视图">
              <Button
                type={viewMode === '3d' ? 'primary' : 'default'}
                icon={<BlockOutlined />}
                onClick={() => handleViewModeChange('3d')}
              >
                3D视图
              </Button>
            </Tooltip>
          </Button.Group>
        </Space>
      </div>

      <Layout style={{ background: '#fff', minHeight: 'calc(100vh - 200px)' }}>
        {/* 左侧：机柜列表 */}
        <Sider
          width={320}
          style={{
            background: '#fafafa',
            borderRight: '1px solid #e8e8e8',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          <div style={{ padding: 16 }}>
            <div style={{ marginBottom: 16 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenCabinetModal()}
                block
              >
                新建机柜
              </Button>
            </div>

            {cabinetsByRoom.length === 0 ? (
              <Empty description="暂无机柜" />
            ) : (
              <Collapse ghost>
                {cabinetsByRoom.map(({ room, cabinets: roomCabinets }) => (
                  <CollapsePanel
                    key={room.id}
                    header={
                      <Space>
                        <Text strong>{room.name}</Text>
                        <Tag color="blue">{roomCabinets.length} 个机柜</Tag>
                      </Space>
                    }
                  >
                    {roomCabinets.length === 0 ? (
                      <Empty description="暂无机柜" />
                    ) : (
                      <List
                        size="small"
                        dataSource={roomCabinets}
                        renderItem={(cabinet) => {
                          const stats = getCabinetStats(cabinet);
                          const isSelected = selectedCabinet?.id === cabinet.id;

                          return (
                            <List.Item
                              className={`cabinet-item ${isSelected ? 'selected' : ''}`}
                              style={{
                                cursor: 'pointer',
                                padding: '12px 16px',
                                borderRadius: 4,
                                border: isSelected
                                  ? '2px solid #1890ff'
                                  : '1px solid transparent',
                                backgroundColor: isSelected
                                  ? '#e6f7ff'
                                  : '#fff',
                                marginBottom: 8,
                              }}
                              onClick={() => handleSelectCabinet(cabinet)}
                            >
                              <div style={{ width: '100%' }}>
                                <div style={{ marginBottom: 8 }}>
                                  <Space>
                                    <Text strong>{cabinet.name}</Text>
                                    <Tag color="blue">{cabinet.height}U</Tag>
                                    <Tag
                                      color={
                                        stats.utilization > 80
                                          ? 'red'
                                          : stats.utilization > 60
                                          ? 'orange'
                                          : 'green'
                                      }
                                    >
                                      {stats.utilization}%
                                    </Tag>
                                  </Space>
                                </div>

                                <Row gutter={8} style={{ fontSize: 12 }}>
                                  <Col span={8}>
                                    <Statistic
                                      title="设备数"
                                      value={stats.totalDevices}
                                      valueStyle={{ fontSize: 12 }}
                                    />
                                  </Col>
                                  <Col span={8}>
                                    <Statistic
                                      title="已用U"
                                      value={stats.usedUnits}
                                      suffix={`/ ${cabinet.height}`}
                                      valueStyle={{ fontSize: 12 }}
                                    />
                                  </Col>
                                  <Col span={8}>
                                    <Statistic
                                      title="可用U"
                                      value={stats.availableUnits}
                                      valueStyle={{ fontSize: 12 }}
                                    />
                                  </Col>
                                </Row>

                                <div style={{ marginTop: 8 }}>
                                  <Space split={<span>|</span>}>
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<PlusOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedCabinet(cabinet);
                                        handleOpenDeviceModal();
                                      }}
                                    >
                                      添加设备
                                    </Button>
                                    <Button
                                      type="link"
                                      size="small"
                                      icon={<EditOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenCabinetModal(cabinet);
                                      }}
                                    >
                                      编辑
                                    </Button>
                                    <Button
                                      type="link"
                                      size="small"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteCabinet(cabinet);
                                      }}
                                    >
                                      删除
                                    </Button>
                                  </Space>
                                </div>
                              </div>
                            </List.Item>
                          );
                        }}
                      />
                    )}
                  </CollapsePanel>
                ))}
              </Collapse>
            )}
          </div>
        </Sider>

        {/* 右侧：机柜可视化 */}
        <Content style={{ padding: 24 }}>
          {selectedCabinet ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenDeviceModal()}
                  >
                    添加设备
                  </Button>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => handleOpenCabinetModal(selectedCabinet)}
                  >
                    编辑机柜
                  </Button>
                  <Button
                    icon={<EyeOutlined />}
                    onClick={() => {
                      const location = getCabinetDevices(selectedCabinet.id);
                      console.log('机柜设备详情:', location);
                    }}
                  >
                    查看详情
                  </Button>
                </Space>
              </div>

              <CabinetVisualizer
                cabinet={selectedCabinet}
                devices={getCabinetDevices(selectedCabinet.id)}
                viewMode={viewMode}
                onDeviceClick={handleOpenDeviceModal}
                onDeviceEdit={handleOpenDeviceModal}
                onDeviceDelete={handleDeleteDevice}
              />

              <Divider />

              {/* 设备列表 */}
              <Card title="设备列表" size="small">
                <List
                  dataSource={getCabinetDevices(selectedCabinet.id)}
                  renderItem={(device) => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenDeviceModal(device)}
                        >
                          编辑
                        </Button>,
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteDevice(device)}
                        >
                          删除
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{device.name}</Text>
                            <Tag color={deviceTypeMap[device.type].color}>
                              {deviceTypeMap[device.type].label}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space size={16}>
                            <Text type="secondary">
                              位置: U{device.uPosition} (高{device.uHeight}U)
                            </Text>
                            {device.model && (
                              <Text type="secondary">型号: {device.model}</Text>
                            )}
                            {device.serialNo && (
                              <Text type="secondary">SN: {device.serialNo}</Text>
                            )}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </div>
          ) : (
            <Empty
              description="请从左侧选择一个机柜"
              style={{ marginTop: 100 }}
            />
          )}
        </Content>
      </Layout>

      {/* 设备编辑对话框 */}
      <Modal
        title={editingDevice ? '编辑设备' : '新建设备'}
        open={deviceModalVisible}
        onOk={handleSaveDevice}
        onCancel={() => {
          setDeviceModalVisible(false);
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

      {/* 机柜编辑对话框 */}
      <Modal
        title={editingCabinet ? '编辑机柜' : '新建机柜'}
        open={cabinetModalVisible}
        onOk={handleSaveCabinet}
        onCancel={() => {
          setCabinetModalVisible(false);
          cabinetForm.resetFields();
        }}
      >
        <Form form={cabinetForm} layout="vertical">
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
    </div>
  );
}
