import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Typography,
  Card,
  Space,
  Button,
  Select,
  message,
  Spin,
  Tag,
  Tooltip,
  Divider,
  Modal,
  Descriptions,
  Input,
} from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  FullscreenOutlined,
  ReloadOutlined,
  DownloadOutlined,
  PlusOutlined,
  ScanOutlined,
  InfoCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { cableService } from '@/services/cableService';
import { panelService } from '@/services/panelService';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/cabinetService';
import { portService } from '@/services/portService';
import { roomService } from '@/services/roomService';
import type { Panel as PanelType, Device, Cabinet, Port, Room } from '@/types';
import CreateCableModal from '@/components/CreateCableModal';
import PanelCanvasEditor, { PortDefinition } from '@/components/PanelCanvasEditor';
import { getPortSize } from '@/constants/portSizes';

const { Title, Text } = Typography;
const { Option } = Select;

// 扩展的端口类型，支持连接状态
function getEnhancedPortColor(portType: string, isConnected: boolean): string {
  const basePortType = portType.replace('_CONNECTED', '') as any;
  try {
    const portSize = getPortSize(basePortType);
    if (isConnected) {
      // 已连接：使用更深的颜色
      return portSize.color ? `${portSize.color}dd` : '#1890ffdd';
    } else {
      // 未连接：使用更浅的颜色（降低透明度）
      return portSize.color ? `${portSize.color}40` : '#1890ff40';
    }
  } catch {
    // 如果端口类型不存在，返回默认颜色
    return isConnected ? '#1890ffdd' : '#1890ff40';
  }
}

// 节点类型颜色映射
const nodeTypeColors: Record<string, string> = {
  SERVER: '#1890ff',
  SWITCH: '#52c41a',
  ROUTER: '#faad14',
  FIREWALL: '#f5222d',
  STORAGE: '#722ed1',
  PDU: '#fa8c16',
  OTHER: '#8c8c8c',
};

// 线缆类型颜色映射
const cableTypeColors: Record<string, string> = {
  CAT5E: '#2db7f5',
  CAT6: '#108ee9',
  CAT6A: '#0050b3',
  CAT7: '#003a8c',
  FIBER_SM: '#f50',
  FIBER_MM: '#fa541c',
  QSFP_TO_SFP: '#722ed1',
  QSFP_TO_QSFP: '#531dab',
  SFP_TO_SFP: '#9254de',
  POWER: '#faad14',
  OTHER: '#8c8c8c',
};

// 获取设备位置信息的辅助函数
const getDeviceLocation = (device: Device, cabinets: Cabinet[], rooms: Room[]) => {
  if (!device?.cabinetId) return null;
  const cabinet = cabinets.find(c => c.id === device.cabinetId);
  if (!cabinet) return null;

  // 查找机房信息
  const room = rooms.find(r => r.id === cabinet.roomId);
  const roomName = room?.name || '未知机房';

  const uPosition = device.uPosition ? `U${device.uPosition}` : '';
  const uHeight = device.uHeight ? `(${device.uHeight}U)` : '';

  return {
    roomName,
    cabinetName: cabinet.name,
    position: uPosition ? `${uPosition}${uHeight}` : null,
    fullLocation: `${roomName} - ${cabinet.name}${uPosition ? ` - ${uPosition}${uHeight}` : ''}`
  };
};

