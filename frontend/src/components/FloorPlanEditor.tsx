import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button, Space, Typography, InputNumber, Input, Form, Tag, Spin } from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  PlusOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import { Device, FloorPlanData, Workstation, WorkstationStatus } from '@/types';
import { deviceService } from '@/services/deviceService';
import { workstationService } from '@/services/workstationService';
import { formatShortId, parseShortId } from '@/utils/shortIdFormatter';
import { useTranslation } from 'react-i18next';

const { Text, Title } = Typography;

// 默认尺寸（米）
const DEFAULT_ROOM_WIDTH = 10;
const DEFAULT_ROOM_HEIGHT = 8;
const MIN_ROOM_SIZE = 5;
const MAX_ROOM_SIZE = 100;

// 像素与米的比例
const PIXELS_PER_METER = 50;

// 网格线间距（米）
const GRID_SIZE = 1;

// 拖拽吸附精度（米）：比网格线更细，机柜宽度只有 0.6m，按整米吸附无法贴边摆放
const SNAP_SIZE = 0.1;

// 缩放
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;
// 默认放大到 200%，机柜只有 0.6m 宽，100% 下标签太小
const DEFAULT_ZOOM = 2;

// 默认对象尺寸（米）
const DEFAULT_CABINET_SIZE = { width: 0.6, depth: 1.2 };
const DEFAULT_WORKSTATION_SIZE = { width: 1.2, depth: 0.6 };

// 图例颜色
const CABINET_COLOR = '#1890ff';
const WORKSTATION_COLOR = '#52c41a';
const SELECTED_COLOR = '#fa8c16';

// 盒内标签排版（像素，已包含缩放）
const LABEL_MAX_FONT = 11;
const LABEL_MIN_FONT = 5;
const LABEL_LINE_HEIGHT = 1.2;
const LABEL_PADDING = 4;
// 高宽比超过这个值就把标签竖过来
const LABEL_ROTATE_RATIO = 1.3;
// 折行至少要换来这么大比例的字号提升才值得折（比例而非绝对像素，否则放大后阈值失效）
const SINGLE_LINE_RATIO = 1.2;

// 侧栏预览最多列出的设备数
const PREVIEW_DEVICE_LIMIT = 8;

// 工作站状态颜色
const WORKSTATION_STATUS_COLORS: Record<WorkstationStatus, string> = {
  ONLINE: '#52c41a',
  OFFLINE: '#d9d9d9',
  IN_USE: '#1890ff',
  IDLE: '#faad14',
  MAINTENANCE: '#fa8c16',
  FAULTY: '#f5222d',
};

type Point = { x: number; y: number };
type ObjectSize = { width: number; depth: number };
type ItemType = 'cabinet' | 'workstation';
type Selection = { type: ItemType; id: string };

export interface FloorPlanSaveUpdates {
  roomSize?: { width: number; height: number };
  cabinets?: Array<{ id: string; position: Point }>;
  workstations?: Array<{ id: string; position: Point }>;
}

export interface FloorPlanCabinetInput {
  name: string;
  shortId: number;
  height: number;
  position: Point;
}

interface FloorPlanEditorProps {
  data: FloorPlanData;
  onSave?: (updates: FloorPlanSaveUpdates) => void | Promise<void>;
  onCreateCabinet?: (input: FloorPlanCabinetInput) => void | Promise<void>;
  onCabinetClick?: (cabinetId: string) => void;
  onWorkstationClick?: (workstationId: string) => void;
}

// 无坐标对象的自动排布
const defaultCabinetPosition = (index: number): Point => ({
  x: 1 + (index % 5) * 1.5,
  y: 1 + Math.floor(index / 5) * 2,
});

const defaultWorkstationPosition = (index: number): Point => ({
  x: 1 + (index % 6) * 1.5,
  y: 5 + Math.floor(index / 6) * 1,
});

const buildPositions = <T extends { id: string; position?: Point }>(
  items: T[],
  fallback: (index: number) => Point
): Record<string, Point> =>
  items.reduce<Record<string, Point>>((acc, item, index) => {
    acc[item.id] = item.position || fallback(index);
    return acc;
  }, {});

const getRoomSize = (room: FloorPlanData['room']) => ({
  width: room.floorPlanWidth || DEFAULT_ROOM_WIDTH,
  height: room.floorPlanHeight || DEFAULT_ROOM_HEIGHT,
});

