import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Card, Typography, Tag, Tooltip, Space } from 'antd';
import { CloudServerOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { DeviceType } from '@contracts/enums';
import { effectiveUHeight } from '@contracts/rack';
import { uHeightText } from '@/utils/uHeight';
import './CabinetVisualizer.css';

const { Title } = Typography;

/** What the rack drawing needs of a device; DeviceDto satisfies it. */
export interface RackDevice {
  id: string;
  name: string;
  type: DeviceType;
  uPosition: number | null;
  /** null: height not known, drawn as 1U */
  uHeight: number | null;
  serialNo?: string | null;
  deviceModel?: { name: string } | null;
  ipAddresses?: { address: string }[];
}

// 设备类型配置（名称走 device:deviceTypes）
const DEVICE_CONFIG: Record<DeviceType, {
  color: string;
  icon: React.ReactNode;
  defaultHeight: number; // 默认U高
}> = {
  SERVER: {
    color: '#1890ff',
    icon: <CloudServerOutlined />,
    defaultHeight: 2, // 服务器通常占用2U
  },
  SWITCH: {
    color: '#52c41a',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  ROUTER: {
    color: '#fa8c16',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  FIREWALL: {
    color: '#f5222d',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  STORAGE: {
    color: '#722ed1',
    icon: <SettingOutlined />,
    defaultHeight: 2,
  },
  PDU: {
    color: '#13c2c2',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
  OTHER: {
    color: '#8c8c8c',
    icon: <SettingOutlined />,
    defaultHeight: 1,
  },
};

// 标准1U高度（像素）- 增加高度以容纳所有文字
const U_HEIGHT = 40;
const U_WIDTH = 80;
const U_DEPTH = 120; // 侧视图深度

// 立体效果角度
const ISOMETRIC_ANGLE = 30;

// 视图模式类型
export type ViewMode = '2d' | '3d';

interface CabinetVisualizerProps {
  cabinet: { name: string; heightU: number; positionCode?: string | null };
  devices: RackDevice[];
  viewMode?: ViewMode;
  onDeviceClick?: (device: RackDevice) => void;
}

// 暴露给父组件的实例方法和属性
export interface CabinetVisualizerHandle {
  getActualHeight: () => number;
  getContainerHeight: () => number;
  getScrollContainer: () => HTMLDivElement | null;
  getScrollTop: () => number;
  getScrollHeight: () => number;
  getClientHeight: () => number;
  getSVGVisibleHeight: () => number;
}

export const CabinetVisualizer = forwardRef<CabinetVisualizerHandle, CabinetVisualizerProps>(({
  cabinet,
  devices,
  viewMode = '2d', // 默认使用2D视图
  onDeviceClick,
}, ref) => {
  const { t } = useTranslation(['cabinet', 'device']);
  // 内部 ref 用于获取实际的 DOM 元素
  const containerRef = useRef<HTMLDivElement>(null);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    getActualHeight: () => {
      // 返回机柜实际渲染高度（U位数 * U高度）
      return cabinet.heightU * U_HEIGHT;
    },
    getContainerHeight: () => {
      return containerRef.current?.clientHeight || 0;
    },
    getScrollContainer: () => {
      return containerRef.current;
    },
    getScrollTop: () => {
      return containerRef.current?.scrollTop || 0;
    },
    getScrollHeight: () => {
      return containerRef.current?.scrollHeight || 0;
    },
    getClientHeight: () => {
      return containerRef.current?.clientHeight || 0;
    },
    getSVGVisibleHeight: () => {
      // 获取 SVG 元素在滚动容器中的实际可见高度
      if (!containerRef.current) return 0;

      const svg = containerRef.current.querySelector('svg');
      if (!svg) return 0;

      const containerRect = containerRef.current.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      // 计算 SVG 在容器中的可见区域高度
      const visibleTop = Math.max(svgRect.top, containerRect.top);
      const visibleBottom = Math.min(svgRect.bottom, containerRect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      return visibleHeight;
    },
  }));

  // 创建U位数组（从顶部开始）
  const createUnits = () => {
    const units = [];
    for (let i = cabinet.heightU; i >= 1; i--) {
      units.push(i);
    }
    return units;
  };

  // 检查U位是否被占用
  const isUnitOccupied = (unit: number) => {
    return devices.some(device => {
      const startU = device.uPosition || 0;
      const endU = startU + effectiveUHeight(device.uHeight) - 1;
      return unit >= startU && unit <= endU;
    });
  };

  // 计算设备位置
  const calculateDevicePosition = (device: RackDevice) => {
    const uPosition = device.uPosition || 1;
    const uHeight = effectiveUHeight(device.uHeight);

    // 从顶部开始计算
    const y = (cabinet.heightU - uPosition - uHeight + 1) * U_HEIGHT;

    return {
      y,
      height: uHeight * U_HEIGHT - 2, // 留1px间隙
    };
  };

  // 生成2.5D立体形状（3D视图）
  const renderIsometricShape = (device: RackDevice, position: { y: number; height: number }) => {
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
          {t(`device:deviceTypes.${device.type}`)}
        </text>
      </g>
    );
  };

  // 生成2D前面板形状（2D视图）
  const render2DShape = (device: RackDevice, position: { y: number; height: number }) => {
    const config = DEVICE_CONFIG[device.type];
    const panelWidth = 420; // 减小宽度以适应左右 10px 的偏移（总宽度 450px）

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
          {t(`device:deviceTypes.${device.type}`)} {device.deviceModel ? `- ${device.deviceModel.name}` : ''}
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
          U{device.uPosition} ({uHeightText(device.uHeight, t('device:fields.uHeightUnknown'))})
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
        height={cabinet.heightU * U_HEIGHT + 20}
        viewBox={`0 0 ${U_WIDTH + U_DEPTH + 20} ${cabinet.heightU * U_HEIGHT + 20}`}
        className="cabinet-svg"
      >
        {/* 机柜框架 */}
        <g className="cabinet-frame">
          {/* 左侧立柱 */}
          <rect
            x="0"
            y="0"
            width="4"
            height={cabinet.heightU * U_HEIGHT}
            fill="#333"
          />

          {/* 右侧立柱 */}
          <rect
            x={U_WIDTH - 4}
            y="0"
            width="4"
            height={cabinet.heightU * U_HEIGHT}
            fill="#333"
          />

          {/* 后面立柱（立体效果） */}
          <rect
            x={Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH}
            y={-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            width="4"
            height={cabinet.heightU * U_HEIGHT}
            fill="#666"
            opacity="0.7"
          />

          <rect
            x={U_WIDTH + Math.cos(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH - 4}
            y={-Math.sin(ISOMETRIC_ANGLE * Math.PI / 180) * U_DEPTH * 0.3}
            width="4"
            height={cabinet.heightU * U_HEIGHT}
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
        {[...devices]
          .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0))
          .map(device => {
            const position = calculateDevicePosition(device);
            return (
              <g
                key={device.id}
                className="device-group"
                data-testid={`rack-device-${device.id}`}
                onClick={() => onDeviceClick?.(device)}
                style={{ cursor: 'pointer' }}
              >
                <Tooltip
                  title={
                    <div>
                      <div><strong>{device.name}</strong></div>
                      <div>{t('cabinet:visual.type')}: {t(`device:deviceTypes.${device.type}`)}</div>
                      <div>{t('cabinet:visual.model')}: {device.deviceModel?.name || t('cabinet:visual.unknown')}</div>
                      <div>{t('cabinet:visual.position')}: U{device.uPosition} ({uHeightText(device.uHeight, t('device:fields.uHeightUnknown'))})</div>
                      {device.serialNo && <div>{t('cabinet:visual.serialNo')}: {device.serialNo}</div>}
                      {!!device.ipAddresses?.length && (
                        <div>{t('cabinet:visual.ip')}: {device.ipAddresses.map((a) => a.address).join(', ')}</div>
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
          const y = (cabinet.heightU - unit) * U_HEIGHT;

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
    const panelWidth = 430; // 与 render2DShape 中保持一致
    return (
      <svg
        width={panelWidth + 20}
        height={cabinet.heightU * U_HEIGHT + 20}
        viewBox={`0 0 ${panelWidth + 20} ${cabinet.heightU * U_HEIGHT + 20}`}
        className="cabinet-svg cabinet-svg-2d"
      >
        {/* 机柜框架 - 简化的2D版本 */}
        <g className="cabinet-frame-2d">
          {/* 左侧立柱 */}
          <rect
            x="0"
            y="0"
            width="6"
            height={cabinet.heightU * U_HEIGHT}
            fill="#2c3e50"
            rx="2"
          />

          {/* 右侧立柱 - 调整位置以适应新的面板宽度 */}
          <rect
            x={panelWidth + 4}
            y="0"
            width="6"
            height={cabinet.heightU * U_HEIGHT}
            fill="#2c3e50"
            rx="2"
          />
        </g>

        {/* 渲染设备 - 按U位从高到低排序 */}
        {[...devices]
          .sort((a, b) => (b.uPosition || 0) - (a.uPosition || 0))
          .map(device => {
            const position = calculateDevicePosition(device);
            return (
              <g
                key={device.id}
                className="device-group"
                data-testid={`rack-device-${device.id}`}
                onClick={() => onDeviceClick?.(device)}
                style={{ cursor: 'pointer' }}
                transform="translate(10, 0)"
              >
                <Tooltip
                  title={
                    <div>
                      <div><strong>{device.name}</strong></div>
                      <div>{t('cabinet:visual.type')}: {t(`device:deviceTypes.${device.type}`)}</div>
                      <div>{t('cabinet:visual.model')}: {device.deviceModel?.name || t('cabinet:visual.unknown')}</div>
                      <div>{t('cabinet:visual.position')}: U{device.uPosition} ({uHeightText(device.uHeight, t('device:fields.uHeightUnknown'))})</div>
                      {device.serialNo && <div>{t('cabinet:visual.serialNo')}: {device.serialNo}</div>}
                      {!!device.ipAddresses?.length && (
                        <div>{t('cabinet:visual.ip')}: {device.ipAddresses.map((a) => a.address).join(', ')}</div>
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
          const y = (cabinet.heightU - unit) * U_HEIGHT;

          return (
            <g
              key={`empty-${unit}`}
              className="empty-slot"
              opacity="0.2"
              transform="translate(10, 0)"
            >
              {/* 空U位指示器 - 使用新的面板宽度 */}
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
            <Tag color="blue">{cabinet.heightU}U</Tag>
            {cabinet.positionCode && <Tag color="green">{cabinet.positionCode}</Tag>}
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
          <div ref={containerRef} className={`cabinet-svg-container cabinet-svg-container--${viewMode}`}>
            {viewMode === '3d' ? render3DView() : render2DView()}
          </div>
        </div>

        {/* 图例 */}
        <div className="cabinet-legend">
          <Space split={<span>|</span>}>
            <span className="legend-title">{t('cabinet:visual.legend')}:</span>
            {(Object.entries(DEVICE_CONFIG) as [DeviceType, (typeof DEVICE_CONFIG)[DeviceType]][]).map(([type, config]) => (
              <span key={type} className="legend-item">
                <span
                  className="legend-color"
                  style={{ backgroundColor: config.color }}
                />
                {t(`device:deviceTypes.${type}`)}
              </span>
            ))}
          </Space>
        </div>
      </Card>
    </div>
  );
});