// 自定义节点组件
function DeviceNode({ data }: { data: any }) {
  const { device, panel, ports, cabinets, rooms, onPortHover, highlightedNodeIds } = data;
  const deviceColor = nodeTypeColors[device?.type || 'OTHER'] || '#8c8c8c';
  const location = getDeviceLocation(device, cabinets, rooms || []);
  const isHighlighted = highlightedNodeIds?.includes(panel?.id);

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${isHighlighted ? '#1890ff' : deviceColor}`,
        background: isHighlighted ? '#e6f7ff' : '#fff',
        minWidth: '240px',
        boxShadow: isHighlighted
          ? '0 4px 16px rgba(24,144,255,0.3)'
          : '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
      }}
    >
      {/* 添加连接句柄 */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div style={{ marginBottom: '8px' }}>
        <Tag color={isHighlighted ? '#1890ff' : deviceColor} style={{ marginBottom: '4px' }}>
          {device?.type || 'UNKNOWN'}
        </Tag>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {device?.name || '未命名设备'}
        </div>
      </div>

      {/* 位置信息 */}
      {location && (
        <div style={{ fontSize: '11px', color: '#722ed1', marginBottom: '4px' }}>
          <div>{location.fullLocation}</div>
        </div>
      )}

      {panel && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>面板: {panel.name}</div>
          <div>端口: {ports?.length || 0} 个</div>

          {/* 端口列表 */}
          {ports && ports.length > 0 && (
            <div style={{
              marginTop: '8px',
              maxHeight: '120px',
              overflowY: 'auto',
              border: '1px solid #f0f0f0',
              borderRadius: '4px',
              padding: '4px',
              backgroundColor: '#fafafa'
            }}>
              {ports.map((port: any) => (
                <div
                  key={port.id}
                  style={{
                    padding: '2px 6px',
                    margin: '1px 0',
                    fontSize: '10px',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    backgroundColor: '#fff',
                    border: '1px solid #e8e8e8',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={() => onPortHover?.(port.id)}
                  onMouseLeave={() => onPortHover?.(null)}
                >
                  {port.label || port.number}
                  {port.portType && (
                    <span style={{ color: '#999', marginLeft: '4px' }}>
                      ({port.portType})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// 节点类型注册
const nodeTypes = {
  device: DeviceNode,
};

// 拓扑图主组件
function CableTopologyContent() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);
  const [panels, setPanels] = useState<PanelType[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [filteredPanels, setFilteredPanels] = useState<PanelType[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [depth, setDepth] = useState(3);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createCableModalVisible, setCreateCableModalVisible] = useState(false);
  const [portModalVisible, setPortModalVisible] = useState(false);
  const [selectedDeviceForPorts, setSelectedDeviceForPorts] = useState<any>(null);
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([]);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState('');
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // 根据高亮状态动态生成边和节点样式
  const styledEdges = edges.map(edge => ({
    ...edge,
    style: {
      ...edge.style,
      strokeWidth: highlightedEdgeIds.includes(edge.id) ? 4 : 2,
      opacity: highlightedEdgeIds.length > 0 && !highlightedEdgeIds.includes(edge.id) ? 0.3 : 1,
    },
    animated: highlightedEdgeIds.includes(edge.id) ? true : edge.animated,
  }));

  const styledNodes = nodes.map(node => ({
    ...node,
    style: {
      ...node.style,
      opacity: highlightedNodeIds.length > 0 && !highlightedNodeIds.includes(node.id) ? 0.3 : 1,
    },
  }));

  // 加载所有面板、设备、机柜和机房
  useEffect(() => {
    loadPanelsAndDevices();
    loadCabinets();
    loadRooms();
  }, []);

  // 当选择设备时，筛选该设备下的面板
  useEffect(() => {
    if (selectedDeviceId) {
      const filtered = panels.filter(p => p.deviceId === selectedDeviceId);
      setFilteredPanels(filtered);
      // 清空面板选择
      setSelectedPanelId('');
    } else {
      setFilteredPanels([]);
      setSelectedPanelId('');
    }
  }, [selectedDeviceId, panels]);

  const loadPanelsAndDevices = async () => {
    try {
      // 加载所有面板（包含设备信息）
      const panelsData = await panelService.getAll();
      setPanels(panelsData);

      // 提取唯一的设备列表
      const deviceMap = new Map<string, Device>();
      panelsData.forEach(panel => {
        if (panel.device && !deviceMap.has(panel.device.id)) {
          deviceMap.set(panel.device.id, panel.device);
        }
      });
      const uniqueDevices = Array.from(deviceMap.values());
      setDevices(uniqueDevices);

      console.log('Loaded panels:', panelsData.length);
      console.log('Loaded devices:', uniqueDevices.length);
    } catch (error) {
      console.error('Failed to load panels and devices:', error);
      message.error('加载面板和设备列表失败');
    }
  };

  const loadCabinets = async () => {
    try {
      const cabinetsData = await cabinetService.getAll();
      setCabinets(cabinetsData);
      console.log('Loaded cabinets:', cabinetsData.length);
    } catch (error) {
      console.error('Failed to load cabinets:', error);
      message.error('加载机柜列表失败');
    }
  };

  const loadRooms = async () => {
    try {
      const roomsData = await roomService.getAll();
      setRooms(roomsData);
      console.log('Loaded rooms:', roomsData.length);
    } catch (error) {
      console.error('Failed to load rooms:', error);
      message.error('加载机房列表失败');
    }
  };

  // 加载拓扑数据
  const loadTopology = async (panelId: string, _maxDepth: number) => {
    if (!panelId) {
      message.warning('请选择一个面板');
      return;
    }

    setLoading(true);
    try {
      // 获取面板连接数据
      const connections = await cableService.getPanelConnections(panelId);

      console.log('Loaded connections:', connections);
      console.log('Number of connections:', connections?.length || 0);

      // 构建节点和边
      await buildGraphFromConnections(connections, panelId);

      message.success(`拓扑图加载成功，找到 ${connections?.length || 0} 个连接`);
      setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
    } catch (error) {
      console.error('Failed to load topology:', error);
      message.error('加载拓扑图失败');
    } finally {
      setLoading(false);
    }
  };

  // 从连接数据构建图结构
  const buildGraphFromConnections = async (
    connections: any[],
    rootPanelId: string
  ) => {
    console.log('Building graph from connections:', connections);

    if (!connections || connections.length === 0) {
      console.warn('No connections found');
      setNodes([]);
      setEdges([]);
      return;
    }

    const nodeMap = new Map<string, any>();
    const edgeList: Edge[] = [];
    const deviceCache = new Map<string, Device>();
    const panelCache = new Map<string, PanelType>();

    // 预加载根面板
    try {
      const rootPanel = await panelService.getById(rootPanelId);
      panelCache.set(rootPanelId, rootPanel);
      if (rootPanel.deviceId) {
        const device = await deviceService.getById(rootPanel.deviceId);
        deviceCache.set(rootPanel.deviceId, device);
      }
    } catch (error) {
      console.error('Failed to load root panel:', error);
    }

    // 处理每个连接
    for (const conn of connections) {
      const { cable, portA, portB } = conn;

      console.log('Processing connection:', { cable, portA, portB });
      console.log('portA structure:', portA);
      console.log('portB structure:', portB);

      // Neo4j返回的端口对象只有properties，需要提取panelId
      const panelIdA = portA?.panelId;
      const panelIdB = portB?.panelId;

      console.log('Panel IDs:', { panelIdA, panelIdB });

      if (!panelIdA) {
        console.error('Missing panelIdA! portA:', portA);
      }
      if (!panelIdB) {
        console.error('Missing panelIdB! portB:', portB);
      }

      // 获取端口A的面板和设备信息
      if (panelIdA && !panelCache.has(panelIdA)) {
        try {
          const panel = await panelService.getById(portA.panelId);
          panelCache.set(portA.panelId, panel);
          if (panel.deviceId && !deviceCache.has(panel.deviceId)) {
            const device = await deviceService.getById(panel.deviceId);
            deviceCache.set(panel.deviceId, device);
          }
        } catch (error) {
          console.error('Failed to load panel A:', error);
        }
      }

      // 获取端口B的面板和设备信息
      if (portB?.panelId && !panelCache.has(portB.panelId)) {
        try {
          const panel = await panelService.getById(portB.panelId);
          panelCache.set(portB.panelId, panel);
          if (panel.deviceId && !deviceCache.has(panel.deviceId)) {
            const device = await deviceService.getById(panel.deviceId);
            deviceCache.set(panel.deviceId, device);
          }
        } catch (error) {
          console.error('Failed to load panel B:', error);
        }
      }

      // 创建节点A
      const panelA = panelCache.get(portA?.panelId);
      const deviceA = panelA?.deviceId ? deviceCache.get(panelA.deviceId) : null;
      if (portA?.panelId && !nodeMap.has(portA.panelId)) {
        nodeMap.set(portA.panelId, {
          id: portA.panelId,
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            panel: panelA,
            device: deviceA,
            ports: [portA],
            cabinets: cabinets,
            rooms: rooms,
            onPortHover: handlePortHover,
            highlightedNodeIds: highlightedNodeIds,
          },
        });
      } else if (portA?.panelId) {
        const existingNode = nodeMap.get(portA.panelId);
        existingNode.data.ports.push(portA);
      }

      // 创建节点B
      const panelB = panelCache.get(portB?.panelId);
      const deviceB = panelB?.deviceId ? deviceCache.get(panelB.deviceId) : null;
      if (portB?.panelId && !nodeMap.has(portB.panelId)) {
        nodeMap.set(portB.panelId, {
          id: portB.panelId,
          type: 'device',
          position: { x: 0, y: 0 },
          data: {
            panel: panelB,
            device: deviceB,
            ports: [portB],
            cabinets: cabinets,
            rooms: rooms,
            onPortHover: handlePortHover,
            highlightedNodeIds: highlightedNodeIds,
          },
        });
      } else if (portB?.panelId) {
        const existingNode = nodeMap.get(portB.panelId);
        existingNode.data.ports.push(portB);
      }

      // 创建边
      if (portA?.panelId && portB?.panelId) {
        const edge = {
          id: cable.id || `edge-${portA.id}-${portB.id}`,
          source: portA.panelId,
          target: portB.panelId,
          type: 'default',
          animated: true,
          style: {
            stroke: cableTypeColors[cable.type] || '#8c8c8c',
            strokeWidth: 2,
          },
          label: cable.label || `${cable.type}`,
          data: { cable, portA, portB },
        };
        console.log('Created edge:', edge);
        edgeList.push(edge);
      } else {
        console.warn('Cannot create edge, missing panel IDs:', { portA, portB });
      }
    }

    // 应用力导向布局
    const nodeList = Array.from(nodeMap.values());
    applyForceLayout(nodeList);

    console.log('Final nodes:', nodeList.length);
    console.log('Final edges:', edgeList.length);
    console.log('Edges:', edgeList);

    setNodes(nodeList);
    setEdges(edgeList);
  };

  // 简单的力导向布局
  const applyForceLayout = (nodes: Node[]) => {
    const centerX = 400;
    const centerY = 300;
    const radius = 250;

    nodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / nodes.length;
      node.position = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  };

  // 处理节点点击
  const onNodeClick = useCallback((event: any, node: Node) => {
    // 清除之前的计时器
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }

    // 设置新的计时器
    const timer = setTimeout(() => {
      setSelectedNode(node);
      setDetailModalVisible(true);
      setClickTimer(null);
    }, 200);

    setClickTimer(timer);
  }, [clickTimer]);

  // 处理节点双击 - 显示接口可视化
  const onNodeDoubleClick = useCallback((_event: any, node: Node) => {
    // 清除单击计时器
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }

    setSelectedDeviceForPorts(node);
    setPortModalVisible(true);
  }, [clickTimer]);

  // 处理端口悬浮 - 高亮连接的线和对端面板
  const handlePortHover = useCallback((portId: string | null) => {
    setHoveredPortId(portId);

    if (portId) {
      // 找到所有与这个端口连接的边
      const connectedEdgeIds = edges
        .filter(edge => {
          const { portA, portB } = edge.data || {};
          return portA?.id === portId || portB?.id === portId;
        })
        .map(edge => edge.id);

      // 找到这些边连接的对端节点
      const connectedNodeIds = edges
        .filter(edge => connectedEdgeIds.includes(edge.id))
        .map(edge => {
          const { portA, portB } = edge.data || {};
          // 找到对端端口对应的panelId
          const targetPortId = portA?.id === portId ? portB?.id : portA?.id;
          // 找到包含这个端口的节点
          const node = nodes.find(node =>
            node.data?.ports?.some((port: any) => port.id === targetPortId)
          );
          return node?.id;
        })
        .filter(Boolean);

      setHighlightedEdgeIds(connectedEdgeIds);
      setHighlightedNodeIds(connectedNodeIds);
    } else {
      setHighlightedEdgeIds([]);
      setHighlightedNodeIds([]);
    }
  }, [edges, nodes]);

  // 处理边点击
  const onEdgeClick = useCallback((_event: any, edge: Edge) => {
    const { cable, portA, portB } = edge.data || {};
    Modal.info({
      title: '线缆详情',
      width: 600,
      content: (
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="线缆标签">
            {cable?.label || '未命名'}
          </Descriptions.Item>
          <Descriptions.Item label="线缆类型">
            <Tag color={cableTypeColors[cable?.type]}>{cable?.type}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="长度">
            {cable?.length ? `${cable.length}m` : '未知'}
          </Descriptions.Item>
          <Descriptions.Item label="颜色">{cable?.color || '-'}</Descriptions.Item>
          <Descriptions.Item label="端口A">
            {portA?.label || portA?.number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="端口B">
            {portB?.label || portB?.number || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="备注">{cable?.notes || '-'}</Descriptions.Item>
        </Descriptions>
      ),
    });
  }, []);

  // 导出为图片
  const handleExportImage = () => {
    message.info('导出功能开发中...');
  };

  // 刷新拓扑
  const handleRefresh = () => {
    if (selectedPanelId) {
      loadTopology(selectedPanelId, depth);
    }
  };

  // 打开创建线缆对话框
  const handleOpenCreateCableModal = () => {
    setCreateCableModalVisible(true);
  };

  // 创建线缆成功后刷新拓扑
  const handleCreateCableSuccess = () => {
    handleRefresh();
  };

  // 处理扫码输入
  const handleScanInput = async (value: string) => {
    setScanInput(value);
    if (!value.trim()) return;

    const shortId = parseInt(value.trim(), 10);
    if (isNaN(shortId)) {
      message.error('请输入有效的数字ID');
      return;
    }

    try {
      const panel = await panelService.getByShortId(shortId);
      if (panel) {
        message.success(`已加载面板：${panel.name}`);

        // 自动选择对应的设备和面板
        if (panel.deviceId) {
          setSelectedDeviceId(panel.deviceId);
          // 等待 filteredPanels 更新后设置面板
          setTimeout(() => {
            setSelectedPanelId(panel.id);
            loadTopology(panel.id, depth);
          }, 100);
        }

        // 清空输入框
        setScanInput('');
      }
    } catch (error) {
      console.error('Failed to load panel by shortId:', error);
      message.error('未找到该ID对应的面板');
    }
  };

  return (
    <div>
      <Title level={2}>线缆拓扑图</Title>

      <Card style={{ marginBottom: '16px' }}>
        <Space wrap>
          <Input
            prefix={<ScanOutlined />}
            placeholder="扫描面板二维码或输入ID快速定位"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onPressEnter={(e) => handleScanInput((e.target as HTMLInputElement).value)}
            style={{ width: 300 }}
            size="large"
            allowClear
          />

          <Divider type="vertical" style={{ height: 32 }} />

          <Text strong>选择设备:</Text>
          <Select
            showSearch
            style={{ width: 280 }}
            placeholder="先选择一个设备"
            value={selectedDeviceId}
            onChange={(value) => {
              setSelectedDeviceId(value);
            }}
            allowClear
            filterOption={(input, option) => {
              const label = option?.label;
              if (typeof label === 'string') {
                return label.toLowerCase().includes(input.toLowerCase());
              }
              return false;
            }}
          >
            {devices.map((device) => (
              <Option key={device.id} value={device.id} label={device.name}>
                {device.name} <Tag color={nodeTypeColors[device.type] || '#8c8c8c'}>{device.type}</Tag>
              </Option>
            ))}
          </Select>

          <Text strong>选择面板:</Text>
          <Select
            showSearch
            style={{ width: 280 }}
            placeholder={selectedDeviceId ? '选择该设备下的面板' : '请先选择设备'}
            value={selectedPanelId}
            onChange={(value) => {
              setSelectedPanelId(value);
              loadTopology(value, depth);
            }}
            disabled={!selectedDeviceId || filteredPanels.length === 0}
            filterOption={(input, option) => {
              const label = option?.label;
              if (typeof label === 'string') {
                return label.toLowerCase().includes(input.toLowerCase());
              }
              return false;
            }}
          >
            {filteredPanels.map((panel) => (
              <Option key={panel.id} value={panel.id} label={panel.name}>
                {panel.name} <Tag>{panel.type}</Tag>
              </Option>
            ))}
          </Select>

          <Text strong>深度:</Text>
          <Select
            style={{ width: 100 }}
            value={depth}
            onChange={(value) => {
              setDepth(value);
              if (selectedPanelId) {
                loadTopology(selectedPanelId, value);
              }
            }}
          >
            <Option value={1}>1层</Option>
            <Option value={2}>2层</Option>
            <Option value={3}>3层</Option>
            <Option value={5}>5层</Option>
          </Select>

          <Divider type="vertical" />

          <Tooltip title="创建连接">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleOpenCreateCableModal}
            >
              创建连接
            </Button>
          </Tooltip>

          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
          </Tooltip>

          <Tooltip title="适应视图">
            <Button
              icon={<FullscreenOutlined />}
              onClick={() => fitView({ padding: 0.2, duration: 800 })}
            />
          </Tooltip>

          <Tooltip title="放大">
            <Button icon={<ZoomInOutlined />} onClick={() => zoomIn({ duration: 200 })} />
          </Tooltip>

          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut({ duration: 200 })} />
          </Tooltip>

          <Tooltip title="导出图片">
            <Button icon={<DownloadOutlined />} onClick={handleExportImage} />
          </Tooltip>
        </Space>
      </Card>

      <Card>
        <div style={{ height: '70vh', position: 'relative' }}>
          {loading ? (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
              }}
            >
              <Spin size="large" tip="加载拓扑图中..." />
            </div>
          ) : null}

          <ReactFlow
            nodes={styledNodes}
            edges={styledEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            minZoom={0.1}
            maxZoom={4}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const device = node.data?.device;
                return nodeTypeColors[device?.type || 'OTHER'] || '#8c8c8c';
              }}
              nodeStrokeWidth={3}
              zoomable
              pannable
            />
            <Panel position="top-right">
              <Card size="small" style={{ width: 200 }}>
                <Text strong>图例</Text>
                <div style={{ marginTop: 8 }}>
                  {Object.entries(nodeTypeColors).map(([type, color]) => (
                    <div key={type} style={{ marginBottom: 4 }}>
                      <Tag color={color}>{type}</Tag>
                    </div>
                  ))}
                </div>
              </Card>
            </Panel>
          </ReactFlow>
        </div>
      </Card>

      {/* 节点详情弹窗 */}
      <Modal
        title="设备详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={700}
      >
        {selectedNode && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="设备名称" span={2}>
              {selectedNode.data?.device?.name || '未命名'}
            </Descriptions.Item>
            <Descriptions.Item label="设备类型">
              <Tag color={nodeTypeColors[selectedNode.data?.device?.type || 'OTHER']}>
                {selectedNode.data?.device?.type || 'UNKNOWN'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="序列号">
              {selectedNode.data?.device?.serialNumber || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="面板名称" span={2}>
              {selectedNode.data?.panel?.name || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="面板类型">
              {selectedNode.data?.panel?.type || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="端口数量">
              {selectedNode.data?.ports?.length || 0}
            </Descriptions.Item>
            <Descriptions.Item label="已连接端口" span={2}>
              {selectedNode.data?.ports
                ?.map((p: any) => p.label || p.number)
                .join(', ') || '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* 创建线缆连接对话框 */}
      <CreateCableModal
        visible={createCableModalVisible}
        onClose={() => setCreateCableModalVisible(false)}
        onSuccess={handleCreateCableSuccess}
        initialPanelAId={selectedPanelId}
      />

      {/* 接口可视化模态框 */}
      <Modal
        title="设备接口可视化"
        open={portModalVisible}
        onCancel={() => {
          setPortModalVisible(false);
          setSelectedDeviceForPorts(null); // 清除选中设备
        }}
        footer={null}
        width={1000}
        style={{ top: 20 }}
        destroyOnClose={true}
      >
        {selectedDeviceForPorts && (
          <PortVisualization
            key={`${selectedDeviceForPorts.id}-${selectedDeviceForPorts.data?.panel?.id}`} // 添加复合key
            device={selectedDeviceForPorts.data?.device}
            panel={selectedDeviceForPorts.data?.panel}
            ports={selectedDeviceForPorts.data?.ports || []}
            edges={edges}
          />
        )}
      </Modal>
    </div>
  );
}

// 接口可视化组件 - 显示所有端口，用颜色区分连接状态
function PortVisualization({ device, panel, ports, edges }: {
  device: Device;
  panel: PanelType;
  ports: any[];
  edges: Edge[]
}) {
  const [allPorts, setAllPorts] = useState<Port[]>([]);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [allDevices, setAllDevices] = useState<Device[]>([]);
  const [devicesMap, setDevicesMap] = useState<Map<string, Device>>(new Map());
  const [allCabinets, setAllCabinets] = useState<Cabinet[]>([]);
  const [cabinetsMap, setCabinetsMap] = useState<Map<string, Cabinet>>(new Map());
  const [allRooms, setAllRooms] = useState<Room[]>([]);
  const [roomsMap, setRoomsMap] = useState<Map<string, Room>>(new Map());
  const [panelToDeviceMap, setPanelToDeviceMap] = useState<Map<string, Device>>(new Map());

  // 加载所有设备和机柜信息
  useEffect(() => {
    const loadAllData = async () => {
      try {
        // 加载设备信息
        const devicesData = await deviceService.getAll();
        const devicesList = Array.isArray(devicesData) ? devicesData : [];
        setAllDevices(devicesList);

        // 创建设备映射表，方便快速查找
        const deviceMap = new Map<string, Device>();
        devicesList.forEach((device: Device) => {
          deviceMap.set(device.id, device);
        });
        setDevicesMap(deviceMap);

        // 创建面板到设备的映射表
        const panelDeviceMap = new Map<string, Device>();
        for (const device of devicesList) {
          if (!device.id) continue;
          try {
            const devicePanels = await panelService.getByDevice(device.id);
            devicePanels.forEach((panel: PanelType) => {
              if (panel.id) {
                panelDeviceMap.set(panel.id, device);
              }
            });
          } catch (error) {
            console.error(`Failed to load panels for device ${device.id}:`, error);
          }
        }
        setPanelToDeviceMap(panelDeviceMap);

        // 加载机柜信息
        const cabinetsData = await cabinetService.getAll();
        const cabinetsList = Array.isArray(cabinetsData) ? cabinetsData : [];
        setAllCabinets(cabinetsList);

        // 创建机柜映射表
        const cabinetMap = new Map<string, Cabinet>();
        cabinetsList.forEach((cabinet: Cabinet) => {
          cabinetMap.set(cabinet.id, cabinet);
        });
        setCabinetsMap(cabinetMap);

        // 加载机房信息
        const roomsData = await roomService.getAll();
        const roomsList = Array.isArray(roomsData) ? roomsData : [];
        setAllRooms(roomsList);

        // 创建机房映射表
        const roomMap = new Map<string, Room>();
        roomsList.forEach((room: Room) => {
          roomMap.set(room.id, room);
        });
        setRoomsMap(roomMap);

        console.log('Loaded devices:', devicesList.length, 'cabinets:', cabinetsList.length, 'rooms:', roomsList.length, 'panel mappings:', panelDeviceMap.size);
      } catch (error) {
        console.error('Failed to load data:', error);
        message.error('加载设备或机柜信息失败');
      }
    };

    loadAllData();
  }, []);

  // 加载面板的所有端口
  useEffect(() => {
    const loadAllPorts = async () => {
      if (!panel?.id) return;

      try {
        setLoadingPorts(true);
        const panelPorts = await portService.getAll(panel.id);
        setAllPorts(panelPorts);
      } catch (error) {
        console.error('Failed to load all ports:', error);
        message.error('加载端口信息失败');
        setAllPorts([]);
      } finally {
        setLoadingPorts(false);
      }
    };

    loadAllPorts();
  }, [panel?.id]);

  // 转换端口数据格式，包含所有端口
  const portDefinitions: PortDefinition[] = allPorts.map((port: Port) => {
    // 获取端口连接的边来判断连接状态
    const connectedEdges = edges.filter(edge => {
      const { portA, portB } = edge.data || {};
      return portA?.id === port.id || portB?.id === port.id;
    });

    const isConnected = connectedEdges.length > 0;

    // 获取连接的边的详细信息
    const connectedEdge = edges.find(edge => {
      const { portA, portB } = edge.data || {};
      return portA?.id === port.id || portB?.id === port.id;
    });

    // 获取对端端口信息
    const connectedPort = connectedEdge?.data;
    const targetPort = connectedPort?.portA?.id === port.id ? connectedPort?.portB : connectedPort?.portA;

    // 调试信息
    if (isConnected) {
      console.log('=== 连接信息调试 ===');
      console.log('当前端口:', port.id, port.label);
      console.log('连接边数据:', connectedEdge?.data);
      console.log('对端端口:', targetPort);
      console.log('edges 数据结构:', edges.slice(0, 1));
    }

    // 获取对端面板和设备信息
    let targetPanel = null;
    let targetDevice = null;

    if (targetPort && targetPort.panelId) {
      // 通过拓扑数据查找对端设备（更可靠的方式）
      const targetEdge = edges.find(edge => {
        const { portA, portB } = edge.data || {};
        return (portA?.id === port.id || portB?.id === port.id);
      });

      if (targetEdge && targetEdge.data) {
        const { portA, portB, deviceA, deviceB } = targetEdge.data;

        // 确定对端端口和设备
        const isPortA = portA?.id === port.id;
        const targetPortFromEdge = isPortA ? portB : portA;
        const targetDeviceFromEdge = isPortA ? deviceB : deviceA;

        console.log('查找对端设备:', {
          isPortA,
          targetPortFromEdge,
          targetDeviceFromEdge,
          availableDevices: Array.from(devicesMap.entries()).slice(0, 5)
        });

        // 查找对端设备信息
        if (targetDeviceFromEdge?.id) {
          targetDevice = devicesMap.get(targetDeviceFromEdge.id);
        }

        // 如果通过边数据没找到设备，尝试通过面板ID查找
        if (!targetDevice && targetPortFromEdge?.panelId) {
          targetDevice = panelToDeviceMap.get(targetPortFromEdge.panelId);
          console.log('通过面板ID查找设备:', {
            panelId: targetPortFromEdge.panelId,
            foundDevice: targetDevice?.name || '未找到',
            panelMapSize: panelToDeviceMap.size
          });
        }

        // 构建对端面板信息
        if (targetDevice) {
          targetPanel = {
            id: targetPortFromEdge?.panelId || targetPort.panelId,
            name: `${targetDevice.name} - 面板`,
            type: 'NETWORK',
            deviceId: targetDevice.id,
            size: { width: 482.6, height: 44.45 },
            backgroundColor: '#FFFFFF'
          };

          console.log('成功找到对端设备:', {
            deviceName: targetDevice.name,
            deviceType: targetDevice.type,
            cabinetId: targetDevice.cabinetId,
            uPosition: targetDevice.uPosition
          });
        }
      }
    }

    // 创建一个特殊的端口类型来标识连接状态
    const enhancedPortType = isConnected ? `${port.portType || 'RJ45'}_CONNECTED` : (port.portType || 'RJ45');

    // 构建连接信息
    let connectionLabel = undefined;
    if (isConnected && targetPort) {
      connectionLabel = `→ ${targetPort.label || targetPort.number}`;
      // 如果有线缆信息，也添加进去
      if (connectedEdge?.data?.cable) {
        connectionLabel += ` [${connectedEdge.data.cable.type || '线缆'}]`;
      }
    }

    return {
      id: port.id,
      number: isConnected ? `●${port.label || port.number}` : `○${port.label || port.number}`, // 用符号区分连接状态
      portType: enhancedPortType,
      position: port.position || {
        x: 20 + (parseInt(port.number) - 1) * 25,
        y: 20
      },
      size: port.size || { width: 20, height: 12 },
      label: connectionLabel,
      rotation: port.rotation || 0,
      // 额外的连接信息用于点击显示
      connectionInfo: {
        targetPort: targetPort,
        targetPanel: targetPanel,
        targetDevice: targetDevice,
        cable: connectedEdge?.data?.cable,
        edge: connectedEdge
      }
    };
  });

  const panelWidth = panel.size?.width || 482.6;
  const panelHeight = panel.size?.height || 44.45;
  const backgroundColor = panel.backgroundColor || '#FFFFFF';

  const connectedPortsCount = allPorts.filter(port => {
    return edges.some(edge => {
      const { portA, portB } = edge.data || {};
      return portA?.id === port.id || portB?.id === port.id;
    });
  }).length;

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3>{device.name} - {panel.name} 接口图</h3>
        <p>
          设备类型: {device.type} |
          总端口: {allPorts.length} |
          已连接: {connectedPortsCount} |
          未连接: {allPorts.length - connectedPortsCount} |
          面板尺寸: {panelWidth} × {panelHeight} mm
        </p>
      </div>

      {loadingPorts ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" tip="加载端口信息..." />
        </div>
      ) : (
        <>
          {/* 使用自定义端口可视化显示接口图 */}
          <CustomPortVisualization
            width={panelWidth}
            height={panelHeight}
            backgroundColor={backgroundColor}
            ports={portDefinitions}
            cabinetsMap={cabinetsMap}
            roomsMap={roomsMap}
            device={device}
          />

          <div style={{ marginTop: '16px', fontSize: '12px', color: '#666' }}>
            <div>端口状态说明:</div>
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span>● 深色端口: 已连接</span>
              <span>● 浅色端口: 未连接</span>
              <span>● 端口标签: 显示对端连接信息</span>
              <span>● 不同颜色: 不同端口类型</span>
              <span>● 实际比例: 真实面板尺寸</span>
            </div>
            <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#e6f7ff', borderRadius: '4px' }}>
              <div style={{ color: '#1890ff', marginBottom: '4px' }}>
                <InfoCircleOutlined style={{ marginRight: '4px' }} />
                交互功能
              </div>
              <div>• 点击已连接端口可查看详细连接信息</div>
              <div>• 虚线框表示可点击的连接端口</div>
              <div>• 连接端口会闪烁显示</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// 扩展的端口可视化组件，支持连接状态闪烁和端口点击
function CustomPortVisualization({ width, height, backgroundColor, ports, cabinetsMap, roomsMap, device }: {
  width: number;
  height: number;
  backgroundColor: string;
  ports: PortDefinition[];
  cabinetsMap: Map<string, Cabinet>;
  roomsMap: Map<string, Room>;
  device: Device;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom] = useState(1.5);
  const [time, setTime] = useState(0);
  const [clickedPortInfo, setClickedPortInfo] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 动画循环
  useEffect(() => {
    let animationId: number;

    const animate = () => {
      setTime(prev => prev + 0.05); // 控制闪烁速度
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []);

  // 处理端口点击 - 显示对端设备信息
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    // 查找点击的端口
    const clickedPort = ports.find(
      (port) =>
        x >= port.position.x &&
        x <= port.position.x + port.size.width &&
        y >= port.position.y &&
        y <= port.position.y + port.size.height
    );

    if (clickedPort && clickedPort.portType?.includes('_CONNECTED')) {
      // 如果点击的是已连接的端口，显示详细信息
      const portNumber = clickedPort.number.replace(/[●○]/, '');
      const connectionInfo = (clickedPort as any).connectionInfo;

      setClickedPortInfo({
        port: clickedPort,
        portNumber: portNumber,
        targetPort: connectionInfo?.targetPort,
        targetPanel: connectionInfo?.targetPanel,
        targetDevice: connectionInfo?.targetDevice,
        cable: connectionInfo?.cable,
        edge: connectionInfo?.edge
      });
      setDetailModalVisible(true);
    }
  };

  // 绘制端口
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制面板背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width * zoom, height * zoom);

    // 绘制边框
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width * zoom, height * zoom);

    // 绘制端口
    ports.forEach((port) => {
      const isConnected = port.portType?.includes('_CONNECTED');
      const basePortType = port.portType?.replace('_CONNECTED', '') || 'RJ45';

      let portColor = '#8c8c8c'; // 默认颜色
      try {
        const portSize = getPortSize(basePortType as any);
        portColor = portSize.color || '#8c8c8c';
      } catch {
        // 使用默认颜色
      }

      // 计算闪烁效果（已连接的端口会闪烁）
      let alpha = 1;
      if (isConnected) {
        alpha = 0.5 + 0.5 * Math.sin(time * 3); // 闪烁效果
      } else {
        alpha = 0.4; // 未连接端口半透明
      }

      // 保存当前画布状态
      ctx.save();

      // 计算端口中心点
      const centerX = (port.position.x + port.size.width / 2) * zoom;
      const centerY = (port.position.y + port.size.height / 2) * zoom;

      // 移动到端口中心
      ctx.translate(centerX, centerY);
      if (port.rotation) {
        ctx.rotate((port.rotation * Math.PI) / 180);
      }

      // 绘制端口矩形
      ctx.fillStyle = portColor + Math.floor(alpha * 255).toString(16).padStart(2, '0');
      ctx.fillRect(
        (-port.size.width / 2) * zoom,
        (-port.size.height / 2) * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 绘制端口边框
      ctx.strokeStyle = isConnected ? '#0050b3' : '#8c8c8c';
      ctx.lineWidth = isConnected ? 2 : 1;
      ctx.strokeRect(
        (-port.size.width / 2) * zoom,
        (-port.size.height / 2) * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 为已连接的端口添加点击提示效果
      if (isConnected) {
        ctx.strokeStyle = '#1890ff40';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(
          (-port.size.width / 2 - 2) * zoom,
          (-port.size.height / 2 - 2) * zoom,
          (port.size.width + 4) * zoom,
          (port.size.height + 4) * zoom
        );
        ctx.setLineDash([]);
      }

      // 绘制端口编号
      ctx.fillStyle = isConnected ? '#fff' : '#666';
      ctx.font = `${10 * zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.number.replace(/[●○]/, ''), 0, 0); // 移除连接状态符号

      // 恢复画布状态
      ctx.restore();

      // 如果有端口类型标签，在端口下方显示（不旋转）
      if (port.portType && !isConnected) {
        ctx.fillStyle = '#595959';
        ctx.font = `${8 * zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const displayPortType = port.portType.replace('_CONNECTED', '');
        ctx.fillText(
          displayPortType,
          centerX,
          (port.position.y + port.size.height + 2) * zoom
        );
      }
    });

    // 绘制连接状态的端口标签
    ports.forEach((port) => {
      const isConnected = port.portType?.includes('_CONNECTED');
      if (isConnected && port.label) {
        const centerX = (port.position.x + port.size.width / 2) * zoom;
        const centerY = (port.position.y + port.size.height + 15) * zoom;

        ctx.fillStyle = '#1890ff';
        ctx.font = `${8 * zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(port.label, centerX, centerY);
      }
    });

  }, [ports, zoom, width, height, backgroundColor, time]);

  return (
    <div
      style={{
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        overflow: 'auto',
        maxHeight: '600px',
        backgroundColor: '#fafafa',
        padding: '20px',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width * zoom}
        height={height * zoom}
        onClick={handleCanvasClick}
        style={{
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      />

      {/* 对端设备信息模态框 */}
      <Modal
        title="端口连接详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setClickedPortInfo(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
          clickedPortInfo?.targetPort && (
            <Button
              key="navigate"
              type="primary"
              icon={<LinkOutlined />}
              onClick={() => {
                // 这里可以添加导航到对端设备的逻辑
                message.info('导航功能正在开发中...');
              }}
            >
              查看对端设备
            </Button>
          )
        ]}
        width={600}
      >
        {clickedPortInfo && (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="当前端口">
                <Tag color="blue">{clickedPortInfo.portNumber}</Tag>
                <span style={{ marginLeft: '8px' }}>
                  {clickedPortInfo.port?.portType?.replace('_CONNECTED', '')}
                </span>
              </Descriptions.Item>
              {clickedPortInfo.targetPort && (
                <Descriptions.Item label="对端端口">
                  <Tag color="green">
                    {clickedPortInfo.targetPort?.label || clickedPortInfo.targetPort?.number}
                  </Tag>
                  <span style={{ marginLeft: '8px' }}>
                    {clickedPortInfo.targetPort?.portType}
                  </span>
                </Descriptions.Item>
              )}

              {clickedPortInfo.targetDevice && (
                <>
                  <Descriptions.Item label="对端设备">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Tag color="purple">{clickedPortInfo.targetDevice.type}</Tag>
                      <span style={{ fontWeight: 600 }}>{clickedPortInfo.targetDevice.name}</span>
                    </div>
                  </Descriptions.Item>

                  {clickedPortInfo.targetDevice.model && (
                    <Descriptions.Item label="设备型号">
                      {clickedPortInfo.targetDevice.model}
                    </Descriptions.Item>
                  )}

                  {clickedPortInfo.targetDevice.cabinetId && (
                    <Descriptions.Item label="设备位置">
                      <div style={{ color: '#722ed1', fontWeight: 500 }}>
                        {(() => {
                          const cabinetId = clickedPortInfo.targetDevice.cabinetId;
                          const cabinet = cabinetsMap.get(cabinetId);
                          const room = cabinet?.roomId ? roomsMap.get(cabinet.roomId) : null;
                          const roomName = room?.name || '未知机房';
                          const cabinetName = cabinet?.name || `机柜ID: ${cabinetId}`;
                          const uPosition = clickedPortInfo.targetDevice.uPosition ? `U${clickedPortInfo.targetDevice.uPosition}` : '';
                          const uHeight = clickedPortInfo.targetDevice.uHeight ? `(${clickedPortInfo.targetDevice.uHeight}U)` : '';

                          return `${roomName} - ${cabinetName}${uPosition ? ` - ${uPosition}${uHeight}` : ''}`;
                        })()}
                      </div>
                    </Descriptions.Item>
                  )}

                  {clickedPortInfo.targetPanel && (
                    <Descriptions.Item label="对端面板">
                      <Tag color="cyan">{clickedPortInfo.targetPanel.name}</Tag>
                      <span style={{ marginLeft: '8px', color: '#666' }}>
                        {clickedPortInfo.targetPanel.type}
                      </span>
                    </Descriptions.Item>
                  )}
                </>
              )}
              <Descriptions.Item label="线缆类型">
                {clickedPortInfo.cable ? (
                  <Tag color="orange">{clickedPortInfo.cable.type || '标准线缆'}</Tag>
                ) : (
                  <span style={{ color: '#999' }}>未知线缆类型</span>
                )}
              </Descriptions.Item>
              {clickedPortInfo.cable?.length && (
                <Descriptions.Item label="线缆长度">
                  {clickedPortInfo.cable.length}m
                </Descriptions.Item>
              )}
              {clickedPortInfo.cable?.color && (
                <Descriptions.Item label="线缆颜色">
                  <Tag color={clickedPortInfo.cable.color === 'blue' ? 'blue' :
                            clickedPortInfo.cable.color === 'red' ? 'red' : 'default'}>
                    {clickedPortInfo.cable.color}
                  </Tag>
                </Descriptions.Item>
              )}
            </Descriptions>

            {clickedPortInfo.targetDevice && (
              <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#e6f7ff', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#1890ff', marginBottom: '8px' }}>
                  <InfoCircleOutlined style={{ marginRight: '4px' }} />
                  设备连接路径
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <div>• 本设备: {device.name}</div>
                  <div>• 本端口: {clickedPortInfo.portNumber}</div>
                  <div>• 对端设备: {clickedPortInfo.targetDevice.name}</div>
                  {clickedPortInfo.targetPort && (
                    <div>• 对端端口: {clickedPortInfo.targetPort.label || clickedPortInfo.targetPort.number}</div>
                  )}
                  {clickedPortInfo.targetDevice.cabinetId && (
                    <div>• 对端位置: {(() => {
                      const cabinet = cabinetsMap.get(clickedPortInfo.targetDevice.cabinetId);
                      const room = cabinet?.roomId ? roomsMap.get(cabinet.roomId) : null;
                      const roomName = room?.name || '未知机房';
                      const cabinetName = cabinet?.name || `机柜${clickedPortInfo.targetDevice.cabinetId}`;
                      return `${roomName} - ${cabinetName}`;
                    })()}
                      {clickedPortInfo.targetDevice.uPosition && ` - U${clickedPortInfo.targetDevice.uPosition}`}
                    </div>
                  )}
                  {clickedPortInfo.cable && (
                    <div>• 连接线缆: {clickedPortInfo.cable.type || '标准线缆'}</div>
                  )}
                </div>
              </div>
            )}

            {clickedPortInfo.cable && (
              <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#fff2e8', borderRadius: '6px' }}>
                <div style={{ fontSize: '12px', color: '#fa8c16', marginBottom: '8px' }}>
                  线缆详情
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  <div>• 线缆标识: {clickedPortInfo.cable.id}</div>
                  {clickedPortInfo.cable.description && (
                    <div>• 描述: {clickedPortInfo.cable.description}</div>
                  )}
                  {clickedPortInfo.cable.installDate && (
                    <div>• 安装日期: {new Date(clickedPortInfo.cable.installDate).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

// 使用 ReactFlowProvider 包装组件
export default function CableTopology() {
  return (
    <ReactFlowProvider>
      <CableTopologyContent />
    </ReactFlowProvider>
  );
}
