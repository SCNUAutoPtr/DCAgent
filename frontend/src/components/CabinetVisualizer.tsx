import React from 'react';
import { Card, Typography, Tag, Tooltip, Space } from 'antd';
import {
  CloudServerOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Device, DeviceType, Cabinet } from '@/types';
import './CabinetVisualizer.css';

const { Title, Text } = Typography;

// 设备类型配置
const DEVICE_CONFIG: Record<DeviceType, {
  label: string;
  color: string;
  icon: React.ReactNode;
  defaultHeight: number; // 默认U高
}> = {
  SERVER: {
    label: '服务器',
    color: '#1890ff',
    icon: <CloudServerOutlined />,
    defaultHeight: 2, // 服务器通常占用2U
  },
  SWITCH: {
    label: '交换机',
    color: '#52c41a',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  ROUTER: {
    label: '路由器',
    color: '#fa8c16',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  FIREWALL: {
    label: '防火墙',
    color: '#f5222d',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  STORAGE: {
    label: '存储',
    color: '#722ed1',
    icon: <SettingOutlined />,
    defaultHeight: 2,
  },
  PDU: {
    label: 'PDU',
    color: '#13c2c2',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  OTHER: {
    label: '其他',
    color: '#8c8c8c',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
};

// 标准1U高度（像素）
const U_HEIGHT = 20;
const U_WIDTH = 80;
const U_DEPTH = 120; // 侧视图深度

// 立体效果角度
const ISOMETRIC_ANGLE = 30;

// 视图模式类型
export type ViewMode = '2d' | '3d';

interface CabinetVisualizerProps {
  cabinet: Cabinet;
  devices: Device[];
  viewMode?: ViewMode; // 视图模式：2D或3D，默认3D
  onDeviceClick?: (device: Device) => void;
  onDeviceEdit?: (device: Device) => void;
  onDeviceDelete?: (device: Device) => void;
  onDeviceDrop?: (deviceId: string, newPosition: number) => void;
}

export const CabinetVisualizer: React.FC<CabinetVisualizerProps> = ({
  cabinet,
  devices,
  viewMode = '2d', // 默认使用2D视图
  onDeviceClick,
  onDeviceEdit,
  onDeviceDelete,
  onDeviceDrop,
}) => {
  // 创建U位数组（从顶部开始）
  const createUnits = () => {
    const units = [];
    for (let i = cabinet.height; i >= 1; i--) {
      units.push(i);
    }
    return units;
  };

  // 检查U位是否被占用
  const isUnitOccupied = (unit: number) => {
    return devices.some(device => {
      const startU = device.uPosition || 0;
      const endU = startU + (device.uHeight || 1) - 1;
      return unit >= startU && unit <= endU;
    });
  };

  // 获取占用该U位的设备
  const getDeviceAtUnit = (unit: number) => {
    return devices.find(device => {
      const startU = device.uPosition || 0;
      const endU = startU + (device.uHeight || 1) - 1;
      return unit >= startU && unit <= endU;
    });
  };

  // 计算设备位置
  const calculateDevicePosition = (device: Device) => {
    const uPosition = device.uPosition || 1;
    const uHeight = device.uHeight || 1;

    // 从顶部开始计算
    const y = (cabinet.height - uPosition - uHeight + 1) * U_HEIGHT;

    return {
      y,
      height: uHeight * U_HEIGHT - 2, // 留1px间隙
    };
  };

  // 生成2.5D立体形状（3D视图）
  const renderIsometricShape = (device: Device, position: any) => {
    const config = DEVICE_CONFIG[device.type];

    return (
      <g className="device-shape">
        {/* 侧面（右面） */}
        <path
          d={`
            M ${U_WIDTH} ${position.y}
            L ${U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
              ${position.y - Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            L ${U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
              ${position.y + position.height - Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            L ${U_WIDTH} ${position.y + position.height}
            Z
          `}
          fill={config.color}
          stroke="#fff"
          strokeWidth="1"
          opacity="0.8"
        />

        {/* 顶面 */}
        <path
          d={`
            M 0 ${position.y}
            L ${Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
              ${position.y - Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            L ${U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
              ${position.y - Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            L ${U_WIDTH} ${position.y}
            Z
          `}
          fill={config.color}
          stroke="#fff"
          strokeWidth="1"
          opacity="0.9"
        />

        {/* 正面 */}
        <rect
          x="0"
          y={position.y}
          width={U_WIDTH}
          height={position.height}
          fill={config.color}
          stroke="#fff"
          strokeWidth="1"
          rx="2"
        />

        {/* 设备图标和文字 */}
        <text
          x={U_WIDTH / 2}
          y={position.y + position.height / 2 - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="12"
          fontWeight="bold"
        >
          {device.name.length > 8 ? device.name.substring(0, 8) + '...' : device.name}
        </text>

        <text
          x={U_WIDTH / 2}
          y={position.y + position.height / 2 + 5}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="10"
          opacity="0.9"
        >
          {config.label}
        </text>
      </g>
    );
  };

  // 生成2D前面板形状（2D视图）
  const render2DShape = (device: Device, position: any) => {
    const config = DEVICE_CONFIG[device.type];
    const panelWidth = 450; // 2D视图下使用更宽的面板

    return (
      <g className="device-shape-2d">
        {/* 前面板矩形 */}
        <rect
          x="0"
          y={position.y}
          width={panelWidth}
          height={position.height}
          fill={config.color}
          stroke="#d9d9d9"
          strokeWidth="2"
          rx="4"
        />

        {/* 内部边框效果 */}
        <rect
          x="4"
          y={position.y + 4}
          width={panelWidth - 8}
          height={position.height - 8}
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          strokeOpacity="0.3"
          rx="2"
        />

        {/* 设备名称 */}
        <text
          x="12"
          y={position.y + position.height / 2 - 8}
          textAnchor="start"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="14"
          fontWeight="bold"
        >
          {device.name}
        </text>

        {/* 设备类型和型号 */}
        <text
          x="12"
          y={position.y + position.height / 2 + 8}
          textAnchor="start"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="11"
          opacity="0.9"
        >
          {config.label} {device.model ? `• ${device.model}` : ''}
        </text>

        {/* U位标识 */}
        <text
          x={panelWidth - 12}
          y={position.y + position.height / 2}
          textAnchor="end"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="12"
          fontWeight="500"
        >
          U{device.uPosition} ({device.uHeight}U)
        </text>

        {/* 装饰性螺丝孔 */}
        <circle cx="8" cy={position.y + 8} r="3" fill="#333" opacity="0.4" />
        <circle cx="8" cy={position.y + position.height - 8} r="3" fill="#333" opacity="0.4" />
        <circle cx={panelWidth - 8} cy={position.y + 8} r="3" fill="#333" opacity="0.4" />
        <circle cx={panelWidth - 8} cy={position.y + position.height - 8} r="3" fill="#333" opacity="0.4" />
      </g>
    );
  };

  // 渲染3D立体视图
  const render3DView = () => {
    return (
      <svg
        width={U_WIDTH + U_DEPTH + 20}
        height={cabinet.height * U_HEIGHT + 20}
        viewBox={`0 0 ${U_WIDTH + U_DEPTH + 20} ${cabinet.height * U_HEIGHT + 20}`}
        className="cabinet-svg"
      >
        {/* 机柜框架 */}
        <g className="cabinet-frame">
          {/* 左侧立柱 */}
          <rect
            x="0"
            y="0"
            width="4"
            height={cabinet.height * U_HEIGHT}
            fill="#333"
          />

          {/* 右侧立柱 */}
          <rect
            x={U_WIDTH - 4}
            y="0"
            width="4"
            height={cabinet.height * U_HEIGHT}
            fill="#333"
          />

          {/* 后面立柱（立体效果） */}
          <rect
            x={Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
            y={-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            width="4"
            height={cabinet.height * U_HEIGHT}
            fill="#666"
            opacity="0.7"
          />

          <rect
            x={U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH - 4}
            y={-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            width="4"
            height={cabinet.height * U_HEIGHT}
            fill="#666"
            opacity="0.7"
          />

          {/* 机柜顶部框架 */}
          <path
            d={`
              M 0 0
              L ${Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
                ${-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
              L ${U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
                ${-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
              L ${U_WIDTH} 0
              Z
            `}
            fill="#444"
            stroke="#222"
            strokeWidth="1"
          />
        </g>

        {/* 渲染设备 - 按U位从高到低排序 */}
        {devices
          .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0))
          .map(device => {
            const position = calculateDevicePosition(device);
            return (
              <g
                key={device.id}
                className="device-group"
                onClick={() => onDeviceClick?.(device)}
                style={{ cursor: 'pointer' }}
              >
                <Tooltip
                  title={
                    <div>
                      <div><strong>{device.name}</strong></div>
                      <div>类型: {DEVICE_CONFIG[device.type].label}</div>
                      <div>型号: {device.model || '未知'}</div>
                      <div>位置: U{device.uPosition} (高{device.uHeight}U)</div>
                      {device.serialNo && <div>序列号: {device.serialNo}</div>}
                      {device.ipAddresses && (
                        <div>IP: {device.ipAddresses.join(', ')}</div>
                      )}
                    </div>
                  }
                >
                  {renderIsometricShape(device, position)}
                </Tooltip>
              </g>
            );
          })}

        {/* 空U位指示器 */}
        {createUnits().map(unit => {
          if (isUnitOccupied(unit)) return null;
          const y = (cabinet.height - unit) * U_HEIGHT;

          return (
            <g
              key={`empty-${unit}`}
              className="empty-slot"
              opacity="0.3"
            >
              <rect
                x="8"
                y={y + 2}
                width={U_WIDTH - 16}
                height={U_HEIGHT - 4}
                fill="none"
                stroke="#999"
                strokeWidth="1"
                strokeDasharray="3,3"
                rx="1"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  // 渲染2D前面板视图
  const render2DView = () => {
    const panelWidth = 450;
    return (
      <svg
        width={panelWidth + 20}
        height={cabinet.height * U_HEIGHT + 20}
        viewBox={`0 0 ${panelWidth + 20} ${cabinet.height * U_HEIGHT + 20}`}
        className="cabinet-svg cabinet-svg-2d"
      >
        {/* 机柜框架 - 简化的2D版本 */}
        <g className="cabinet-frame-2d">
          {/* 左侧立柱 */}
          <rect
            x="0"
            y="0"
            width="6"
            height={cabinet.height * U_HEIGHT}
            fill="#2c3e50"
            rx="2"
          />

          {/* 右侧立柱 */}
          <rect
            x={panelWidth - 6}
            y="0"
            width="6"
            height={cabinet.height * U_HEIGHT}
            fill="#2c3e50"
            rx="2"
          />
        </g>

        {/* 渲染设备 - 按U位从高到低排序 */}
        {devices
          .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0))
          .map(device => {
            const position = calculateDevicePosition(device);
            return (
              <g
                key={device.id}
                className="device-group"
                onClick={() => onDeviceClick?.(device)}
                style={{ cursor: 'pointer' }}
                transform="translate(10, 0)"
              >
                <Tooltip
                  title={
                    <div>
                      <div><strong>{device.name}</strong></div>
                      <div>类型: {DEVICE_CONFIG[device.type].label}</div>
                      <div>型号: {device.model || '未知'}</div>
                      <div>位置: U{device.uPosition} (高{device.uHeight}U)</div>
                      {device.serialNo && <div>序列号: {device.serialNo}</div>}
                      {device.ipAddresses && (
                        <div>IP: {device.ipAddresses.join(', ')}</div>
                      )}
                    </div>
                  }
                >
                  {render2DShape(device, position)}
                </Tooltip>
              </g>
            );
          })}

        {/* 空U位指示器 */}
        {createUnits().map(unit => {
          if (isUnitOccupied(unit)) return null;
          const y = (cabinet.height - unit) * U_HEIGHT;

          return (
            <g
              key={`empty-${unit}`}
              className="empty-slot"
              opacity="0.2"
              transform="translate(10, 0)"
            >
              <rect
                x="4"
                y={y + 2}
                width={panelWidth - 8}
                height={U_HEIGHT - 4}
                fill="none"
                stroke="#999"
                strokeWidth="1"
                strokeDasharray="5,5"
                rx="2"
              />
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div className="cabinet-visualizer">
      <Card className="cabinet-card">
        <div className="cabinet-header">
          <Title level={4}>{cabinet.name}</Title>
          <Space>
            <Tag color="blue">{cabinet.height}U</Tag>
            {cabinet.position && <Tag color="green">{cabinet.position}</Tag>}
          </Space>
        </div>

        <div className={`cabinet-container cabinet-container--${viewMode}`}>
          {/* U位标尺 - 在2D视图中隐藏，在3D视图中显示 */}
          {viewMode === '3d' && (
            <div className="u-ruler">
              {createUnits().map(unit => (
                <div
                  key={unit}
                  className={`u-mark ${isUnitOccupied(unit) ? 'occupied' : 'available'}`}
                  style={{ height: U_HEIGHT }}
                >
                  <span className="u-number">{unit}</span>
                </div>
              ))}
            </div>
          )}

          {/* 机柜SVG视图 - 根据viewMode渲染不同视图 */}
          <div className={`cabinet-svg-container cabinet-svg-container--${viewMode}`}>
            {viewMode === '3d' ? render3DView() : render2DView()}
          </div>
        </div>

        {/* 图例 */}
        <div className="cabinet-legend">
          <Space split={<span>|</span>}>
            <span className="legend-title">设备类型:</span>
            {Object.entries(DEVICE_CONFIG).map(([type, config]) => (
              <span key={type} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: config.color }}
                />
                {config.label}
              </span>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
};
