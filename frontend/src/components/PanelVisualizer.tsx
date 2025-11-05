import React, { useState } from 'react';
import { Panel, Port, PortStatus } from '@/types';
import { Tooltip, Button, Space, message } from 'antd';
import { EditOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { PortType, getPortSize } from '@/constants/portSizes';
import { getPortIcon } from '@/constants/portIcons';
import PanelCanvasEditor, { PortDefinition } from './PanelCanvasEditor';
import { portService } from '@/services/portService';
import './PanelVisualizer.css';

interface PanelVisualizerProps {
  panel: Panel;
  ports: Port[];
  onPortClick?: (port: Port) => void;
  onPortPositionChange?: (portId: string, x: number, y: number) => void; // 新增：端口位置变化回调
  onPortsUpdated?: () => void; // 新增：端口更新后的回调
  scale?: number; // 缩放比例，默认 1mm = 1px
  labelMode?: 'always' | 'hover'; // 标签显示模式：always=始终显示，hover=悬浮显示
  showPortNumber?: boolean; // 是否显示端口编号（默认true）
  allowEdit?: boolean; // 是否允许编辑模式（默认false）
}

// 端口状态颜色映射
const portStatusColors: Record<PortStatus, string> = {
  AVAILABLE: '#52c41a',    // 绿色 - 可用
  OCCUPIED: '#f5222d',     // 红色 - 已占用
  RESERVED: '#faad14',     // 黄色 - 预留
  FAULTY: '#8c8c8c',       // 灰色 - 故障
};

// 端口状态中文
const portStatusLabels: Record<PortStatus, string> = {
  AVAILABLE: '可用',
  OCCUPIED: '已占用',
  RESERVED: '预留',
  FAULTY: '故障',
};

export const PanelVisualizer: React.FC<PanelVisualizerProps> = ({
  panel,
  ports,
  onPortClick,
  onPortPositionChange,
  onPortsUpdated,
  scale = 1,
  labelMode = 'always', // 默认始终显示标签
  showPortNumber = true, // 默认显示端口编号
  allowEdit = false, // 默认不允许编辑
}) => {
  const [hoveredPortId, setHoveredPortId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false); // 编辑模式状态
  const [draggingPort, setDraggingPort] = useState<{ port: Port; startX: number; startY: number } | null>(null);
  const [editablePorts, setEditablePorts] = useState<PortDefinition[]>([]); // 编辑器使用的端口数据

  // 默认使用标准 1U 尺寸（19 英寸机架）
  const panelWidth = (panel.size?.width || (panel as any).width) || 482.6;
  const panelHeight = (panel.size?.height || (panel as any).height) || 44.45;

  // 当进入编辑模式时，将 Port[] 转换为 PortDefinition[]
  const handleEditModeToggle = () => {
    if (!isEditMode) {
      // 进入编辑模式：转换数据格式
      console.log('Converting ports to editable format, ports:', ports);
      const portDefinitions: PortDefinition[] = ports.map((port: Port) => {
        console.log('Port:', port, 'id:', port.id);
        return {
          id: port.id,
          number: port.number,
          portType: port.portType || 'RJ45',
          position: port.position || { x: 20, y: 20 },
          size: port.size || { width: 15, height: 12 },
          label: port.label,
          rotation: (port as any).rotation || 0,
        };
      });
      console.log('Converted portDefinitions:', portDefinitions);
      setEditablePorts(portDefinitions);
    }
    setIsEditMode(!isEditMode);
  };

  // 保存端口位置变化
  const handlePortsChange = async (updatedPorts: PortDefinition[]) => {
    setEditablePorts(updatedPorts);
  };

  // 保存编辑结果
  const handleSaveEdit = async () => {
    if (!panel.id) {
      console.log('No panel.id, skipping save');
      return;
    }

    console.log('Starting save with editablePorts:', editablePorts);

    try {
      // 分离新增和更新的端口
      const portsToCreate = editablePorts.filter(port => !port.id);
      const portsToUpdate = editablePorts.filter(port => port.id);

      console.log('Ports to create:', portsToCreate.length);
      console.log('Ports to update:', portsToUpdate.length);

      // 创建新端口
      const createPromises = portsToCreate.map((port) => {
        console.log('Creating port:', port.number, {
          panelId: panel.id,
          number: port.number,
          position: port.position,
          size: port.size,
          portType: port.portType,
          label: port.label,
          rotation: port.rotation || 0,
          status: 'AVAILABLE',
        });
        return portService.create({
          panelId: panel.id,
          number: port.number,
          position: port.position,
          size: port.size,
          portType: port.portType,
          label: port.label,
          rotation: port.rotation || 0,
          status: 'AVAILABLE',
        } as any);
      });

      // 更新已有端口
      const updatePromises = portsToUpdate.map((port) => {
        console.log('Updating port:', port.id, {
          position: port.position,
          size: port.size,
          portType: port.portType,
          label: port.label,
          rotation: port.rotation || 0,
        });
        return portService.update(port.id!, {
          position: port.position,
          size: port.size,
          portType: port.portType,
          label: port.label,
          rotation: port.rotation || 0,
        } as any);
      });

      // 并发执行所有操作
      await Promise.all([...createPromises, ...updatePromises]);

      message.success(`端口已保存（新增 ${portsToCreate.length} 个，更新 ${portsToUpdate.length} 个）`);
      setIsEditMode(false);
      // 触发父组件重新加载数据
      if (onPortsUpdated) {
        onPortsUpdated();
      }
    } catch (error) {
      console.error('Failed to save port positions:', error);
      message.error('保存失败');
    }
  };

  // SVG 画布尺寸（添加边距）
  const padding = 20;
  const viewBoxWidth = panelWidth + padding * 2;
  const viewBoxHeight = panelHeight + padding * 2;

  // 处理端口拖拽开始
  const handlePortMouseDown = (port: Port, e: React.MouseEvent) => {
    if (!isEditMode || !port.position) return;

    e.preventDefault();
    e.stopPropagation();

    setDraggingPort({
      port,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // 处理端口拖拽中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingPort || !draggingPort.port.position) return;

    const deltaX = (e.clientX - draggingPort.startX) / scale;
    const deltaY = (e.clientY - draggingPort.startY) / scale;

    const newX = Math.max(0, Math.min(panelWidth - (draggingPort.port.size?.width || 15), (draggingPort.port.position.x || 0) + deltaX));
    const newY = Math.max(0, Math.min(panelHeight - (draggingPort.port.size?.height || 12), (draggingPort.port.position.y || 0) + deltaY));

    onPortPositionChange?.(draggingPort.port.id, newX, newY);

    setDraggingPort({
      ...draggingPort,
      startX: e.clientX,
      startY: e.clientY,
    });
  };

  // 处理端口拖拽结束
  const handleMouseUp = () => {
    setDraggingPort(null);
  };

  // 检测标签是否会被遮挡（超出面板边界或与其他端口重叠）
  const shouldLabelBeAbove = (port: Port): boolean => {
    if (!port.position) return false;

    const { x, y } = port.position;
    const labelHeight = 12; // 标签文字高度估计

    // 如果端口在面板底部1/3区域，标签显示在上方
    if (y > panelHeight * 2 / 3) {
      return true;
    }

    // 如果端口编号较大（意味着可能在底部行），显示在上方
    const portNum = parseInt(port.number);
    if (!isNaN(portNum) && portNum > ports.length / 2) {
      return true;
    }

    return false;
  };

  // 渲染单个端口
  const renderPort = (port: Port) => {
    if (!port.position || !port.size) {
      return null;
    }

    const { x, y } = port.position;
    const { width, height } = port.size;
    const color = portStatusColors[port.status];
    const rotation = (port as any).rotation || 0; // 获取旋转角度

    // 获取端口类型信息
    const portTypeInfo = port.portType ? getPortSize(port.portType as PortType) : null;
    const portIcon = port.portType ? getPortIcon(port.portType as PortType) : null;

    // 判断标签应该显示在上方还是下方
    const labelAbove = shouldLabelBeAbove(port);
    const labelY = labelAbove ? -4 : height + 12; // 上方4px 或 下方12px

    // 根据模式决定是否显示标签
    const showLabel = showPortNumber && (labelMode === 'always' || hoveredPortId === port.id);

    // 编辑模式下的光标样式
    const cursorStyle = isEditMode ? 'move' : (onPortClick ? 'pointer' : 'default');

    // 计算旋转中心点（不再加 padding）
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    return (
      <Tooltip
        key={port.id}
        title={
          <div>
            <div><strong>{port.label || `端口 ${port.number}`}</strong></div>
            <div>编号: {port.number}</div>
            {portTypeInfo && <div>类型: {portTypeInfo.label}</div>}
            {portTypeInfo && <div>描述: {portTypeInfo.description}</div>}
            <div>状态: {portStatusLabels[port.status]}</div>
            {port.ipAddress && <div>IP: {port.ipAddress}</div>}
            {port.vlan && <div>VLAN: {port.vlan}</div>}
            {port.speed && <div>速率: {port.speed}</div>}
          </div>
        }
      >
        <g
          className="port"
          transform={`translate(${centerX}, ${centerY}) rotate(${rotation}) translate(${-centerX}, ${-centerY})`}
        >
          {/* 透明的hitbox，确保鼠标交互区域正确 */}
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="transparent"
            stroke="none"
            style={{ cursor: cursorStyle }}
            onClick={() => !isEditMode && onPortClick?.(port)}
            onMouseDown={(e) => handlePortMouseDown(port, e)}
            onMouseEnter={() => setHoveredPortId(port.id)}
            onMouseLeave={() => setHoveredPortId(null)}
          />

          {/* 如果有端口类型图标，使用SVG图标 */}
          {portIcon ? (
            <g transform={`translate(${x}, ${y})`}>
              {/* 容器边框（绿色框框） */}
              <rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="none"
                stroke={color}
                strokeWidth="2"
                rx="1"
                className="port-status-border"
                style={{ pointerEvents: 'none' }}
              />
              {/* 裁剪区域，确保SVG图标不超出边框 */}
              <defs>
                <clipPath id={`clip-${port.id}`}>
                  <rect x={0} y={0} width={width} height={height} />
                </clipPath>
              </defs>
              {/* SVG 图标（填充在容器内，带裁剪） */}
              <g
                clipPath={`url(#clip-${port.id})`}
                dangerouslySetInnerHTML={{ __html: portIcon }}
                transform={`scale(${width / getPortSize(port.portType as PortType).width}, ${height / getPortSize(port.portType as PortType).height})`}
                style={{ pointerEvents: 'none' }}
              />
              {/* 端口编号 - 智能位置（上方或下方） */}
              {showLabel && (
                <text
                  x={width / 2}
                  y={labelY}
                  textAnchor="middle"
                  fill="#333"
                  fontSize="10"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {port.number}
                </text>
              )}
            </g>
          ) : (
            /* 没有图标时，使用原有的矩形显示 */
            <>
              <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color}
                stroke="#333"
                strokeWidth="1"
                className="port-rect"
                style={{ pointerEvents: 'none' }}
              />
              <text
                x={x + width / 2}
                y={y + height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="12"
                fontWeight="bold"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {port.number}
              </text>
            </>
          )}
        </g>
      </Tooltip>
    );
  };

  return (
    <div className="panel-visualizer">
      <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>{panel.name}</h3>
          <div className="panel-info">
            尺寸: {panelWidth} × {panelHeight} mm
            {ports.length === 0 && <span style={{ marginLeft: 16, color: '#999' }}>暂无端口</span>}
          </div>
        </div>
        {allowEdit && (
          <Space>
            <Button
              type={isEditMode ? 'primary' : 'default'}
              icon={isEditMode ? <UnlockOutlined /> : <LockOutlined />}
              onClick={handleEditModeToggle}
              size="small"
            >
              {isEditMode ? '编辑中' : '解锁编辑'}
            </Button>
            {isEditMode && (
              <Button
                type="primary"
                onClick={handleSaveEdit}
                size="small"
              >
                保存
              </Button>
            )}
          </Space>
        )}
      </div>

      {/* 编辑模式：使用 PanelCanvasEditor */}
      {isEditMode ? (
        <PanelCanvasEditor
          width={panelWidth}
          height={panelHeight}
          backgroundColor={panel.backgroundColor || '#FFFFFF'}
          initialPorts={editablePorts}
          onPortsChange={handlePortsChange}
          readOnly={false}
        />
      ) : (
        /* 查看模式：使用原有的 SVG 渲染，去掉 padding，与编辑器保持一致 */
        <>
          <svg
            viewBox={`0 0 ${panelWidth} ${panelHeight}`}
            width={panelWidth * scale}
            height={panelHeight * scale}
            className="panel-svg"
            style={{
              cursor: draggingPort ? 'move' : 'default',
              border: '1px solid #d9d9d9',
              display: 'block'
            }}
          >
            {/* 面板背景 */}
            <rect
              x={0}
              y={0}
              width={panelWidth}
              height={panelHeight}
              fill={panel.backgroundColor || '#f5f5f5'}
              stroke="none"
            />

            {/* 如果有 SVG 路径，渲染 SVG */}
            {panel.svgPath && (
              <image
                href={panel.svgPath}
                width={panelWidth}
                height={panelHeight}
              />
            )}

            {/* 如果有图片，渲染图片 */}
            {panel.image && !panel.svgPath && (
              <image
                href={panel.image}
                width={panelWidth}
                height={panelHeight}
                preserveAspectRatio="xMidYMid meet"
              />
            )}

            {/* 渲染所有端口 */}
            {ports.map(renderPort)}
          </svg>

          {/* 图例 */}
          <div className="panel-legend">
            {Object.entries(portStatusColors).map(([status, color]) => (
              <div key={status} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: color }}
                />
                <span className="legend-label">
                  {portStatusLabels[status as PortStatus]}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
