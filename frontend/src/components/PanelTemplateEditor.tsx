import { useState, useRef, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  InputNumber,
  Select,
  Popconfirm,
  message,
  Divider,
  Tag,
  Tooltip,
  Row,
  Col,
  Input,
} from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  PlusOutlined,
  DeleteOutlined,
  DragOutlined,
  GroupOutlined,
  UngroupOutlined,
  SaveOutlined,
  UndoOutlined,
  RedoOutlined,
} from '@ant-design/icons';
import { PanelType } from '@/types';

interface PortDefinition {
  number: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  group?: string; // 端口组ID
}

interface PortGroup {
  id: string;
  name: string;
  portNumbers: string[];
  color: string;
}

interface PanelTemplateEditorProps {
  templateId?: string;
  templateName: string;
  panelType: PanelType;
  portCount: number;
  width: number;
  height: number;
  initialPorts: PortDefinition[];
  onSave: (ports: PortDefinition[], groups: PortGroup[]) => void;
  onCancel: () => void;
}

const PORT_COLORS = {
  AVAILABLE: '#52c41a',
  SELECTED: '#1890ff',
  GROUPED: '#722ed1',
};

export default function PanelTemplateEditor({
  templateName,
  panelType,
  portCount,
  width,
  height,
  initialPorts,
  onSave,
  onCancel,
}: PanelTemplateEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1.5);
  const [ports, setPorts] = useState<PortDefinition[]>(initialPorts);
  const [selectedPorts, setSelectedPorts] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<PortGroup[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [history, setHistory] = useState<PortDefinition[][]>([initialPorts]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 当initialPorts改变时重新初始化编辑器状态
  useEffect(() => {
    setPorts(initialPorts);
    setSelectedPorts(new Set());
    setGroups([]);
    setHistory([initialPorts]);
    setHistoryIndex(0);
    setZoom(1.5);
  }, [initialPorts]);

  // 绘制画布
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制面板背景
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, width * zoom, height * zoom);

    // 绘制边框
    ctx.strokeStyle = '#d9d9d9';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, width * zoom, height * zoom);

    // 绘制端口
    ports.forEach((port) => {
      const isSelected = selectedPorts.has(port.number);
      const group = groups.find((g) => g.portNumbers.includes(port.number));

      // 绘制端口矩形
      ctx.fillStyle = isSelected
        ? PORT_COLORS.SELECTED
        : group
        ? group.color
        : PORT_COLORS.AVAILABLE;
      ctx.fillRect(
        port.position.x * zoom,
        port.position.y * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 绘制端口边框
      ctx.strokeStyle = isSelected ? '#0050b3' : '#8c8c8c';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(
        port.position.x * zoom,
        port.position.y * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 绘制端口编号
      ctx.fillStyle = '#fff';
      ctx.font = `${10 * zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        port.number,
        (port.position.x + port.size.width / 2) * zoom,
        (port.position.y + port.size.height / 2) * zoom
      );
    });

    // 绘制拖拽选择框
    if (isDragging && dragStart && dragCurrent) {
      const x1 = Math.min(dragStart.x, dragCurrent.x) * zoom;
      const y1 = Math.min(dragStart.y, dragCurrent.y) * zoom;
      const x2 = Math.max(dragStart.x, dragCurrent.x) * zoom;
      const y2 = Math.max(dragStart.y, dragCurrent.y) * zoom;

      // 绘制选择框背景
      ctx.fillStyle = 'rgba(24, 144, 255, 0.1)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

      // 绘制选择框边框
      ctx.strokeStyle = '#1890ff';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }
  }, [ports, selectedPorts, groups, zoom, width, height, isDragging, dragStart, dragCurrent]);

  // 添加到历史记录
  const addToHistory = (newPorts: PortDefinition[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(JSON.parse(JSON.stringify(newPorts)));
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // 撤销
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setPorts(JSON.parse(JSON.stringify(history[historyIndex - 1])));
    }
  };

  // 重做
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setPorts(JSON.parse(JSON.stringify(history[historyIndex + 1])));
    }
  };

  // 鼠标按下事件
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    if (clickedPort) {
      // 点击端口
      const newSelected = new Set(selectedPorts);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd + 点击：多选
        if (newSelected.has(clickedPort.number)) {
          newSelected.delete(clickedPort.number);
        } else {
          newSelected.add(clickedPort.number);
        }
      } else {
        // 单选
        if (!newSelected.has(clickedPort.number)) {
          newSelected.clear();
          newSelected.add(clickedPort.number);
        }
      }
      setSelectedPorts(newSelected);
    } else {
      // 点击空白处，开始拖拽选框
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedPorts(new Set());
      }
      setIsDragging(true);
      setDragStart({ x, y });
      setDragCurrent({ x, y });
    }
  };

  // 鼠标移动事件
  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    setDragCurrent({ x, y });
  };

  // 鼠标释放事件
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !dragCurrent) {
      setIsDragging(false);
      return;
    }

    // 计算选择框范围
    const x1 = Math.min(dragStart.x, dragCurrent.x);
    const y1 = Math.min(dragStart.y, dragCurrent.y);
    const x2 = Math.max(dragStart.x, dragCurrent.x);
    const y2 = Math.max(dragStart.y, dragCurrent.y);

    // 找出选择框内的所有端口
    const portsInSelection = ports.filter((port) => {
      const portCenterX = port.position.x + port.size.width / 2;
      const portCenterY = port.position.y + port.size.height / 2;
      return (
        portCenterX >= x1 &&
        portCenterX <= x2 &&
        portCenterY >= y1 &&
        portCenterY <= y2
      );
    });

    // 更新选中状态
    if (portsInSelection.length > 0) {
      const newSelected = new Set(selectedPorts);
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd：添加到现有选择
        portsInSelection.forEach((port) => newSelected.add(port.number));
      } else {
        // 替换选择
        newSelected.clear();
        portsInSelection.forEach((port) => newSelected.add(port.number));
      }
      setSelectedPorts(newSelected);
    }

    // 重置拖拽状态
    setIsDragging(false);
    setDragStart(null);
    setDragCurrent(null);
  };

  // 添加端口
  const handleAddPort = () => {
    const newPortNumber = String(ports.length + 1);
    const newPort: PortDefinition = {
      number: newPortNumber,
      position: { x: 20, y: 20 },
      size: { width: 16, height: 14 },
    };
    const newPorts = [...ports, newPort];
    setPorts(newPorts);
    addToHistory(newPorts);
    message.success(`已添加端口 ${newPortNumber}`);
  };

  // 删除选中端口
  const handleDeleteSelected = () => {
    if (selectedPorts.size === 0) {
      message.warning('请先选择要删除的端口');
      return;
    }

    const newPorts = ports.filter((port) => !selectedPorts.has(port.number));
    setPorts(newPorts);
    addToHistory(newPorts);
    setSelectedPorts(new Set());
    message.success(`已删除 ${selectedPorts.size} 个端口`);
  };

  // 移动选中端口
  const handleMoveSelected = (dx: number, dy: number) => {
    if (selectedPorts.size === 0) {
      message.warning('请先选择要移动的端口');
      return;
    }

    const newPorts = ports.map((port) => {
      if (selectedPorts.has(port.number)) {
        return {
          ...port,
          position: {
            x: Math.max(0, Math.min(width - port.size.width, port.position.x + dx)),
            y: Math.max(0, Math.min(height - port.size.height, port.position.y + dy)),
          },
        };
      }
      return port;
    });

    setPorts(newPorts);
    addToHistory(newPorts);
  };

  // 创建端口组
  const handleCreateGroup = () => {
    if (selectedPorts.size === 0) {
      message.warning('请先选择要编组的端口');
      return;
    }

    const groupId = `group-${Date.now()}`;
    const colors = ['#722ed1', '#eb2f96', '#fa8c16', '#faad14', '#13c2c2', '#52c41a'];
    const newGroup: PortGroup = {
      id: groupId,
      name: `端口组 ${groups.length + 1}`,
      portNumbers: Array.from(selectedPorts),
      color: colors[groups.length % colors.length],
    };

    setGroups([...groups, newGroup]);
    message.success(`已创建端口组：${newGroup.name}`);
  };

  // 解散端口组
  const handleUngroupSelected = () => {
    if (selectedPorts.size === 0) {
      message.warning('请先选择要解散的端口');
      return;
    }

    const newGroups = groups.filter(
      (group) => !group.portNumbers.some((num) => selectedPorts.has(num))
    );

    setGroups(newGroups);
    message.success('已解散端口组');
  };

  // 保存
  const handleSave = () => {
    onSave(ports, groups);
  };

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 工具栏 */}
        <Row gutter={16}>
          <Col span={12}>
            <Space wrap>
              <Tooltip title="放大">
                <Button
                  icon={<ZoomInOutlined />}
                  onClick={() => setZoom(Math.min(3, zoom + 0.25))}
                />
              </Tooltip>
              <Tooltip title="缩小">
                <Button
                  icon={<ZoomOutOutlined />}
                  onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                />
              </Tooltip>
              <Tag>缩放: {(zoom * 100).toFixed(0)}%</Tag>

              <Divider type="vertical" />

              <Tooltip title="撤销 (Ctrl+Z)">
                <Button
                  icon={<UndoOutlined />}
                  onClick={handleUndo}
                  disabled={historyIndex === 0}
                />
              </Tooltip>
              <Tooltip title="重做 (Ctrl+Y)">
                <Button
                  icon={<RedoOutlined />}
                  onClick={handleRedo}
                  disabled={historyIndex === history.length - 1}
                />
              </Tooltip>
            </Space>
          </Col>
          <Col span={12} style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={onCancel}>取消</Button>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
                保存模板
              </Button>
            </Space>
          </Col>
        </Row>

        {/* 编辑工具 */}
        <Card size="small" title="端口操作">
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={handleAddPort}>
              添加端口
            </Button>
            <Popconfirm
              title="确认删除选中的端口？"
              onConfirm={handleDeleteSelected}
              disabled={selectedPorts.size === 0}
            >
              <Button
                icon={<DeleteOutlined />}
                danger
                disabled={selectedPorts.size === 0}
              >
                删除选中 ({selectedPorts.size})
              </Button>
            </Popconfirm>

            <Divider type="vertical" />

            <Button
              icon={<DragOutlined />}
              onClick={() => handleMoveSelected(0, -5)}
              disabled={selectedPorts.size === 0}
            >
              上移
            </Button>
            <Button
              icon={<DragOutlined />}
              onClick={() => handleMoveSelected(0, 5)}
              disabled={selectedPorts.size === 0}
            >
              下移
            </Button>
            <Button
              icon={<DragOutlined />}
              onClick={() => handleMoveSelected(-5, 0)}
              disabled={selectedPorts.size === 0}
            >
              左移
            </Button>
            <Button
              icon={<DragOutlined />}
              onClick={() => handleMoveSelected(5, 0)}
              disabled={selectedPorts.size === 0}
            >
              右移
            </Button>

            <Divider type="vertical" />

            <Button
              icon={<GroupOutlined />}
              onClick={handleCreateGroup}
              disabled={selectedPorts.size === 0}
            >
              创建端口组
            </Button>
            <Button
              icon={<UngroupOutlined />}
              onClick={handleUngroupSelected}
              disabled={selectedPorts.size === 0}
            >
              解散端口组
            </Button>
          </Space>
        </Card>

        {/* 端口组列表 */}
        {groups.length > 0 && (
          <Card size="small" title="端口组">
            <Space wrap>
              {groups.map((group) => (
                <Tag
                  key={group.id}
                  color={group.color}
                  closable
                  onClose={() => {
                    setGroups(groups.filter((g) => g.id !== group.id));
                  }}
                >
                  {group.name} ({group.portNumbers.join(', ')})
                </Tag>
              ))}
            </Space>
          </Card>
        )}

        {/* 画布区域 */}
        <div
          ref={containerRef}
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
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
            style={{
              cursor: isDragging ? 'crosshair' : 'default',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          />
        </div>

        {/* 状态栏 */}
        <Card size="small">
          <Row gutter={16}>
            <Col span={6}>
              <strong>模板名称:</strong> {templateName}
            </Col>
            <Col span={6}>
              <strong>面板类型:</strong> {panelType}
            </Col>
            <Col span={6}>
              <strong>端口总数:</strong> {ports.length} / {portCount}
            </Col>
            <Col span={6}>
              <strong>已选中:</strong> {selectedPorts.size} 个端口
            </Col>
          </Row>
        </Card>

        {/* 使用提示 */}
        <Card size="small" title="操作提示" style={{ backgroundColor: '#e6f7ff' }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>点击端口进行选择，Ctrl/Cmd + 点击可多选</li>
            <li>在空白处拖拽可框选多个端口，Ctrl/Cmd + 拖拽可添加到现有选择</li>
            <li>使用移动按钮调整选中端口的位置（5mm步进）</li>
            <li>选中多个端口后可创建端口组，方便批量管理</li>
            <li>使用缩放按钮调整视图大小以便精确编辑</li>
            <li>支持撤销/重做操作（Ctrl+Z / Ctrl+Y）</li>
          </ul>
        </Card>
      </Space>
    </Card>
  );
}
