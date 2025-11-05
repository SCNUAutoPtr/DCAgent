import { useState, useCallback, useEffect } from 'react';
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
import type { Panel as PanelType, Device } from '@/types';
import CreateCableModal from '@/components/CreateCableModal';

const { Title, Text } = Typography;
const { Option } = Select;

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

// 自定义节点组件
function DeviceNode({ data }: { data: any }) {
  const { device, panel, ports } = data;
  const deviceColor = nodeTypeColors[device?.type || 'OTHER'] || '#8c8c8c';

  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        border: `2px solid ${deviceColor}`,
        background: '#fff',
        minWidth: '200px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        position: 'relative',
      }}
    >
      {/* 添加连接句柄 */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />

      <div style={{ marginBottom: '8px' }}>
        <Tag color={deviceColor} style={{ marginBottom: '4px' }}>
          {device?.type || 'UNKNOWN'}
        </Tag>
        <div style={{ fontWeight: 600, fontSize: '14px' }}>
          {device?.name || '未命名设备'}
        </div>
      </div>
      {panel && (
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>面板: {panel.name}</div>
          <div>端口: {ports?.length || 0} 个</div>
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
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [filteredPanels, setFilteredPanels] = useState<PanelType[]>([]);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [depth, setDepth] = useState(3);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [createCableModalVisible, setCreateCableModalVisible] = useState(false);
  const [scanInput, setScanInput] = useState('');

  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // 加载所有面板和设备
  useEffect(() => {
    loadPanelsAndDevices();
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
  const onNodeClick = useCallback((_event: any, node: Node) => {
    setSelectedNode(node);
    setDetailModalVisible(true);
  }, []);

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
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
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
