import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './CabinetList.css';
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
  SendOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { Cabinet, Room, DataCenter, Device, DeviceType, Panel, Port } from '@/types';
import { cabinetService } from '@/services/cabinetService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { portService } from '@/services/portService';
import { panelTemplateService } from '@/services/panelTemplateService';
import { CabinetVisualizer, ViewMode, CabinetVisualizerHandle } from '@/components/CabinetVisualizer';
import { CabinetThumbnail } from '@/components/CabinetThumbnail';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import { DevicePanelEditor } from '@/components/DevicePanelEditor';
import { generatePortLayout, sortPortsByNumber } from '@/utils/panelLayoutGenerator';
import { ShortIdFormatter } from '@/utils/shortIdFormatter';


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

// 设备类型配置 - 在useTranslation hook中使用后设置
const getDeviceTypeMap = (t: any): Record<DeviceType, { label: string; color: string }> => ({
  SERVER: { label: t('deviceTypes.SERVER'), color: 'blue' },
  SWITCH: { label: t('deviceTypes.SWITCH'), color: 'green' },
  ROUTER: { label: t('deviceTypes.ROUTER'), color: 'orange' },
  FIREWALL: { label: t('deviceTypes.FIREWALL'), color: 'red' },
  STORAGE: { label: t('deviceTypes.STORAGE'), color: 'purple' },
  PDU: { label: t('deviceTypes.PDU'), color: 'cyan' },
  OTHER: { label: t('deviceTypes.OTHER'), color: 'default' },
});

