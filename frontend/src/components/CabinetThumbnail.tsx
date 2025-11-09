import { useRef, useEffect, useState } from 'react';
import { Cabinet, Device } from '@/types';
import { ViewMode, CabinetVisualizerHandle } from './CabinetVisualizer';

interface CabinetThumbnailProps {
  cabinet: Cabinet;
  devices: Device[];
  viewMode: ViewMode;
  containerHeight?: number;
  mainViewRef?: React.RefObject<CabinetVisualizerHandle>;
  contentContainerRef?: React.RefObject<HTMLDivElement>;
}

export const CabinetThumbnail: React.FC<CabinetThumbnailProps> = ({
  cabinet,
  devices,
  viewMode,
  containerHeight = 600,
  mainViewRef,
  contentContainerRef,
}) => {
  const [viewportRect, setViewportRect] = useState({ top: 0, height: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  // 监听主视图，根据实际渲染高度更新视口位置
  useEffect(() => {
    const updateViewport = () => {
      if (!mainViewRef?.current) {
        console.log('[CabinetThumbnail] mainViewRef.current is null');
        return;
      }

      const scrollContainer = mainViewRef.current.getScrollContainer();
      if (!scrollContainer) {
        console.log('[CabinetThumbnail] scrollContainer is null');
        return;
      }

      // 获取滚动容器的滚动信息
      const scrollTop = scrollContainer.scrollTop;
      const scrollHeight = scrollContainer.scrollHeight;
      const clientHeight = scrollContainer.clientHeight;

      // 获取机柜实际渲染高度（U位数 * 每U高度）
      const actualCabinetHeight = mainViewRef.current.getActualHeight();

      if (actualCabinetHeight === 0) {
        console.log('[CabinetThumbnail] actualCabinetHeight is 0, setting default viewport');
        setViewportRect({
          top: 0,
          height: 100,
        });
        return;
      }

      // 计算可见U位数量（基于滚动容器信息）
      const U_HEIGHT_IN_VISUALIZER = 40; // 与 CabinetVisualizer 一致

      // 计算实际可见的SVG内容高度
      // 滚动容器 (.cabinet-svg-container--2d) 有 padding: 20px (上下各20px,共40px)
      // header 和 legend 不在滚动容器内，不影响可见高度
      const CONTAINER_PADDING = 40;

      // 实际可见内容高度 = clientHeight - 容器padding
      const actualVisibleContentHeight = clientHeight - CONTAINER_PADDING;

      // 修正 scrollTop：使用比例换算
      // scrollHeight (1740) 包含: padding-top(20) + SVG(1680) + padding-bottom(20) + 额外空间(20)
      // 实际可滚动范围: scrollHeight - clientHeight = 966px
      // 机柜可滚动范围: actualCabinetHeight - actualVisibleContentHeight = 1680 - 440 = 1240px

      const totalScrollRange = scrollHeight - clientHeight; // 966px
      const cabinetScrollRange = actualCabinetHeight - actualVisibleContentHeight; // 1240px

      // 使用比例换算：scrollTop 在总滚动范围中的比例 = adjustedScrollTop 在机柜滚动范围中的比例
      const scrollRatio = totalScrollRange > 0 ? scrollTop / totalScrollRange : 0;
      const adjustedScrollTop = scrollRatio * cabinetScrollRange;

      // 计算已滚动的U位数
      const scrolledUCount = adjustedScrollTop / U_HEIGHT_IN_VISUALIZER;

      // 当前滚动位置能看到多少机柜内容
      const remainingHeight = actualCabinetHeight - adjustedScrollTop;
      const finalVisibleHeight = Math.min(actualVisibleContentHeight, remainingHeight);
      const finalVisibleUCount = finalVisibleHeight / U_HEIGHT_IN_VISUALIZER;

      // 在缩略图中的每U高度和缩放计算
      const uHeight = 12;
      const thumbnailTotalHeight = cabinet.height * uHeight; // SVG原始高度：42 * 12 = 504px
      const thumbnailPaddingTop = 10; // 缩略图容器的paddingTop

      // 计算缩放比例（与renderCabinetView中的逻辑一致）
      const availableHeight = containerHeight - thumbnailPaddingTop - 20;
      const scale = thumbnailTotalHeight > availableHeight ? availableHeight / thumbnailTotalHeight : 1;
      const scaledThumbnailHeight = thumbnailTotalHeight * scale; // 实际渲染高度

      // 计算视口在SVG中的位置（基于原始尺寸）
      const viewportTopInSVG = scrolledUCount * uHeight; // 从SVG顶部开始的像素位置
      const viewportHeightInSVG = finalVisibleUCount * uHeight; // 视口高度（像素）

      // 应用缩放到视口尺寸
      const scaledViewportTop = viewportTopInSVG * scale;
      const scaledViewportHeight = viewportHeightInSVG * scale;

      // 转换为相对于外层容器的百分比
      // 外层容器高度 = containerHeight = 600px
      // SVG在容器中的位置：从 paddingTop 开始
      const viewportTopInContainer = thumbnailPaddingTop + scaledViewportTop;
      const viewportHeightInContainer = scaledViewportHeight;

      // 转换为百分比（基于containerHeight）
      let topPercent = (viewportTopInContainer / containerHeight) * 100;
      let heightPercent = (viewportHeightInContainer / containerHeight) * 100;

      // 确保视口不会超出底部 (top + height <= 100)
      if (topPercent + heightPercent > 100) {
        topPercent = 100 - heightPercent;
      }

      // 确保视口不会超出顶部
      if (topPercent < 0) {
        topPercent = 0;
      }

      // 统一输出所有调试信息
      console.log('[CabinetThumbnail] ========== 视口计算调试信息 ==========');
      console.log({
        '第1步_滚动容器': {
          scrollTop,
          scrollHeight,
          clientHeight,
          可滚动距离: scrollHeight - clientHeight,
        },
        '第2步_机柜高度': {
          cabinetHeightInU: cabinet.height,
          actualCabinetHeight,
          每U高度: U_HEIGHT_IN_VISUALIZER,
        },
        '第3步_可见高度计算': {
          CONTAINER_PADDING,
          '计算公式': 'actualVisibleContentHeight = clientHeight - CONTAINER_PADDING',
          clientHeight,
          actualVisibleContentHeight: actualVisibleContentHeight,
          finalVisibleHeight: finalVisibleHeight,
          finalVisibleUCount: finalVisibleUCount.toFixed(2),
        },
        '第4步_滚动位置修正_比例换算': {
          原始scrollTop: scrollTop,
          totalScrollRange: totalScrollRange,
          cabinetScrollRange: cabinetScrollRange,
          scrollRatio: scrollRatio.toFixed(4),
          adjustedScrollTop: adjustedScrollTop.toFixed(2),
          scrolledUCount: scrolledUCount.toFixed(2),
          remainingHeight: remainingHeight.toFixed(2),
          finalVisibleHeight: finalVisibleHeight.toFixed(2),
        },
        '第5步_缩略图视口计算': {
          thumbnailTotalHeight: thumbnailTotalHeight + 'px',
          availableHeight: availableHeight + 'px',
          scale: scale.toFixed(3),
          scaledThumbnailHeight: scaledThumbnailHeight.toFixed(2) + 'px',
          thumbnailPaddingTop: thumbnailPaddingTop + 'px',
          containerHeight: containerHeight + 'px',
          viewportTopInSVG: viewportTopInSVG.toFixed(2) + 'px',
          viewportHeightInSVG: viewportHeightInSVG.toFixed(2) + 'px',
          scaledViewportTop: scaledViewportTop.toFixed(2) + 'px',
          scaledViewportHeight: scaledViewportHeight.toFixed(2) + 'px',
          viewportTopInContainer: viewportTopInContainer.toFixed(2) + 'px',
        },
        '第6步_最终结果': {
          topPercent: topPercent.toFixed(2) + '%',
          heightPercent: heightPercent.toFixed(2) + '%',
          缩略图视口U位范围: `U${(42 - scrolledUCount - finalVisibleUCount).toFixed(1)} - U${(42 - scrolledUCount).toFixed(1)}`,
          预期主视图U位范围: `U${(42 - scrolledUCount - finalVisibleUCount).toFixed(1)} - U${(42 - scrolledUCount).toFixed(1)}`,
          是否触底限制: topPercent + heightPercent > 100 ? '是' : '否',
        },
      });
      console.log('================================================');

      setViewportRect({
        top: topPercent,
        height: heightPercent,
      });
    };

    if (mainViewRef?.current) {
      const scrollContainer = mainViewRef.current.getScrollContainer();

      if (scrollContainer) {
        // 初始更新
        updateViewport();

        // 监听滚动事件
        scrollContainer.addEventListener('scroll', updateViewport);

        // 监听窗口大小变化
        window.addEventListener('resize', updateViewport);

        // 使用 ResizeObserver 监听滚动容器大小变化
        const resizeObserver = new ResizeObserver(updateViewport);
        resizeObserver.observe(scrollContainer);

        return () => {
          scrollContainer.removeEventListener('scroll', updateViewport);
          window.removeEventListener('resize', updateViewport);
          resizeObserver.disconnect();
        };
      }
    }
  }, [mainViewRef, cabinet.height]);

  // 处理拖动视口指示框来滚动主视图
  const handleViewportDrag = (clientY: number) => {
    if (!thumbnailContainerRef.current || !mainViewRef?.current) return;

    const scrollContainer = mainViewRef.current.getScrollContainer();
    if (!scrollContainer) return;

    const containerRect = thumbnailContainerRef.current.getBoundingClientRect();
    const thumbnailPaddingTop = 10;
    const uHeight = 12;
    const U_HEIGHT_IN_VISUALIZER = 40;

    // 计算缩放比例（与updateViewport中一致）
    const thumbnailTotalHeight = cabinet.height * uHeight;
    const availableHeight = containerHeight - thumbnailPaddingTop - 20;
    const scale = thumbnailTotalHeight > availableHeight ? availableHeight / thumbnailTotalHeight : 1;

    // 计算鼠标在容器中的位置（相对于容器顶部）
    const mouseYInContainer = clientY - containerRect.top;

    // 计算鼠标在缩放后的SVG中的位置（去除padding）
    const mouseYInScaledSVG = mouseYInContainer - thumbnailPaddingTop;

    // 转换回原始SVG坐标（除以缩放比例）
    const mouseYInSVG = mouseYInScaledSVG / scale;

    // 转换为U位数（从顶部U42开始）
    const targetScrolledUCount = mouseYInSVG / uHeight;

    // 转换为主视图的scrollTop
    const actualCabinetHeight = mainViewRef.current.getActualHeight();
    const clientHeight = scrollContainer.clientHeight;
    const CONTAINER_PADDING = 40;
    const actualVisibleContentHeight = clientHeight - CONTAINER_PADDING;

    const adjustedScrollTop = targetScrolledUCount * U_HEIGHT_IN_VISUALIZER;
    const cabinetScrollRange = actualCabinetHeight - actualVisibleContentHeight;
    const totalScrollRange = scrollContainer.scrollHeight - clientHeight;

    // 使用比例换算回实际scrollTop
    const scrollRatio = cabinetScrollRange > 0 ? adjustedScrollTop / cabinetScrollRange : 0;
    const targetScrollTop = scrollRatio * totalScrollRange;

    // 设置滚动位置
    scrollContainer.scrollTop = Math.max(0, Math.min(targetScrollTop, totalScrollRange));
  };

  // 鼠标拖动事件处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleViewportDrag(e.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      handleViewportDrag(e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 触摸拖动事件处理
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleViewportDrag(e.touches[0].clientY);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches.length > 0) {
      handleViewportDrag(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // 添加全局鼠标和触摸事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging]);

  // 渲染简化的机柜视图
  const renderCabinetView = () => {
    const uHeight = 12; // 每个U位的高度（像素）
    const cabinetWidth = 200; // 机柜宽度
    const totalHeight = cabinet.height * uHeight;
    const thumbnailPaddingTop = 10;

    // 计算可用高度（容器高度 - padding - 一些余量）
    const availableHeight = containerHeight - thumbnailPaddingTop - 20; // 留20px底部余量

    // 如果机柜高度超过可用高度，计算缩放比例
    const scale = totalHeight > availableHeight ? availableHeight / totalHeight : 1;
    const scaledWidth = cabinetWidth * scale;
    const scaledHeight = totalHeight * scale;

    return (
      <svg
        width={scaledWidth}
        height={scaledHeight}
        viewBox={`0 0 ${cabinetWidth} ${totalHeight}`}
        style={{
          display: 'block',
          margin: '0 auto',
        }}
      >
        {/* 机柜背景 */}
        <rect
          x={0}
          y={0}
          width={cabinetWidth}
          height={totalHeight}
          fill="#2a2a2a"
          stroke="#444"
          strokeWidth={2}
        />

        {/* U位刻度线 */}
        {Array.from({ length: cabinet.height }, (_, i) => {
          const y = i * uHeight;
          return (
            <g key={`u-${i}`}>
              <line
                x1={0}
                y1={y}
                x2={cabinetWidth}
                y2={y}
                stroke="#555"
                strokeWidth={0.5}
              />
              {/* U位标签 */}
              {i % 5 === 0 && (
                <text
                  x={5}
                  y={y + 8}
                  fill="#888"
                  fontSize={8}
                  fontFamily="monospace"
                >
                  U{cabinet.height - i}
                </text>
              )}
            </g>
          );
        })}

        {/* 设备 */}
        {devices.map((device) => {
          if (!device.uPosition || !device.uHeight) return null;

          const deviceY = (cabinet.height - device.uPosition - device.uHeight + 1) * uHeight;
          const deviceHeight = device.uHeight * uHeight;

          // 设备颜色映射
          const colorMap: Record<string, string> = {
            SERVER: '#1890ff',
            SWITCH: '#52c41a',
            ROUTER: '#fa8c16',
            FIREWALL: '#f5222d',
            STORAGE: '#722ed1',
            PDU: '#13c2c2',
            OTHER: '#8c8c8c',
          };

          const deviceColor = colorMap[device.type] || '#8c8c8c';

          return (
            <g key={device.id}>
              <rect
                x={10}
                y={deviceY}
                width={cabinetWidth - 20}
                height={deviceHeight - 2}
                fill={deviceColor}
                stroke="#fff"
                strokeWidth={1}
                rx={2}
              />
              {/* 设备名称 */}
              {device.uHeight >= 2 && (
                <text
                  x={cabinetWidth / 2}
                  y={deviceY + deviceHeight / 2 + 3}
                  fill="#fff"
                  fontSize={8}
                  fontFamily="Arial"
                  textAnchor="middle"
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {device.name.length > 20 ? device.name.substring(0, 18) + '...' : device.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  return (
    <div
      ref={thumbnailContainerRef}
      style={{
        height: `${containerHeight}px`,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#f5f5f5',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
      }}
    >
      {/* 机柜缩略图 */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          paddingTop: '10px',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {renderCabinetView()}
      </div>

      {/* 视口指示框 */}
      {mainViewRef && (
        <div
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            position: 'absolute',
            left: 0,
            top: `${viewportRect.top}%`,
            width: '100%',
            height: `${viewportRect.height}%`,
            border: '2px solid #1890ff',
            backgroundColor: 'rgba(24, 144, 255, 0.1)',
            pointerEvents: 'auto',
            cursor: isDragging ? 'grabbing' : 'grab',
            transition: isDragging ? 'none' : 'top 0.1s ease-out, height 0.1s ease-out',
            userSelect: 'none',
          }}
        />
      )}
    </div>
  );
};