const round2 = (value: number) => Number(value.toFixed(2));

// 未保存过坐标（position 为空）的对象视为有变更，第一次保存会固化自动排布结果
const isMoved = (original: Point | undefined, current: Point | undefined) =>
  !!current && (!original || original.x !== current.x || original.y !== current.y);

const collectMoved = <T extends { id: string; position?: Point }>(
  items: T[],
  positions: Record<string, Point>
) =>
  items
    .filter((item) => isMoved(item.position, positions[item.id]))
    .map((item) => ({ id: item.id, position: positions[item.id] }));

// ---- SVG 文字换行：SVG 的 text 不会自动折行，只能自己切分成 tspan ----

// 中日文按一个字宽算，其余按 0.6 估算
const charWidth = (char: string, fontSize: number) =>
  (/[⺀-鿿＀-￯]/.test(char) ? 1 : 0.6) * fontSize;

const textWidth = (text: string, fontSize: number) =>
  [...text].reduce((width, char) => width + charWidth(char, fontSize), 0);

const wrapText = (text: string, maxWidth: number, fontSize: number, maxLines: number) => {
  const lines: string[] = [];
  let line = '';
  let lineWidth = 0;
  let overflow = false;

  for (const char of text) {
    const width = charWidth(char, fontSize);
    if (line && lineWidth + width > maxWidth) {
      lines.push(line);
      if (lines.length >= maxLines) {
        overflow = true;
        line = '';
        break;
      }
      line = char;
      lineWidth = width;
    } else {
      line += char;
      lineWidth += width;
    }
  }

  if (line) lines.push(line);
  return { lines: lines.length > 0 ? lines : [text.slice(0, 1)], overflow };
};

// 指定字号下能否放下；放不下返回 null
const tryFont = (
  text: string,
  maxWidth: number,
  maxHeight: number,
  fontSize: number,
  lineLimit: number
) => {
  const maxLines = Math.min(
    lineLimit,
    Math.max(1, Math.floor(maxHeight / (fontSize * LABEL_LINE_HEIGHT)))
  );
  const { lines, overflow } = wrapText(text, maxWidth, fontSize, maxLines);
  return overflow ? null : lines;
};

// 在盒子内选字号：折行换来的字号提升不明显时，宁可小一号也不折行（ShortID 断成两截很难认）；
// 实在放不下就用最小字号并省略
const layoutLabel = (text: string, boxWidth: number, boxHeight: number, maxFont: number) => {
  const maxWidth = Math.max(boxWidth - LABEL_PADDING, 4);
  const maxHeight = Math.max(boxHeight - LABEL_PADDING, 4);

  let single: { fontSize: number; lines: string[] } | null = null;
  let wrapped: { fontSize: number; lines: string[] } | null = null;

  for (let fontSize = maxFont; fontSize >= LABEL_MIN_FONT; fontSize -= 0.5) {
    if (!wrapped) {
      const lines = tryFont(text, maxWidth, maxHeight, fontSize, Number.MAX_SAFE_INTEGER);
      if (lines) wrapped = { fontSize, lines };
    }
    if (!single) {
      const lines = tryFont(text, maxWidth, maxHeight, fontSize, 1);
      if (lines) single = { fontSize, lines };
    }
    if (single && wrapped) break;
  }

  if (single && (!wrapped || single.fontSize * SINGLE_LINE_RATIO >= wrapped.fontSize)) {
    return single;
  }
  if (wrapped) return wrapped;

  const maxLines = Math.max(1, Math.floor(maxHeight / (LABEL_MIN_FONT * LABEL_LINE_HEIGHT)));
  const { lines } = wrapText(text, maxWidth, LABEL_MIN_FONT, maxLines);
  const last = lines[lines.length - 1];
  if (last && last.length > 1) {
    lines[lines.length - 1] = `${last.slice(0, -1)}…`;
  }
  return { fontSize: LABEL_MIN_FONT, lines };
};

const overlaps = (a: Point, aSize: ObjectSize, b: Point, bSize: ObjectSize) =>
  a.x < b.x + bSize.width &&
  a.x + aSize.width > b.x &&
  a.y < b.y + bSize.depth &&
  a.y + aSize.depth > b.y;