export default function CabinetList() {
  const { t } = useTranslation('cabinet');
  const deviceTypeMap = getDeviceTypeMap(t);
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [panelViewModalVisible, setPanelViewModalVisible] = useState(false);
  const [panelEditorVisible, setPanelEditorVisible] = useState(false);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [editingCabinet, setEditingCabinet] = useState<Cabinet | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [viewingDevice, setViewingDevice] = useState<Device | null>(null);
  const [devicePanels, setDevicePanels] = useState<Panel[]>([]);
  const [panelPorts, setPanelPorts] = useState<Map<string, Port[]>>(new Map());
  const [selectedRoom, setSelectedRoom] = useState<string>();
  const [selectedCabinet, setSelectedCabinet] = useState<Cabinet | null>(null);
  // 从路由 state 中读取初始 activeTab，默认为 'list'
  const [activeTab, setActiveTab] = useState(() => {
    const state = location.state as any;
    return state?.activeTab || 'list';
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('cabinet-view-mode');
    return (saved === '3d' ? '3d' : '2d') as ViewMode;
  });
  const [form] = Form.useForm();
  const [deviceForm] = Form.useForm();
  const [deviceTransferVisible, setDeviceTransferVisible] = useState(false);
  const [deviceCopyVisible, setDeviceCopyVisible] = useState(false);
  const [selectedDeviceForAction, setSelectedDeviceForAction] = useState<Device | null>(null);
  // 从路由 state 中读取需要高亮的机柜 ID
  const [highlightedCabinetId, setHighlightedCabinetId] = useState<string | null>(() => {
    const state = location.state as any;
    return state?.selectedId || null;
  });

  // 主视图引用（用于传递给 CabinetThumbnail 组件）
  const mainViewRef = useRef<CabinetVisualizerHandle>(null);
  // Content 容器引用（用于获取可见区域高度）
  const contentContainerRef = useRef<HTMLDivElement>(null);

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
      message.error(t('messages.loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
    loadCabinets();
  }, []);

  // 处理 URL 参数（扫码跳转）
  useEffect(() => {
    const cabinetId = searchParams.get('cabinetId');
    const roomId = searchParams.get('roomId');
    const tab = searchParams.get('tab');

    if (roomId) {
      // 如果有 roomId，筛选该机房
      setSelectedRoom(roomId);
      loadCabinets(undefined, roomId);
    }

    if (cabinetId && cabinets.length > 0) {
      // 如果有 cabinetId，选中该机柜
      const cabinet = cabinets.find((c) => c.id === cabinetId);
      if (cabinet) {
        setSelectedCabinet(cabinet);
        setHighlightedCabinetId(cabinetId);

        // 如果指定了 tab=visual，自动切换到可视化视图
        if (tab === 'visual') {
          setActiveTab('visual');
        }

        // 3秒后取消高亮
        setTimeout(() => {
          setHighlightedCabinetId(null);
        }, 3000);
      }
    }
  }, [searchParams, cabinets]);

  // 处理从路由 state 传入的 selectedId（搜索跳转）
  useEffect(() => {
    const state = location.state as any;
    if (state?.selectedId && cabinets.length > 0) {
      const cabinet = cabinets.find((c) => c.id === state.selectedId);
      if (cabinet) {
        setSelectedCabinet(cabinet);

        // 3秒后取消高亮
        setTimeout(() => {
          setHighlightedCabinetId(null);
        }, 3000);
      }
    }
  }, [location.state, cabinets]);


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
        message.success(t('messages.updateSuccess'));
      } else {
        await cabinetService.create(values);
        message.success(t('messages.createSuccess'));
      }
      handleCloseModal();
      loadCabinets(undefined, selectedRoom);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingCabinet ? t('messages.updateFailed') : t('messages.createFailed'));
      console.error(error);
    }
  };

  // 删除机柜
  const handleDelete = async (id: string) => {
    try {
      await cabinetService.delete(id);
      message.success(t('messages.deleteSuccess'));
      loadCabinets(undefined, selectedRoom);
    } catch (error) {
      message.error(t('messages.deleteFailed'));
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
      message.error(t('messages.panelLoadFailed'));
    }
  };

  // 解绑面板与模板
  const handleUnbindPanel = async (panelId: string) => {
    try {
      await panelTemplateService.unbindPanel(panelId);
      message.success(t('messages.panelUnbindSuccess'));

      // 重新加载面板信息
      if (viewingDevice) {
        const panels = await panelService.getByDevice(viewingDevice.id);
        setDevicePanels(panels);
      }
    } catch (error: any) {
      message.error(t('messages.panelUnbindFailed') + ': ' + error.message);
      console.error('Error unbinding panel:', error);
    }
  };

  // 保存设备
  const handleSaveDevice = async () => {
    try {
      const values = await deviceForm.validateFields();
      // console.log('Saving device with values:', values);
      if (editingDevice) {
        await deviceService.update(editingDevice.id, values);
        message.success(t('messages.deviceUpdated'));
      } else {
        await deviceService.create(values);
        message.success(t('messages.deviceCreated'));
      }
      setDeviceModalVisible(false);
      deviceForm.resetFields();
      await loadAllData();
      await loadCabinets();
    } catch (error: any) {
      if (error.errorFields) return;
      // console.error('Save device error:', error);
      // console.error('Error details:', JSON.stringify(error.data?.details, null, 2));
      message.error(editingDevice ? t('messages.updateFailed') : t('messages.createFailed'));
      console.error(error);
    }
  };

  // 删除设备
  const handleDeleteDevice = async (device: Device) => {
    Modal.confirm({
      title: t('messages.deviceDeleteConfirm'),
      content: `${t('labels.deviceName')} ${device.name} (${device.model || t('placeholders.height')})`,
      okText: t('buttons.confirm'),
      okType: 'danger',
      cancelText: t('buttons.cancel'),
      onOk: async () => {
        try {
          await deviceService.delete(device.id);
          message.success(t('messages.deviceDeleted'));
          await loadAllData();
          await loadCabinets();
        } catch (error) {
          message.error(t('messages.deleteFailed'));
          console.error(error);
        }
      },
    });
  };

  // 打开设备面板编辑器
  const handleOpenPanelEditor = (panel?: Panel, device?: Device) => {
    setEditingPanel(panel || null);
    // 如果传入了设备，设置当前查看的设备
    if (device) {
      setViewingDevice(device);
    }
    setPanelEditorVisible(true);
  };

  // 保存面板
  const handleSavePanel = async (panelData: Partial<Panel>) => {
    try {
      if (editingPanel) {
        await panelService.update(editingPanel.id, panelData);
      } else {
        await panelService.create(panelData);
      }

      // 重新加载设备面板信息
      if (viewingDevice) {
        const panels = await panelService.getByDevice(viewingDevice.id);
        setDevicePanels(panels);
      }

      await loadAllData();
    } catch (error) {
      console.error('Failed to save panel:', error);
      throw error;
    }
  };

  // 打开设备发送对话框
  const handleOpenDeviceTransfer = (device: Device) => {
    setSelectedDeviceForAction(device);
    setDeviceTransferVisible(true);
  };

  // 打开设备复制对话框
  const handleOpenDeviceCopy = (device: Device) => {
    setSelectedDeviceForAction(device);
    setDeviceCopyVisible(true);
  };

  // 设备发送功能
  const handleDeviceTransfer = async (targetCabinetId: string, targetUPosition: number) => {
    if (!selectedDeviceForAction) return;

    try {
      // 检查目标位置是否可用
      const targetCabinetDevices = devices.filter(
        (device) => device.cabinetId === targetCabinetId
      );
      const isPositionAvailable = !targetCabinetDevices.some(
        (device) =>
          device.uPosition && device.uHeight &&
          targetUPosition >= device.uPosition &&
          targetUPosition < device.uPosition + device.uHeight
      );

      if (!isPositionAvailable) {
        message.error(t('messages.positionOccupied', { uPosition: targetUPosition }));
        return;
      }

      // 更新设备位置
      await deviceService.update(selectedDeviceForAction.id, {
        cabinetId: targetCabinetId,
        uPosition: targetUPosition,
      });

      message.success(t('messages.deviceTransferSuccess'));
      setDeviceTransferVisible(false);
      setSelectedDeviceForAction(null);

      await loadAllData();
      await loadCabinets();
    } catch (error) {
      message.error(t('messages.deviceTransferFailed'));
      console.error('Failed to transfer device:', error);
    }
  };

  // 设备复制功能
  const handleDeviceCopy = async (targetCabinetId: string, targetUPosition: number) => {
    if (!selectedDeviceForAction) return;

    try {
      // 检查目标位置是否可用
      const targetCabinetDevices = devices.filter(
        (device) => device.cabinetId === targetCabinetId
      );
      const isPositionAvailable = !targetCabinetDevices.some(
        (device) =>
          device.uPosition && device.uHeight &&
          targetUPosition >= device.uPosition &&
          targetUPosition < device.uPosition + device.uHeight
      );

      if (!isPositionAvailable) {
        message.error(t('messages.positionOccupied', { uPosition: targetUPosition }));
        return;
      }

      // 创建设备副本
      const deviceCopy = {
        name: `${selectedDeviceForAction.name}_${t('buttons.deviceCopy')}`,
        type: selectedDeviceForAction.type,
        model: selectedDeviceForAction.model,
        cabinetId: targetCabinetId,
        uPosition: targetUPosition,
        uHeight: selectedDeviceForAction.uHeight || 1,
      };

      await deviceService.create(deviceCopy);
      message.success(t('messages.deviceCopySuccess'));
      setDeviceCopyVisible(false);
      setSelectedDeviceForAction(null);

      await loadAllData();
      await loadCabinets();
    } catch (error) {
      message.error(t('messages.deviceCopyFailed'));
      console.error('Failed to copy device:', error);
    }
  };

  const columns = [
    {
      title: t('fields.shortId'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
    },
    {
      title: t('fields.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('fields.position'),
      dataIndex: 'position',
      key: 'position',
      render: (text: string) => text || '-',
    },
    {
      title: t('fields.height'),
      dataIndex: 'height',
      key: 'height',
      render: (height: number) => `${height}U`,
    },
    {
      title: t('fields.room'),
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
      title: t('fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: t('fields.actions'),
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
            {t('buttons.visualize')}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            {t('buttons.edit')}
          </Button>
          <Popconfirm
            title={t('messages.deleteConfirm')}
            description={t('messages.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              {t('buttons.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 192px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Title level={2} style={{ margin: 0 }}>
            <InboxOutlined /> {t('title')}
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {t('description')}
          </Text>
        </div>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        className="full-height-tabs"
      >
        <TabPane tab={<span><InboxOutlined /> {t('tabs.cabinetList')}</span>} key="list">
          <Card>
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                  {t('buttons.create')}
                </Button>
                <Select
                  placeholder={t('buttons.selectRoom')}
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
                placeholder={t('placeholders.search')}
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
              onRow={(record) => ({
                onClick: () => handleViewCabinet(record),
                style: { cursor: 'pointer' },
              })}
              rowClassName={(record) =>
                highlightedCabinetId === record.id ? 'highlighted-row' : ''
              }
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => t('table.total', { total }),
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><EyeOutlined /> {t('tabs.visualization')}</span>} key="visual">
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, marginBottom: 12, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Button.Group size="small">
                <Tooltip title={t('views.2dFrontPanel')}>
                  <Button
                    type={viewMode === '2d' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => handleViewModeChange('2d')}
                  >
                    2D
                  </Button>
                </Tooltip>
                <Tooltip title={t('views.3dView')}>
                  <Button
                    type={viewMode === '3d' ? 'primary' : 'default'}
                    icon={<BlockOutlined />}
                    onClick={() => handleViewModeChange('3d')}
                  >
                    3D
                  </Button>
                </Tooltip>
              </Button.Group>
            </div>

            <Layout style={{ background: '#fff', flex: 1, overflow: 'hidden' }}>
            {/* 左侧：机柜导航器 */}
            <Sider
              width={260}
              style={{
                background: '#fafafa',
                borderRight: '1px solid #e8e8e8',
                overflowY: 'auto',
                height: '100%',
              }}
            >
              <div style={{ padding: 16 }}>
                {/* 机柜选择器 */}
                <div style={{ marginBottom: 16 }} title="机柜选择器容器">
                  <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>
                    {t('views.selectCabinet')}
                  </Text>
                  <Select
                    showSearch
                    style={{ width: '100%' }}
                    placeholder={t('labels.selectCabinetPlaceholder')}
                    value={selectedCabinet?.id}
                    onChange={(cabinetId) => {
                      const cabinet = cabinets.find(c => c.id === cabinetId);
                      if (cabinet) handleSelectCabinet(cabinet);
                    }}
                    optionFilterProp="children"
                    filterOption={(input, option) =>
                      (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                    options={cabinets.map(cabinet => {
                      const room = rooms.find(r => r.id === cabinet.roomId);
                      const dc = dataCenters.find(d => d.id === room?.dataCenterId);
                      return {
                        value: cabinet.id,
                        label: `${dc?.name || ''} - ${room?.name || ''} - ${cabinet.name}`,
                      };
                    })}
                  />
                </div>

                {selectedCabinet ? (
                  <>
                    {/* 机柜统计信息 */}
                    <div style={{ marginBottom: 16 }}>
                      {(() => {
                        const stats = getCabinetStats(selectedCabinet);
                        return (
                          <>
                            {/* 机柜名称和基本信息 */}
                            <div style={{
                              padding: '8px 12px',
                              background: '#fafafa',
                              borderRadius: 4,
                              marginBottom: 8
                            }}>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, color: '#262626' }}>
                                {selectedCabinet.name}
                              </div>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                                  {selectedCabinet.height}U
                                </Tag>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                  {stats.totalDevices}台设备
                                </Text>
                                <Text style={{ fontSize: 11 }}>
                                  {stats.usedUnits}/{selectedCabinet.height}U
                                </Text>
                                <Tag
                                  color={
                                    stats.utilization > 80
                                      ? 'red'
                                      : stats.utilization > 60
                                      ? 'orange'
                                      : 'green'
                                  }
                                  style={{ margin: 0, fontSize: 11 }}
                                >
                                  {stats.utilization}%
                                </Tag>
                              </div>
                            </div>

                            {/* 操作按钮 */}
                            <Space direction="vertical" style={{ width: '100%' }} size={4}>
                              <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => handleOpenDeviceModal()}
                                block
                                size="small"
                              >
                                {t('buttons.addDevice')}
                              </Button>
                              <Button
                                icon={<EditOutlined />}
                                onClick={() => handleOpenModal(selectedCabinet)}
                                block
                                size="small"
                              >
                                {t('buttons.editCabinet')}
                              </Button>
                            </Space>
                          </>
                        );
                      })()}
                    </div>

                    {/* 设备列表 */}
                    <Card
                      title={t('panels.devicePanels')}
                      size="small"
                      bodyStyle={{ padding: '8px 0' }}
                    >
                      <List
                        dataSource={getCabinetDevices(selectedCabinet.id)}
                        size="small"
                        split={false}
                        renderItem={(device) => (
                          <List.Item
                            style={{
                              padding: '8px 12px',
                              borderBottom: '1px solid #f0f0f0',
                              display: 'block',
                            }}
                          >
                            <div style={{ marginBottom: 6 }}>
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 4,
                              }}>
                                <Text
                                  strong
                                  style={{
                                    fontSize: 12,
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={device.name}
                                >
                                  {device.name}
                                </Text>
                                <Tag
                                  color={deviceTypeMap[device.type].color}
                                  style={{
                                    fontSize: 10,
                                    margin: 0,
                                    padding: '0 4px',
                                    lineHeight: '16px',
                                  }}
                                >
                                  {deviceTypeMap[device.type].label}
                                </Tag>
                              </div>
                              <Text type="secondary" style={{ fontSize: 10 }}>
                                U{device.uPosition} ({device.uHeight}U)
                              </Text>
                            </div>
                            <Space size={4} wrap>
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleOpenDeviceModal(device)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<SettingOutlined />}
                                onClick={() => handleOpenPanelEditor(undefined, device)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<SendOutlined />}
                                onClick={() => handleOpenDeviceTransfer(device)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                              <Button
                                type="text"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => handleOpenDeviceCopy(device)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleDeleteDevice(device)}
                                style={{ padding: '0 4px', height: 20 }}
                              />
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  </>
                ) : (
                  <Empty description={t('messages.selectCabinet')} />
                )}
              </div>
            </Sider>

            {/* 中间：机柜可视化 */}
            <Content
              ref={contentContainerRef}
              style={{
                padding: 24,
                height: '100%',
                overflow: 'hidden', // 【修改点】从 overflowY: 'auto' 改为 overflow: 'hidden'，禁止主视图滚动
              }}
              title="机柜可视化主视图区域"
            >
              {selectedCabinet ? (
                <CabinetVisualizer
                  ref={mainViewRef}
                  cabinet={selectedCabinet}
                  devices={getCabinetDevices(selectedCabinet.id)}
                  viewMode={viewMode}
                  onDeviceClick={handleViewDevicePanels}
                  onDeviceEdit={handleOpenDeviceModal}
                  onDeviceDelete={handleDeleteDevice}
                />
              ) : (
                <Empty description="请从左侧选择一个机柜进行可视化展示" style={{ marginTop: 100 }} />
              )}
            </Content>

            {/* 右侧：机柜全览 */}
            <Sider
              width={260}
              style={{
                background: '#fafafa',
                borderLeft: '1px solid #e8e8e8',
                overflow: 'hidden',
                height: '100%',
              }}
            >
              <div style={{ padding: 16 }}>
                {selectedCabinet ? (
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: '#8c8c8c',
                        marginBottom: 8,
                        paddingLeft: 4,
                      }}
                      title="机柜全览标题"
                    >
                      <InboxOutlined style={{ marginRight: 4 }} />
                      {t('labels.cabinetOverview')}
                    </div>
                    <CabinetThumbnail
                      cabinet={selectedCabinet}
                      devices={getCabinetDevices(selectedCabinet.id)}
                      viewMode={viewMode}
                      containerHeight={600}
                      mainViewRef={mainViewRef}
                      contentContainerRef={contentContainerRef}
                    />
                  </div>
                ) : (
                  <Empty description={t('messages.selectCabinet')} />
                )}
              </div>
            </Sider>
          </Layout>
          </div>
        </TabPane>
      </Tabs>

      <Modal
        title={editingCabinet ? t('editTitle') : t('createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('labels.cabinetName')}
            rules={[{ required: true, message: t('validation.nameRequired') }]}
          >
            <Input placeholder={t('placeholders.name')} />
          </Form.Item>
          <Form.Item name="position" label={t('labels.position')}>
            <Input placeholder={t('placeholders.position')} />
          </Form.Item>
          <Form.Item
            name="height"
            label={t('labels.uHeight')}
            initialValue={42}
            rules={[{ required: true, message: t('validation.heightRequired') }]}
          >
            <InputNumber min={1} max={52} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="roomId"
            label={t('labels.selectRoom')}
            rules={[{ required: true, message: t('validation.roomRequired') }]}
          >
            <Select placeholder={t('labels.selectRoom')} showSearch optionFilterProp="children">
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
        title={editingDevice ? t('buttons.editDevice') : t('buttons.addDevice')}
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
            label={t('labels.deviceName')}
            rules={[{ required: true, message: t('validation.deviceNameRequired') }]}
          >
            <Input placeholder="e.g.: WEB-Server-01" />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('labels.deviceType')}
            rules={[{ required: true, message: t('validation.deviceTypeRequired') }]}
          >
            <Select placeholder={t('labels.deviceType')}>
              <Option value="SERVER">{t('deviceTypes.SERVER')}</Option>
              <Option value="SWITCH">{t('deviceTypes.SWITCH')}</Option>
              <Option value="ROUTER">{t('deviceTypes.ROUTER')}</Option>
              <Option value="FIREWALL">{t('deviceTypes.FIREWALL')}</Option>
              <Option value="STORAGE">{t('deviceTypes.STORAGE')}</Option>
              <Option value="PDU">{t('deviceTypes.PDU')}</Option>
              <Option value="OTHER">{t('deviceTypes.OTHER')}</Option>
            </Select>
          </Form.Item>
          <Form.Item name="model" label={t('labels.deviceModel')}>
            <Input placeholder="e.g.: Dell PowerEdge R740" />
          </Form.Item>
          <Form.Item name="serialNo" label={t('labels.serialNo')}>
            <Input placeholder="e.g.: SN123456789" />
          </Form.Item>
          <Form.Item
            name="cabinetId"
            label={t('labels.selectCabinet')}
            rules={[{ required: true, message: t('validation.deviceCabinetRequired') }]}
          >
            <Select placeholder={t('labels.selectCabinet')} showSearch optionFilterProp="children">
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
            <Form.Item name="uPosition" label={t('labels.uPosition')} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={52} placeholder="1" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="uHeight" label={t('labels.uHeight')} initialValue={1} style={{ marginBottom: 0 }}>
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
            {viewingDevice?.name} - {t('panels.title')}
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
            {t('buttons.editDeviceButton')}
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
            {t('buttons.cancel')}
          </Button>,
        ]}
        width={900}
        style={{ top: 20 }}
      >
        {viewingDevice && (
          <div>
            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label={t('descriptions.deviceType')}>
                <Tag color={deviceTypeMap[viewingDevice.type]?.color}>
                  {deviceTypeMap[viewingDevice.type]?.label || viewingDevice.type}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('descriptions.model')}>
                {viewingDevice.model || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('descriptions.serialNo')}>
                {viewingDevice.serialNo || '-'}
              </Descriptions.Item>
              <Descriptions.Item label={t('descriptions.uPosition')}>
                U{viewingDevice.uPosition} (Height: {viewingDevice.uHeight}U)
              </Descriptions.Item>
            </Descriptions>

            <Divider orientation="left">{t('panels.title')}</Divider>

            {devicePanels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Empty description={t('panels.noPanels')} />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenPanelEditor()}
                  style={{ marginTop: 16 }}
                >
                  {t('buttons.addPanel')}
                </Button>
              </div>
            ) : (
              <Tabs defaultActiveKey="0">
                {devicePanels.map((panel, index) => {
                  const ports = panelPorts.get(panel.id) || [];
                  const hasTemplate = panel.templateId && !panel.isCustomized;

                  return (
                    <TabPane
                      tab={
                        <Space>
                          {panel.name}
                          {panel.shortId && (
                            <Text code>{ShortIdFormatter.toDisplayFormat(panel.shortId)}</Text>
                          )}
                          {hasTemplate && <Tag color="blue">模板</Tag>}
                          {panel.isCustomized && <Tag color="orange">已自定义</Tag>}
                        </Space>
                      }
                      key={index.toString()}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <Space>
                          <Button
                            icon={<EditOutlined />}
                            onClick={() => handleOpenPanelEditor(panel)}
                          >
                            {t('buttons.editPanel')}
                          </Button>
                          {hasTemplate && (
                            <Popconfirm
                              title={t('panels.unbindConfirmTitle')}
                              description={t('panels.unbindConfirmDesc')}
                              onConfirm={() => handleUnbindPanel(panel.id)}
                              okText={t('buttons.confirm')}
                              cancelText={t('buttons.cancel')}
                            >
                              <Button type="link" size="small">
                                {t('buttons.unbindTemplate')}
                              </Button>
                            </Popconfirm>
                          )}
                        </Space>
                      </div>

                      {hasTemplate && (
                        <Alert
                          message={t('panels.templateAlert')}
                          description={t('panels.templateAlertDesc')}
                          type="info"
                          showIcon
                          style={{ marginBottom: 16 }}
                        />
                      )}

                      <PanelVisualizer
                        panel={panel}
                        ports={ports}
                        onPortClick={(port) => {
                          message.info(`${t('panels.portNumber')}: ${port.number} - ${t('panels.portStatus')}: ${port.status}`);
                        }}
                        onPortPositionChange={async (portId, x, y) => {
                          try {
                            // 后端使用 positionX 和 positionY 字段，而不是 position 对象
                            await portService.update(portId, {
                              position: { x, y },
                            } as any);
                            // 重新加载端口数据
                            const updatedPorts = await portService.getByPanel(panel.id);
                            setPanelPorts((prev) => {
                              const newMap = new Map(prev);
                              newMap.set(panel.id, updatedPorts);
                              return newMap;
                            });
                            message.success(t('messages.portPositionUpdated'));
                          } catch (error) {
                            console.error('Failed to update port position:', error);
                            message.error(t('messages.portPositionUpdateFailed'));
                          }
                        }}
                        onPortsUpdated={async () => {
                          try {
                            // 重新加载端口数据
                            const updatedPorts = await portService.getByPanel(panel.id);
                            setPanelPorts((prev) => {
                              const newMap = new Map(prev);
                              newMap.set(panel.id, updatedPorts);
                              return newMap;
                            });
                          } catch (error) {
                            console.error('Failed to reload ports:', error);
                          }
                        }}
                        allowEdit={true}
                      />
                    </TabPane>
                  );
                })}
              </Tabs>
            )}
          </div>
        )}
      </Modal>

      {/* 设备面板编辑器 */}
      {viewingDevice && (
        <DevicePanelEditor
          visible={panelEditorVisible}
          onCancel={() => {
            setPanelEditorVisible(false);
            setEditingPanel(null);
          }}
          onSave={handleSavePanel}
          device={viewingDevice}
          panel={editingPanel || undefined}
        />
      )}

      {/* 设备发送对话框 */}
      <Modal
        title={t('transfer.title')}
        open={deviceTransferVisible}
        onCancel={() => {
          setDeviceTransferVisible(false);
          setSelectedDeviceForAction(null);
        }}
        footer={null}
        width={600}
      >
        {selectedDeviceForAction && (
          <Form layout="vertical" onFinish={(values) => {
            handleDeviceTransfer(values.cabinetId, values.uPosition);
          }}>
            <Alert
              message={t('transfer.title')}
              description={t('transfer.description', { deviceName: selectedDeviceForAction.name })}
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              name="cabinetId"
              label={t('labels.targetCabinet')}
              rules={[{ required: true, message: t('validation.cabinetRequired') }]}
            >
              <Select placeholder={t('labels.targetCabinet')} showSearch optionFilterProp="children">
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

            <Form.Item
              name="uPosition"
              label={t('labels.targetUPosition')}
              rules={[{ required: true, message: t('validation.uPositionRequired') }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder={t('labels.targetUPosition')}
                min={1}
                max={52}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {t('buttons.confirmTransfer')}
                </Button>
                <Button onClick={() => {
                  setDeviceTransferVisible(false);
                  setSelectedDeviceForAction(null);
                }}>
                  {t('buttons.cancel')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* 设备复制对话框 */}
      <Modal
        title={t('copy.title')}
        open={deviceCopyVisible}
        onCancel={() => {
          setDeviceCopyVisible(false);
          setSelectedDeviceForAction(null);
        }}
        footer={null}
        width={600}
      >
        {selectedDeviceForAction && (
          <Form layout="vertical" onFinish={(values) => {
            handleDeviceCopy(values.cabinetId, values.uPosition);
          }}>
            <Alert
              message={t('copy.title')}
              description={t('copy.description', { deviceName: selectedDeviceForAction.name })}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Form.Item
              name="cabinetId"
              label={t('labels.targetCabinet')}
              rules={[{ required: true, message: t('validation.cabinetRequired') }]}
            >
              <Select placeholder={t('labels.targetCabinet')} showSearch optionFilterProp="children">
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

            <Form.Item
              name="uPosition"
              label={t('labels.targetUPosition')}
              rules={[{ required: true, message: t('validation.uPositionRequired') }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                placeholder={t('labels.targetUPosition')}
                min={1}
                max={52}
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button type="primary" htmlType="submit">
                  {t('buttons.confirmCopy')}
                </Button>
                <Button onClick={() => {
                  setDeviceCopyVisible(false);
                  setSelectedDeviceForAction(null);
                }}>
                  {t('buttons.cancel')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
}
