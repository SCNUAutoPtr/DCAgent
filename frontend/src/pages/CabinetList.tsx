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
  Layout,
  List,
  Statistic,
  Row,
  Col,
  Collapse,
  Divider,
  Tooltip,
  Descriptions,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  EyeOutlined,
  SettingOutlined,
  AppstoreOutlined,
  BlockOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { Cabinet, Room, DataCenter, Device, DeviceType, Panel, Port } from '@/types';
import { cabinetService } from '@/services/cabinetService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { portService } from '@/services/portService';
import { panelTemplateService } from '@/services/panelTemplateService';
import { CabinetVisualizer, ViewMode } from '@/components/CabinetVisualizer';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import { generatePortLayout, sortPortsByNumber } from '@/utils/panelLayoutGenerator';


interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;
const { Sider, Content } = Layout;
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

export default function CabinetList() {
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [panelViewModalVisible, setPanelViewModalVisible] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [viewingDevice, setViewingDevice] = useState<Device | null>(null);
  const [devicePanels, setDevicePanels] = useState<Panel[]>([]);
  const [panelPorts, setPanelPorts] = useState<Map<string, Port[]>>(new Map());
  const [selectedRoom, setSelectedRoom] = useState<string>();
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  const [activeTab, setActiveTab] = useState('list');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('cabinet-view-mode');
    return (saved === '3d' ? '3d' : '2d') as ViewMode;
  });
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
    return devices
      .filter((device) => device.cabinetId === cabinetId)
      .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0));
  };

  // 选择机柜进行可视化
  const handleSelectCabinet = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
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

  // 视图模式切换
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('cabinet-view-mode', mode);
  };

  // 跳转到可视化 Tab 并选中机柜
  const handleViewCabinet = (cabinet: Cabinet) => {
    setSelectedCabinet(cabinet);
    setActiveTab('visual');
  };

  // 按机房分组机柜
  const cabinetsByRoom = rooms.map((room) => ({
    room,
    dataCenterId: room.dataCenterId,
    cabinets: cabinets.filter((c) => c.roomId === room.id),
  }));

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

  // 打开设备面板查看对话框（左键点击）
  const handleViewDevicePanels = async (device: Device) => {
    try {
      setViewingDevice(device);
      const panels = await panelService.getByDevice(device.id);
      setDevicePanels(panels);

      // 加载每个面板的端口数据并生成布局
      const portsMap = new Map<string, Port[]>();
      await Promise.all(
        panels.map(async (panel) => {
          let ports = await portService.getByPanel(panel.id);

          // 按端口编号排序
          ports = sortPortsByNumber(ports);

          // 检查端口是否已有布局位置，如果没有则自动生成
          const hasLayout = ports.some(p => p.position);
          if (!hasLayout && ports.length > 0) {
            // 自动生成端口布局
            ports = generatePortLayout(ports, panel);
          }

          portsMap.set(panel.id, ports);
        })
      );
      setPanelPorts(portsMap);

      setPanelViewModalVisible(true);
    } catch (error) {
      console.error('Error loading device panels:', error);
      message.error('加载设备面板失败');
    }
  };

  // 解绑面板与模板
  const handleUnbindPanel = async (panelId: string) => {
    try {
      await panelTemplateService.unbindPanel(panelId);
      message.success('面板已从模板解绑，现在可以自定义端口布局');

      // 重新加载面板信息
      if (viewingDevice) {
        const panels = await panelService.getByDevice(viewingDevice.id);
        setDevicePanels(panels);
      }
    } catch (error: any) {
      message.error('解绑失败: ' + error.message);
      console.error('Error unbinding panel:', error);
    }
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
      width: 200,
      render: (_: any, record: Cabinet) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewCabinet(record)}
          >
            可视化
          </Button>
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
        管理机房内的所有机柜和U位，支持2D/3D可视化视图
      </p>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        <TabPane tab={<span><InboxOutlined /> 机柜列表</span>} key="list">
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

        <TabPane tab={<span><EyeOutlined /> 可视化视图</span>} key="visual">
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary">
              {viewMode === '3d' ? '2.5D立体视图展示机柜U位分布和设备布局' : '2D前面板视图展示机柜设备详情'}
            </Text>
            <Space>
              <Text type="secondary">视图模式：</Text>
              <Button.Group>
                <Tooltip title="2D前面板视图">
                  <Button
                    type={viewMode === '2d' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => handleViewModeChange('2d')}
                  >
                    2D
                  </Button>
                </Tooltip>
                <Tooltip title="3D立体视图">
                  <Button
                    type={viewMode === '3d' ? 'primary' : 'default'}
                    icon={<BlockOutlined />}
                    onClick={() => handleViewModeChange('3d')}
                  >
                    3D
                  </Button>
                </Tooltip>
              </Button.Group>
            </Space>
          </div>

          <Layout style={{ background: '#fff', minHeight: 'calc(100vh - 300px)' }}>
            {/* 左侧：机柜列表 */}
            <Sider
              width={320}
              style={{
                background: '#fafafa',
                borderRight: '1px solid #e8e8e8',
                overflowY: 'auto',
                maxHeight: 'calc(100vh - 300px)',
              }}
            >
              <div style={{ padding: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenModal()}
                    block
                  >
                    新建机柜
                  </Button>
                </div>

                {cabinetsByRoom.length === 0 ? (
                  <Empty description="暂无机柜" />
                ) : (
                  <Collapse ghost defaultActiveKey={cabinetsByRoom.map(({ room }) => room.id)}>
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
                                  style={{
                                    cursor: 'pointer',
                                    padding: '12px 16px',
                                    borderRadius: 4,
                                    border: isSelected ? '2px solid #1890ff' : '1px solid transparent',
                                    backgroundColor: isSelected ? '#e6f7ff' : '#fff',
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
                                            handleOpenModal(cabinet);
                                          }}
                                        >
                                          编辑
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
                        onClick={() => handleOpenModal(selectedCabinet)}
                      >
                        编辑机柜
                      </Button>
                    </Space>
                  </div>

                  <CabinetVisualizer
                    cabinet={selectedCabinet}
                    devices={getCabinetDevices(selectedCabinet.id)}
                    viewMode={viewMode}
                    onDeviceClick={handleViewDevicePanels}
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
                              key="edit"
                            >
                              编辑
                            </Button>,
                            <Button
                              type="link"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              onClick={() => handleDeleteDevice(device)}
                              key="delete"
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
                <Empty description="请从左侧选择一个机柜进行可视化展示" style={{ marginTop: 100 }} />
              )}
            </Content>
          </Layout>
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

      {/* 设备面板查看对话框 */}
      <Modal
        title={
          <Space>
            <CloudServerOutlined />
            {viewingDevice?.name} - 面板视图
          </Space>
        }
        open={panelViewModalVisible}
        onCancel={() => {
          setPanelViewModalVisible(false);
          setViewingDevice(null);
          setDevicePanels([]);
          setPanelPorts(new Map());
        }}
        footer={[
          <Button
            key="edit"
            icon={<EditOutlined />}
            onClick={() => {
              setPanelViewModalVisible(false);
              handleOpenDeviceModal(viewingDevice || undefined);
            }}
          >
            编辑设备
          </Button>,
          <Button
            key="close"
            type="primary"
            onClick={() => {
              setPanelViewModalVisible(false);
              setViewingDevice(null);
              setDevicePanels([]);
              setPanelPorts(new Map());
            }}
          >
            关闭
          </Button>,
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {viewingDevice && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="设备类型">
                <Tag color={deviceTypeMap[viewingDevice.type]?.color}>
                  {deviceTypeMap[viewingDevice.type]?.label || viewingDevice.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="型号">
                {viewingDevice.model || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="序列号">
                {viewingDevice.serialNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="U位">
                U{viewingDevice.uPosition} (高度: {viewingDevice.uHeight}U)
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">设备面板</Divider>

            {devicePanels.length === 0 ? (
              <Empty description="该设备暂无面板" />
            ) : (
              <Tabs defaultActiveKey="0">
                {devicePanels.map((panel, index) => {
                  const ports = panelPorts.get(panel.id) || [];
                  const hasTemplate = panel.templateId && !panel.isCustomized;

                  return (
                    <TabPane
                      tab={
                        <Space>
                          {panel.name} ({panel.type})
                          {hasTemplate && <Tag color="blue">模板</Tag>}
                          {panel.isCustomized && <Tag color="orange">已自定义</Tag>}
                        </Space>
                      }
                      key={index.toString()}
                    >
                      {hasTemplate && (
                        <Alert
                          message="此面板使用模板"
                          description={
                            <Space>
                              <span>该面板基于模板创建，端口布局由模板定义。</span>
                              <Popconfirm
                                title="确认解绑模板？"
                                description="解绑后可以自定义端口布局，但将失去模板更新。"
                                onConfirm={() => handleUnbindPanel(panel.id)}
                                okText="确认"
                                cancelText="取消"
                              >
                                <Button type="link" size="small">
                                  解绑模板
                                </Button>
                              </Popconfirm>
                            </Space>
                          }
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      {ports.length === 0 ? (
                        <Empty description="该面板暂无端口" />
                      ) : (
                        <PanelVisualizer
                          panel={panel}
                          ports={ports}
                          onPortClick={(port) => {
                            message.info(`端口: ${port.number} - 状态: ${port.status}`);
                          }}
                        />
                      )}
                    </TabPane>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
