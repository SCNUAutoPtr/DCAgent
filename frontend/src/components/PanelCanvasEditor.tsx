import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Tooltip,
  Row,
  Col,
  Input,
  Modal,
  Form,
  Select,
  Popconfirm,
  message,
  Divider,
  InputNumber,
} from 'antd';

const { Option } = Select;
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  PlusOutlined,
  DeleteOutlined,
  DragOutlined,
  UndoOutlined,
  RedoOutlined,
  RotateLeftOutlined,
  RotateRightOutlined,
  GroupOutlined,
} from '@ant-design/icons';
import { PortType, getPortSize, PORT_TYPE_OPTIONS } from '@/constants/portSizes';
import { PortIcon } from './PortIcon';

export interface PortDefinition {
  id?: string;
  number: string;
  portType: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  label?: string;
  rotation?: number; // 旋转角度：0, 90, 180, 270
}

interface PanelCanvasEditorProps {
  width: number;
  height: number;
  backgroundColor?: string;
  initialPorts: PortDefinition[];
  onPortsChange?: (ports: PortDefinition[]) => void;
  readOnly?: boolean;
}

const PORT_COLORS = {
  AVAILABLE: '#52c41a',
  SELECTED: '#1890ff',
};

export default function PanelCanvasEditor({
  width,
  height,
  backgroundColor = '#FFFFFF',
  initialPorts,
  onPortsChange,
  readOnly = false,
}: PanelCanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1.5);
  const [ports, setPorts] = useState<PortDefinition[]>(initialPorts);
  const [selectedPorts, setSelectedPorts] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingPorts, setIsDraggingPorts] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [draggedPortsInitialPos, setDraggedPortsInitialPos] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [history, setHistory] = useState<PortDefinition[][]>([initialPorts]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [addPortModalVisible, setAddPortModalVisible] = useState(false);
  const [addPortForm] = Form.useForm();
  const animationFrameRef = useRef<number | null>(null);
  const isInitialMount = useRef(true);

  // 当initialPorts改变时重新初始化编辑器状态（仅首次加载）
  useEffect(() => {
    if (isInitialMount.current) {
      setPorts(initialPorts);
      setSelectedPorts(new Set());
      setHistory([initialPorts]);
      setHistoryIndex(0);
      isInitialMount.current = false;
    }
  }, [initialPorts]);

  // 清理动画帧
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // 不再在每次端口改变时通知父组件，改为在特定时机通知

  // 绘制画布
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
      const isSelected = selectedPorts.has(port.number);
      const rotation = port.rotation || 0; // 旋转角度，默认0

      // 获取端口类型对应的颜色
      const portTypeInfo = port.portType ? getPortSize(port.portType as PortType) : null;
      const portColor = portTypeInfo?.color || PORT_COLORS.AVAILABLE;

      // 保存当前画布状态
      ctx.save();

      // 计算端口中心点
      const centerX = (port.position.x + port.size.width / 2) * zoom;
      const centerY = (port.position.y + port.size.height / 2) * zoom;

      // 移动到端口中心，进行旋转
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);

      // 绘制端口矩形（相对于中心点）
      ctx.fillStyle = isSelected ? PORT_COLORS.SELECTED : portColor;
      ctx.fillRect(
        (-port.size.width / 2) * zoom,
        (-port.size.height / 2) * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 绘制端口边框
      ctx.strokeStyle = isSelected ? '#0050b3' : '#8c8c8c';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.strokeRect(
        (-port.size.width / 2) * zoom,
        (-port.size.height / 2) * zoom,
        port.size.width * zoom,
        port.size.height * zoom
      );

      // 绘制端口编号
      ctx.fillStyle = '#fff';
      ctx.font = `${10 * zoom}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(port.number, 0, 0);

      // 恢复画布状态
      ctx.restore();

      // 如果有端口类型标签，在端口下方显示（不旋转）
      if (port.portType && portTypeInfo) {
        ctx.fillStyle = '#595959';
        ctx.font = `${8 * zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(
          portTypeInfo.label,
          centerX,
          (port.position.y + port.size.height + 2) * zoom
        );
      }
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
  }, [ports, selectedPorts, zoom, width, height, backgroundColor, isDragging, dragStart, dragCurrent]);

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
    if (readOnly) return;

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
        setSelectedPorts(newSelected);
      } else {
        // 单选
        if (!newSelected.has(clickedPort.number)) {
          newSelected.clear();
          newSelected.add(clickedPort.number);
        }
        setSelectedPorts(newSelected);

        // 记录拖拽起始位置和所有选中端口的初始位置
        setIsDraggingPorts(true);
        setDragStart({ x, y });

        const initialPositions = new Map<string, { x: number; y: number }>();
        ports.forEach(port => {
          if (newSelected.has(port.number)) {
            initialPositions.set(port.number, { ...port.position });
          }
        });
        setDraggedPortsInitialPos(initialPositions);
      }
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

  // 鼠标移动事件 - 使用 RAF 优化性能
  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // 取消之前的动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 使用 requestAnimationFrame 来优化性能
    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;

      if (isDraggingPorts && dragStart) {
        // 拖拽端口：计算偏移并更新所有选中端口的位置
        const deltaX = x - dragStart.x;
        const deltaY = y - dragStart.y;

        const newPorts = ports.map(port => {
          if (selectedPorts.has(port.number)) {
            const initialPos = draggedPortsInitialPos.get(port.number);
            if (initialPos) {
              // 计算新位置（带边界检查）
              let newX = initialPos.x + deltaX;
              let newY = initialPos.y + deltaY;

              // 边界限制
              newX = Math.max(0, Math.min(newX, width - port.size.width));
              newY = Math.max(0, Math.min(newY, height - port.size.height));

              return {
                ...port,
                position: { x: newX, y: newY },
              };
            }
          }
          return port;
        });

        setPorts(newPorts);
      } else if (isDragging && dragStart) {
        // 拖拽选框
        setDragCurrent({ x, y });
      }
    });
  }, [readOnly, zoom, isDraggingPorts, dragStart, isDragging, ports, selectedPorts, draggedPortsInitialPos, width, height]);

  // 鼠标释放事件
  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (readOnly) return;

    if (isDraggingPorts && dragStart) {
      // 完成端口拖拽 - 添加到历史记录并通知父组件
      addToHistory(ports);
      if (onPortsChange) {
        onPortsChange(ports);
      }
      setIsDraggingPorts(false);
      setDragStart(null);
      setDraggedPortsInitialPos(new Map());
    } else if (isDragging && dragStart && dragCurrent) {
      // 完成框选
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

      // 重置框选状态
      setIsDragging(false);
      setDragStart(null);
      setDragCurrent(null);
    } else {
      // 其他情况，重置所有拖拽状态
      setIsDragging(false);
      setIsDraggingPorts(false);
      setDragStart(null);
      setDragCurrent(null);
    }
  };

  // 添加端口
  const handleAddPort = () => {
    setAddPortModalVisible(true);
    addPortForm.setFieldsValue({
      portType: PortType.RJ45,
      label: '',
    });
  };

  // 端口类型选项（带图标）
  const portTypeOptionsWithIcons = PORT_TYPE_OPTIONS.map((option) => ({
    ...option,
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <PortIcon portType={option.value} size={20} />
        <span>{option.label}</span>
      </div>
    ),
  }));

  // 确认添加端口
  const handleConfirmAddPort = () => {
    addPortForm.validateFields().then((values) => {
      const { portType, label } = values;
      const portSize = getPortSize(portType);

      const newPortNumber = String(ports.length + 1);
      const newPort: PortDefinition = {
        number: newPortNumber,
        portType,
        position: { x: 20, y: 20 },
        size: { width: portSize.width, height: portSize.height },
        label: label || undefined,
      };
      const newPorts = [...ports, newPort];
      setPorts(newPorts);
      addToHistory(newPorts);
      if (onPortsChange) {
        onPortsChange(newPorts);
      }
      message.success(`已添加 ${portSize.label} 端口 ${newPortNumber}`);

      setAddPortModalVisible(false);
      addPortForm.resetFields();
    });
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
    if (onPortsChange) {
      onPortsChange(newPorts);
    }
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
    if (onPortsChange) {
      onPortsChange(newPorts);
    }
  };

  // 旋转选中端口
  const handleRotateSelected = (angle: number) => {
    if (selectedPorts.size === 0) {
      message.warning('请先选择要旋转的端口');
      return;
    }

    const newPorts = ports.map((port) => {
      if (selectedPorts.has(port.number)) {
        const currentRotation = port.rotation || 0;
        const newRotation = (currentRotation + angle + 360) % 360;
        return {
          ...port,
          rotation: newRotation,
        };
      }
      return port;
    });

    setPorts(newPorts);
    addToHistory(newPorts);
    if (onPortsChange) {
      onPortsChange(newPorts);
    }
  };

  // 批量添加端口组
  const [addPortGroupModalVisible, setAddPortGroupModalVisible] = useState(false);
  const [addPortGroupForm] = Form.useForm();

  const handleAddPortGroup = () => {
    setAddPortGroupModalVisible(true);
    addPortGroupForm.setFieldsValue({
      portType: PortType.RJ45,
      count: 8,
      layout: 'horizontal',
      spacing: 2,
      startX: 20,
      startY: 20,
    });
  };

  const handleConfirmAddPortGroup = () => {
    addPortGroupForm.validateFields().then((values) => {
      const { portType, count, layout, spacing, startX, startY } = values;
      const portSize = getPortSize(portType);

      const newPorts: PortDefinition[] = [];
      for (let i = 0; i < count; i++) {
        const portNumber = String(ports.length + i + 1);
        let x = startX;
        let y = startY;

        if (layout === 'horizontal') {
          x = startX + i * (portSize.width + spacing);
        } else if (layout === 'vertical') {
          y = startY + i * (portSize.height + spacing);
        } else if (layout === 'grid') {
          const cols = Math.ceil(Math.sqrt(count));
          const row = Math.floor(i / cols);
          const col = i % cols;
          x = startX + col * (portSize.width + spacing);
          y = startY + row * (portSize.height + spacing);
        }

        newPorts.push({
          number: portNumber,
          portType,
          position: { x, y },
          size: { width: portSize.width, height: portSize.height },
          rotation: 0,
        });
      }

      const allPorts = [...ports, ...newPorts];
      setPorts(allPorts);
      addToHistory(allPorts);
      if (onPortsChange) {
        onPortsChange(allPorts);
      }
      message.success(`已添加 ${count} 个端口`);

      setAddPortGroupModalVisible(false);
      addPortGroupForm.resetFields();
    });
  };

  if (readOnly) {
    // 只读模式：仅显示画布
    return (
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
          style={{
            cursor: 'default',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        />
      </div>
    );
  }

  return (
    <Card>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 添加端口模态框 */}
        <Modal
          title="添加端口"
          open={addPortModalVisible}
          onOk={handleConfirmAddPort}
          onCancel={() => {
            setAddPortModalVisible(false);
            addPortForm.resetFields();
          }}
          okText="添加"
          cancelText="取消"
        >
          <Form form={addPortForm} layout="vertical">
            <Form.Item
              name="portType"
              label="端口类型"
              rules={[{ required: true, message: '请选择端口类型' }]}
            >
              <Select options={portTypeOptionsWithIcons} placeholder="选择端口类型" />
            </Form.Item>
            <Form.Item name="label" label="端口标签（可选）">
              <Input placeholder="例如：Uplink1, Management" />
            </Form.Item>
          </Form>
        </Modal>

        {/* 批量添加端口组模态框 */}
        <Modal
          title="批量添加端口组"
          open={addPortGroupModalVisible}
          onOk={handleConfirmAddPortGroup}
          onCancel={() => {
            setAddPortGroupModalVisible(false);
            addPortGroupForm.resetFields();
          }}
          okText="添加"
          cancelText="取消"
          width={600}
        >
          <Form form={addPortGroupForm} layout="vertical">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="portType"
                  label="端口类型"
                  rules={[{ required: true, message: '请选择端口类型' }]}
                >
                  <Select options={portTypeOptionsWithIcons} placeholder="选择端口类型" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="count"
                  label="端口数量"
                  rules={[
                    { required: true, message: '请输入端口数量' },
                    { type: 'number', min: 1, max: 100, message: '数量范围：1-100' },
                  ]}
                >
                  <InputNumber style={{ width: '100%' }} placeholder="8" min={1} max={100} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="layout"
              label="布局方式"
              rules={[{ required: true, message: '请选择布局方式' }]}
            >
              <Select placeholder="选择布局方式">
                <Option value="horizontal">水平排列</Option>
                <Option value="vertical">垂直排列</Option>
                <Option value="grid">网格排列</Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="spacing"
              label="间距 (mm)"
              rules={[{ required: true, message: '请输入间距' }]}
            >
              <InputNumber style={{ width: '100%' }} placeholder="2" min={0} step={0.5} />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="startX"
                  label="起始X坐标 (mm)"
                  rules={[{ required: true, message: '请输入X坐标' }]}
                >
                  <InputNumber style={{ width: '100%' }} placeholder="20" min={0} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="startY"
                  label="起始Y坐标 (mm)"
                  rules={[{ required: true, message: '请输入Y坐标' }]}
                >
                  <InputNumber style={{ width: '100%' }} placeholder="20" min={0} />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </Modal>

        {/* 工具栏 */}
        <Row gutter={16}>
          <Col span={24}>
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
        </Row>

        {/* 编辑工具 */}
        <Card size="small" title="端口操作">
          <Space wrap>
            <Button icon={<PlusOutlined />} onClick={handleAddPort}>
              添加端口
            </Button>
            <Button icon={<GroupOutlined />} onClick={handleAddPortGroup}>
              批量添加端口组
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
              icon={<RotateLeftOutlined />}
              onClick={() => handleRotateSelected(-90)}
              disabled={selectedPorts.size === 0}
            >
              逆时针旋转
            </Button>
            <Button
              icon={<RotateRightOutlined />}
              onClick={() => handleRotateSelected(90)}
              disabled={selectedPorts.size === 0}
            >
              顺时针旋转
            </Button>
          </Space>
        </Card>

        {/* 端口类型图例 */}
        {ports.length > 0 && (
          <Card size="small" title="端口类型">
            <Space wrap>
              {Array.from(new Set(ports.map(p => p.portType).filter(Boolean))).map((portType) => {
                const portSize = getPortSize(portType as PortType);
                return (
                  <Tag
                    key={portType}
                    color={portSize.color}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px' }}
                  >
                    <PortIcon portType={portType as PortType} size={16} />
                    <span>{portSize.label} - {portSize.width}×{portSize.height}mm</span>
                  </Tag>
                );
              })}
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
              cursor: isDraggingPorts ? 'move' : isDragging ? 'crosshair' : 'default',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          />
        </div>

        {/* 状态栏 */}
        <Card size="small">
          <Row gutter={16}>
            <Col span={12}>
              <strong>端口总数:</strong> {ports.length}
            </Col>
            <Col span={12}>
              <strong>已选中:</strong> {selectedPorts.size} 个端口
            </Col>
          </Row>
        </Card>

        {/* 使用提示 */}
        <Card size="small" title="操作提示" style={{ backgroundColor: '#e6f7ff' }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>点击端口进行选择，Ctrl/Cmd + 点击可多选</li>
            <li>在空白处拖拽可框选多个端口，Ctrl/Cmd + 拖拽可添加到现有选择</li>
            <li>拖拽端口可调整位置，或使用移动按钮微调（5mm步进）</li>
            <li>使用旋转按钮可旋转选中的端口（每次90度）</li>
            <li>使用"批量添加端口组"可快速添加多个端口（支持水平、垂直、网格布局）</li>
            <li>使用缩放按钮调整视图大小以便精确编辑</li>
            <li>支持撤销/重做操作（Ctrl+Z / Ctrl+Y）</li>
          </ul>
        </Card>
      </Space>
    </Card>
  );
}