export const FloorPlanEditor: React.FC<FloorPlanEditorProps> = ({
  data,
  onSave,
  onCreateCabinet,
  onCabinetClick,
  onWorkstationClick,
}) => {
  const { t } = useTranslation();
  const svgRef = useRef<SVGSVGElement>(null);

  // 状态
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [draggedItem, setDraggedItem] = useState<Selection | null>(null);
  const [dragOffset, setDragOffset] = useState<Point>({ x: 0, y: 0 });
  const [selected, setSelected] = useState<Selection | null>(null);

  // 侧栏预览数据
  const [previewDevices, setPreviewDevices] = useState<Device[]>([]);
  const [previewWorkstation, setPreviewWorkstation] = useState<Workstation | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 新建机柜表单
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // 本地位置状态（用于编辑时的临时存储）
  const [cabinetPositions, setCabinetPositions] = useState<Record<string, Point>>(() =>
    buildPositions(data.cabinets, defaultCabinetPosition)
  );
  const [workstationPositions, setWorkstationPositions] = useState<Record<string, Point>>(() =>
    buildPositions(data.workstations, defaultWorkstationPosition)
  );
  const [roomSize, setRoomSize] = useState(() => getRoomSize(data.room));

  // 数据刷新后同步本地状态
  useEffect(() => {
    setCabinetPositions(buildPositions(data.cabinets, defaultCabinetPosition));
    setWorkstationPositions(buildPositions(data.workstations, defaultWorkstationPosition));
    setRoomSize(getRoomSize(data.room));
    setSelected((prev) => {
      if (!prev) return prev;
      const stillExists =
        prev.type === 'cabinet'
          ? data.cabinets.some((cabinet) => cabinet.id === prev.id)
          : data.workstations.some((workstation) => workstation.id === prev.id);
      return stillExists ? prev : null;
    });
  }, [data]);

  // 选中后加载侧栏预览
  useEffect(() => {
    if (!selected) {
      setPreviewDevices([]);
      setPreviewWorkstation(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewDevices([]);
    setPreviewWorkstation(null);

    const load = async () => {
      try {
        if (selected.type === 'cabinet') {
          const devices = await deviceService.getAll(selected.id);
          if (!cancelled) setPreviewDevices(devices);
        } else {
          const workstation = await workstationService.getById(selected.id);
          if (!cancelled) setPreviewWorkstation(workstation);
        }
      } catch (error) {
        console.error('Failed to load floor plan selection detail:', error);
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // 对象实际占地尺寸，拖拽边界按它计算
  const itemSizes = useMemo(() => {
    const sizes: Record<string, ObjectSize> = {};
    data.cabinets.forEach((cabinet) => {
      sizes[cabinet.id] = cabinet.size || DEFAULT_CABINET_SIZE;
    });
    data.workstations.forEach((workstation) => {
      sizes[workstation.id] = workstation.size || DEFAULT_WORKSTATION_SIZE;
    });
    return sizes;
  }, [data]);

  // 计算SVG尺寸（+2px 让机房边框不被裁掉）
  const svgWidth = roomSize.width * PIXELS_PER_METER * zoom + 2;
  const svgHeight = roomSize.height * PIXELS_PER_METER * zoom + 2;

  // 坐标转换：米 -> 像素
  const toPixels = (meters: number) => meters * PIXELS_PER_METER * zoom;

  // 坐标转换：像素 -> 米
  const toMeters = (pixels: number) => pixels / (PIXELS_PER_METER * zoom);

  // 获取鼠标相对于SVG的位置
  const getMousePosition = (e: React.MouseEvent): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: toMeters(e.clientX - rect.left - 1),
      y: toMeters(e.clientY - rect.top - 1),
    };
  };

  // 限制在机房范围内，并吸附到 SNAP_SIZE
  const snap = (value: number, max: number) => {
    const clamped = Math.min(Math.max(value, 0), Math.max(0, max));
    return round2(Math.round(clamped / SNAP_SIZE) * SNAP_SIZE);
  };

  // 开始拖拽
  const handleDragStart = (type: ItemType, id: string, e: React.MouseEvent) => {
    setSelected({ type, id });
    if (!isEditing) return;
    e.stopPropagation();

    const pos = type === 'cabinet' ? cabinetPositions[id] : workstationPositions[id];
    const mousePos = getMousePosition(e);

    setDraggedItem({ type, id });
    setDragOffset({
      x: mousePos.x - (pos?.x || 0),
      y: mousePos.y - (pos?.y || 0),
    });
  };

  // 拖拽中
  const handleDrag = (e: React.MouseEvent) => {
    if (!draggedItem) return;

    const size = itemSizes[draggedItem.id] || DEFAULT_CABINET_SIZE;
    const mousePos = getMousePosition(e);
    const newPos: Point = {
      x: snap(mousePos.x - dragOffset.x, roomSize.width - size.width),
      y: snap(mousePos.y - dragOffset.y, roomSize.height - size.depth),
    };

    if (draggedItem.type === 'cabinet') {
      setCabinetPositions((prev) => ({ ...prev, [draggedItem.id]: newPos }));
    } else {
      setWorkstationPositions((prev) => ({ ...prev, [draggedItem.id]: newPos }));
    }
  };

  // 结束拖拽
  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  // 保存更改：只提交真正变动的部分，成功与否由调用方提示
  const handleSave = async () => {
    const originalRoomSize = getRoomSize(data.room);
    const updates: FloorPlanSaveUpdates = {};

    if (originalRoomSize.width !== roomSize.width || originalRoomSize.height !== roomSize.height) {
      updates.roomSize = roomSize;
    }

    const movedCabinets = collectMoved(data.cabinets, cabinetPositions);
    if (movedCabinets.length > 0) updates.cabinets = movedCabinets;

    const movedWorkstations = collectMoved(data.workstations, workstationPositions);
    if (movedWorkstations.length > 0) updates.workstations = movedWorkstations;

    if (!updates.roomSize && !updates.cabinets && !updates.workstations) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await onSave?.(updates);
      setIsEditing(false);
    } catch (error) {
      // 保存失败时保留编辑态和当前摆放，错误提示由调用方负责
      console.error('Failed to save floor plan:', error);
    } finally {
      setSaving(false);
    }
  };

  // 取消编辑：位置和机房尺寸一起还原
  const handleCancel = () => {
    setCabinetPositions(buildPositions(data.cabinets, defaultCabinetPosition));
    setWorkstationPositions(buildPositions(data.workstations, defaultWorkstationPosition));
    setRoomSize(getRoomSize(data.room));
    setIsEditing(false);
  };

  // 给新机柜找一个不压住别人的空位
  const findFreeSlot = (): Point => {
    const size = DEFAULT_CABINET_SIZE;
    const occupied = [
      ...data.cabinets.map((cabinet) => ({
        pos: cabinetPositions[cabinet.id],
        size: itemSizes[cabinet.id] || DEFAULT_CABINET_SIZE,
      })),
      ...data.workstations.map((workstation) => ({
        pos: workstationPositions[workstation.id],
        size: itemSizes[workstation.id] || DEFAULT_WORKSTATION_SIZE,
      })),
    ].filter((item) => !!item.pos);

    for (let y = 0.5; y <= roomSize.height - size.depth; y += 0.5) {
      for (let x = 0.5; x <= roomSize.width - size.width; x += 0.5) {
        const candidate = { x: round2(x), y: round2(y) };
        const hit = occupied.some((item) => overlaps(candidate, size, item.pos, item.size));
        if (!hit) return candidate;
      }
    }

    return { x: 0, y: 0 };
  };

  // 新建机柜：写库和提示都交给调用方，失败时保留表单
  const handleCreateCabinet = async () => {
    const values = await createForm.validateFields();
    setSubmitting(true);
    try {
      await onCreateCabinet?.({
        name: values.name.trim(),
        shortId: parseShortId(String(values.shortId).trim()),
        height: values.height || 42,
        position: findFreeSlot(),
      });
      createForm.resetFields();
      setCreating(false);
    } catch (error) {
      console.error('Failed to create cabinet:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // 渲染网格
  const renderGrid = () => {
    const lines = [];

    for (let x = GRID_SIZE; x < roomSize.width; x += GRID_SIZE) {
      lines.push(
        <line
          key={`v-${x}`}
          x1={toPixels(x)}
          y1={0}
          x2={toPixels(x)}
          y2={toPixels(roomSize.height)}
          stroke="#f0f0f0"
          strokeWidth={x % 5 === 0 ? 1 : 0.5}
        />
      );
    }

    for (let y = GRID_SIZE; y < roomSize.height; y += GRID_SIZE) {
      lines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={toPixels(y)}
          x2={toPixels(roomSize.width)}
          y2={toPixels(y)}
          stroke="#f0f0f0"
          strokeWidth={y % 5 === 0 ? 1 : 0.5}
        />
      );
    }

    return lines;
  };

  // 盒内多行标签：竖长条（机柜）改成竖排，横向空间才够放下整个 ShortID
  const renderLabel = (
    text: string,
    cx: number,
    top: number,
    boxWidth: number,
    boxHeight: number
  ) => {
    const vertical = boxHeight > boxWidth * LABEL_ROTATE_RATIO;
    const { fontSize, lines } = layoutLabel(
      text,
      vertical ? boxHeight : boxWidth,
      vertical ? boxWidth : boxHeight,
      // 字号上限跟着缩放走，否则放大后盒子变大、字还是原来那么小
      LABEL_MAX_FONT * zoom
    );
    const lineHeight = fontSize * LABEL_LINE_HEIGHT;
    const cy = top + boxHeight / 2;
    const startY = cy - ((lines.length - 1) * lineHeight) / 2;

    return (
      <text
        x={cx}
        y={startY}
        transform={vertical ? `rotate(-90, ${cx}, ${cy})` : undefined}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="white"
        fontSize={fontSize}
        fontWeight="bold"
        pointerEvents="none"
      >
        {lines.map((line, index) => (
          <tspan key={index} x={cx} dy={index === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    );
  };

  // 渲染机柜
  const renderCabinet = (cabinet: FloorPlanData['cabinets'][0]) => {
    const pos = cabinetPositions[cabinet.id];
    if (!pos) return null;

    const size = itemSizes[cabinet.id] || DEFAULT_CABINET_SIZE;
    const x = toPixels(pos.x);
    const y = toPixels(pos.y);
    const width = toPixels(size.width);
    const height = toPixels(size.depth);
    const isSelected = selected?.type === 'cabinet' && selected.id === cabinet.id;

    // 设备数占底部一条，剩下的高度留给名称；字号按"设备 n"这几个字的实际宽度收到盒内
    const countText = t('room:floorPlan.deviceBadge', { count: cabinet.deviceCount });
    const countFont = Math.max(
      LABEL_MIN_FONT,
      Math.min(8 * zoom, (width - LABEL_PADDING) / textWidth(countText, 1))
    );
    const showCount = cabinet.deviceCount > 0 && height > countFont * 3.5;
    const labelHeight = showCount ? height - countFont * 1.6 : height;
    const label = cabinet.shortId ? formatShortId(cabinet.shortId) : cabinet.name;

    return (
      <g
        key={cabinet.id}
        data-testid={`floor-plan-cabinet-${cabinet.id}`}
        data-x={pos.x}
        data-y={pos.y}
        style={{ cursor: isEditing ? 'move' : 'pointer' }}
        onMouseDown={(e) => handleDragStart('cabinet', cabinet.id, e)}
        onClick={() => setSelected({ type: 'cabinet', id: cabinet.id })}
      >
        <title>{cabinet.name}</title>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={CABINET_COLOR}
          stroke={isSelected ? SELECTED_COLOR : '#096dd9'}
          strokeWidth={isSelected ? 2.5 : 1}
          rx={2}
        />
        {renderLabel(label, x + width / 2, y, width, labelHeight)}
        {showCount && (
          <text
            x={x + width / 2}
            y={y + height - countFont * 0.5}
            textAnchor="middle"
            fill="white"
            fontSize={countFont}
            pointerEvents="none"
          >
            {countText}
          </text>
        )}
      </g>
    );
  };

  // 渲染工作站
  const renderWorkstation = (ws: FloorPlanData['workstations'][0]) => {
    const pos = workstationPositions[ws.id];
    if (!pos) return null;

    const size = itemSizes[ws.id] || DEFAULT_WORKSTATION_SIZE;
    const x = toPixels(pos.x);
    const y = toPixels(pos.y);
    const width = toPixels(size.width);
    const height = toPixels(size.depth);
    const isSelected = selected?.type === 'workstation' && selected.id === ws.id;
    const label = ws.assignedTo ? `${ws.code || ws.name} ${ws.assignedTo}` : ws.code || ws.name;

    return (
      <g
        key={ws.id}
        data-testid={`floor-plan-workstation-${ws.id}`}
        data-x={pos.x}
        data-y={pos.y}
        style={{ cursor: isEditing ? 'move' : 'pointer' }}
        onMouseDown={(e) => handleDragStart('workstation', ws.id, e)}
        onClick={() => setSelected({ type: 'workstation', id: ws.id })}
      >
        <title>{ws.name}</title>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={WORKSTATION_STATUS_COLORS[ws.status] || '#d9d9d9'}
          stroke={isSelected ? SELECTED_COLOR : '#8c8c8c'}
          strokeWidth={isSelected ? 2.5 : 1}
          rx={2}
        />
        {renderLabel(label, x + width / 2, y, width, height)}
      </g>
    );
  };

  const legendSwatch = (color: string) => (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: 2,
        background: color,
      }}
    />
  );

  const metaRow = (label: string, value: React.ReactNode) => (
    <div
      key={label}
      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}
    >
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
        {label}
      </Text>
      <span style={{ fontSize: 12, textAlign: 'right', minWidth: 0, wordBreak: 'break-all' }}>
        {value}
      </span>
    </div>
  );

  const unit = t('room:floorPlan.unit');
  const selectedCabinet =
    selected?.type === 'cabinet' ? data.cabinets.find((c) => c.id === selected.id) : undefined;
  const selectedWorkstation =
    selected?.type === 'workstation'
      ? data.workstations.find((w) => w.id === selected.id)
      : undefined;

  // 侧栏：机房概览 + 新建机柜
  const renderOverview = () => (
    <>
      <Text strong style={{ display: 'block', marginBottom: 12 }}>
        {t('room:floorPlan.overview')}
      </Text>
      {metaRow(t('room:floorPlan.cabinet'), data.cabinets.length)}
      {metaRow(t('room:floorPlan.workstation'), data.workstations.length)}
      {metaRow(
        t('room:floorPlan.totalDevices'),
        data.cabinets.reduce((sum, cabinet) => sum + cabinet.deviceCount, 0)
      )}
      {metaRow(t('room:floorPlan.area'), `${round2(roomSize.width * roomSize.height)} m²`)}

      <div style={{ marginTop: 16 }}>
        {creating ? (
          <Form form={createForm} layout="vertical" size="small" requiredMark={false}>
            <Form.Item
              name="name"
              label={t('room:floorPlan.cabinetName')}
              rules={[{ required: true, message: t('room:floorPlan.nameRequired') }]}
            >
              <Input placeholder={t('room:floorPlan.cabinetNamePlaceholder')} />
            </Form.Item>
            <Form.Item
              name="shortId"
              label={t('room:floorPlan.shortId')}
              rules={[
                { required: true, message: t('room:floorPlan.shortIdRequired') },
                {
                  validator: (_, value) => {
                    if (!value || !String(value).trim()) return Promise.resolve();
                    try {
                      parseShortId(String(value).trim());
                      return Promise.resolve();
                    } catch {
                      return Promise.reject(new Error(t('room:floorPlan.shortIdInvalid')));
                    }
                  },
                },
              ]}
            >
              <Input placeholder={t('room:floorPlan.shortIdPlaceholder')} />
            </Form.Item>
            <Form.Item name="height" label={t('room:floorPlan.cabinetHeight')} initialValue={42}>
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
            <Space>
              <Button
                type="primary"
                size="small"
                loading={submitting}
                onClick={handleCreateCabinet}
                data-testid="floor-plan-create-submit"
              >
                {t('room:floorPlan.create')}
              </Button>
              <Button
                type="text"
                size="small"
                onClick={() => {
                  createForm.resetFields();
                  setCreating(false);
                }}
              >
                {t('common:actions.cancel')}
              </Button>
            </Space>
          </Form>
        ) : (
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => setCreating(true)}
            data-testid="floor-plan-new-cabinet"
          >
            {t('room:floorPlan.newCabinet')}
          </Button>
        )}
      </div>

      <Text type="secondary" style={{ display: 'block', marginTop: 16, fontSize: 12 }}>
        {t('room:floorPlan.selectHint')}
      </Text>
    </>
  );

  // 侧栏：选中机柜
  const renderCabinetInspector = (cabinet: FloorPlanData['cabinets'][0]) => {
    const pos = cabinetPositions[cabinet.id];
    const size = itemSizes[cabinet.id] || DEFAULT_CABINET_SIZE;

    return (
      <>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>
          {cabinet.name}
        </Text>
        {cabinet.shortId
          ? metaRow(t('room:floorPlan.shortId'), <Text code>{formatShortId(cabinet.shortId)}</Text>)
          : null}
        {metaRow(t('room:floorPlan.position'), pos ? `${pos.x}, ${pos.y} ${unit}` : '-')}
        {metaRow(t('room:floorPlan.size'), `${size.width} × ${size.depth} ${unit}`)}
        {metaRow(t('room:floorPlan.deviceCount'), cabinet.deviceCount)}

        <Text type="secondary" style={{ display: 'block', margin: '12px 0 6px', fontSize: 12 }}>
          {t('room:floorPlan.devices')}
        </Text>
        {previewLoading ? (
          <Spin size="small" />
        ) : previewDevices.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {t('room:floorPlan.noDevices')}
          </Text>
        ) : (
          <>
            {previewDevices.slice(0, PREVIEW_DEVICE_LIMIT).map((device) => (
              <div
                key={device.id}
                style={{ display: 'flex', gap: 8, fontSize: 12, padding: '2px 0' }}
              >
                <Text type="secondary" style={{ fontSize: 12, width: 34, flexShrink: 0 }}>
                  {device.uPosition ? `U${device.uPosition}` : '-'}
                </Text>
                <span style={{ minWidth: 0, wordBreak: 'break-all' }}>{device.name}</span>
              </div>
            ))}
            {previewDevices.length > PREVIEW_DEVICE_LIMIT && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('room:floorPlan.moreDevices', {
                  count: previewDevices.length - PREVIEW_DEVICE_LIMIT,
                })}
              </Text>
            )}
          </>
        )}

        {onCabinetClick && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, marginTop: 12 }}
            icon={<ArrowRightOutlined />}
            onClick={() => onCabinetClick(cabinet.id)}
          >
            {t('room:floorPlan.viewDetail')}
          </Button>
        )}
      </>
    );
  };

  // 侧栏：选中工作站
  const renderWorkstationInspector = (ws: FloorPlanData['workstations'][0]) => {
    const pos = workstationPositions[ws.id];
    const size = itemSizes[ws.id] || DEFAULT_WORKSTATION_SIZE;

    return (
      <>
        <Text strong style={{ display: 'block', marginBottom: 12 }}>
          {ws.name}
        </Text>
        {ws.code ? metaRow(t('room:floorPlan.shortId'), <Text code>{ws.code}</Text>) : null}
        {metaRow(
          t('room:floorPlan.status'),
          <Tag color={WORKSTATION_STATUS_COLORS[ws.status]} style={{ marginInlineEnd: 0 }}>
            {t(`room:floorPlan.workstationStatus.${ws.status}`)}
          </Tag>
        )}
        {ws.assignedTo ? metaRow(t('room:floorPlan.assignedTo'), ws.assignedTo) : null}
        {metaRow(t('room:floorPlan.position'), pos ? `${pos.x}, ${pos.y} ${unit}` : '-')}
        {metaRow(t('room:floorPlan.size'), `${size.width} × ${size.depth} ${unit}`)}

        {previewLoading ? (
          <Spin size="small" />
        ) : (
          previewWorkstation && (
            <>
              {previewWorkstation.ipAddress
                ? metaRow(t('room:floorPlan.ipAddress'), previewWorkstation.ipAddress)
                : null}
              {previewWorkstation.cpu ? metaRow('CPU', previewWorkstation.cpu) : null}
              {previewWorkstation.memory ? metaRow('RAM', previewWorkstation.memory) : null}
              {previewWorkstation.gpu ? metaRow('GPU', previewWorkstation.gpu) : null}
              {previewWorkstation.os ? metaRow('OS', previewWorkstation.os) : null}
            </>
          )
        )}

        {onWorkstationClick && (
          <Button
            type="link"
            size="small"
            style={{ padding: 0, marginTop: 12 }}
            icon={<ArrowRightOutlined />}
            onClick={() => onWorkstationClick(ws.id)}
          >
            {t('room:floorPlan.viewDetail')}
          </Button>
        )}
      </>
    );
  };

  return (
    <div data-testid="floor-plan-editor">
      {/* 工具栏：标题、图例、尺寸、缩放和编辑操作合并成一行 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 8,
        }}
      >
        <Space size={16} wrap>
          <Title level={5} style={{ margin: 0 }}>
            {data.room.name} · {t('room:floorPlan.title')}
          </Title>
          {isEditing ? (
            <Space size={4}>
              <Text type="secondary">{t('room:floorPlan.width')}</Text>
              <InputNumber
                size="small"
                min={MIN_ROOM_SIZE}
                max={MAX_ROOM_SIZE}
                value={roomSize.width}
                onChange={(value) =>
                  setRoomSize((prev) => ({ ...prev, width: value || DEFAULT_ROOM_WIDTH }))
                }
                style={{ width: 72 }}
                data-testid="floor-plan-width"
              />
              <Text type="secondary">{t('room:floorPlan.height')}</Text>
              <InputNumber
                size="small"
                min={MIN_ROOM_SIZE}
                max={MAX_ROOM_SIZE}
                value={roomSize.height}
                onChange={(value) =>
                  setRoomSize((prev) => ({ ...prev, height: value || DEFAULT_ROOM_HEIGHT }))
                }
                style={{ width: 72 }}
                data-testid="floor-plan-height"
              />
              <Text type="secondary">{unit}</Text>
            </Space>
          ) : (
            <Text type="secondary">
              {roomSize.width} &times; {roomSize.height} {unit}
            </Text>
          )}
          <Space size={6}>
            {legendSwatch(CABINET_COLOR)}
            <Text type="secondary">
              {t('room:floorPlan.cabinet')} {data.cabinets.length}
            </Text>
          </Space>
          <Space size={6}>
            {legendSwatch(WORKSTATION_COLOR)}
            <Text type="secondary">
              {t('room:floorPlan.workstation')} {data.workstations.length}
            </Text>
          </Space>
        </Space>

        <Space size={4}>
          <Button
            type="text"
            icon={<ZoomOutOutlined />}
            onClick={() => setZoom(Math.max(MIN_ZOOM, zoom - ZOOM_STEP))}
            disabled={zoom <= MIN_ZOOM}
            data-testid="floor-plan-zoom-out"
          />
          <Text type="secondary" style={{ minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Text>
          <Button
            type="text"
            icon={<ZoomInOutlined />}
            onClick={() => setZoom(Math.min(MAX_ZOOM, zoom + ZOOM_STEP))}
            disabled={zoom >= MAX_ZOOM}
            data-testid="floor-plan-zoom-in"
          />
          {isEditing ? (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={handleSave}
                data-testid="floor-plan-save"
              >
                {t('common:actions.save')}
              </Button>
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={handleCancel}
                data-testid="floor-plan-cancel"
              >
                {t('common:actions.cancel')}
              </Button>
            </>
          ) : (
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
              data-testid="floor-plan-edit"
            >
              {t('common:actions.edit')}
            </Button>
          )}
        </Space>
      </div>

      {isEditing && (
        <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
          {t('room:floorPlan.editHint')}
        </Text>
      )}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16 }}>
        {/* SVG 画布：机房轮廓本身就是唯一的边框 */}
        {/* 画布自己滚动，放大后不把弹窗撑高 */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'auto',
            maxHeight: 'calc(100vh - 220px)',
            textAlign: 'center',
          }}
        >
          <svg
            ref={svgRef}
            width={svgWidth}
            height={svgHeight}
            data-testid="floor-plan-canvas"
            onMouseMove={handleDrag}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
          >
            <g transform="translate(1, 1)">
              {/* 机房轮廓 */}
              <rect
                x={0}
                y={0}
                width={toPixels(roomSize.width)}
                height={toPixels(roomSize.height)}
                fill="#fafafa"
                stroke="#bfbfbf"
                strokeWidth={1.5}
              />

              {/* 网格 */}
              {renderGrid()}

              {/* 机柜 */}
              {data.cabinets.map(renderCabinet)}

              {/* 工作站 */}
              {data.workstations.map(renderWorkstation)}
            </g>
          </svg>
        </div>

        {/* 右侧工具栏：概览 / 新建机柜 / 选中对象的元数据和预览 */}
        <aside
          style={{
            width: 260,
            flex: '0 0 260px',
            borderLeft: '1px solid #f0f0f0',
            paddingLeft: 16,
          }}
          data-testid="floor-plan-inspector"
        >
          {selectedCabinet
            ? renderCabinetInspector(selectedCabinet)
            : selectedWorkstation
              ? renderWorkstationInspector(selectedWorkstation)
              : renderOverview()}
        </aside>
      </div>
    </div>
  );
};

export default FloorPlanEditor;
