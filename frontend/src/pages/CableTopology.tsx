import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Card, Descriptions, Divider, Empty, Form, Input, InputNumber, Modal, Select, Space, Spin, Tag, Tooltip, Typography, message } from 'antd';
import { EditOutlined, FullscreenOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, ScanOutlined, ZoomInOutlined, ZoomOutOutlined } from '@ant-design/icons';
import ReactFlow, { Background, ConnectionMode, Controls, Handle, MiniMap, Position, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from 'reactflow';
import 'reactflow/dist/style.css';
import type { CableDto, EndpointDto, PanelConnection } from '@contracts/cables';
import { CABLE_MEDIA, type CableMedium } from '@contracts/enums';
import type { PanelDetailDto, PanelDto } from '@contracts/panels';
import { formatShortId } from '@contracts/shortId';
import { cableService } from '@/services/cableService';
import { labelService } from '@/services/labelService';
import { panelService } from '@/services/panelService';
import CreateCableModal from '@/components/CreateCableModal';
import { PanelView } from '@/components/panel/PanelView';
import { parseLabelInput } from '@/utils/labels';
import { paths } from '@/routes';

const { Title, Text } = Typography;

const MEDIUM_COLORS: Record<CableMedium, string> = {
  CAT5E: '#2db7f5',
  CAT6: '#108ee9',
  CAT6A: '#0050b3',
  CAT7: '#003a8c',
  FIBER_SM: '#f50',
  FIBER_MM: '#fa541c',
  DAC: '#722ed1',
  AOC: '#9254de',
  POWER: '#faad14',
  OTHER: '#8c8c8c',
};

interface PanelNodeData {
  panelId: string;
  panelName: string;
  deviceName: string;
  location: string;
  label: string | null;
  ports: string[];
  parked: number;
  root: boolean;
  highlighted: boolean;
}

interface CableEdgeData {
  connection: PanelConnection;
}

function PanelNode({ data }: NodeProps<PanelNodeData>) {
  const { t } = useTranslation('cable');
  const color = data.root ? '#1890ff' : '#8c8c8c';
  return (
    <div
      data-testid={`topology-node-${data.panelId}`}
      style={{
        padding: '10px 14px',
        borderRadius: 8,
        border: `2px solid ${data.highlighted ? '#1890ff' : color}`,
        background: data.highlighted ? '#e6f7ff' : '#fff',
        minWidth: 220,
        boxShadow: data.root ? '0 4px 16px rgba(24,144,255,0.3)' : '0 2px 8px rgba(0,0,0,0.15)',
        cursor: 'pointer',
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <Space size={4} wrap>
        {data.root && <Tag color="blue">{t('topology.root')}</Tag>}
        {data.label && <Text code>{data.label}</Text>}
        {data.parked > 0 && <Tag color="warning">{t('topology.parked', { count: data.parked })}</Tag>}
      </Space>
      <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{data.deviceName}</div>
      <div style={{ fontSize: 12, color: '#595959' }}>{data.panelName}</div>
      {data.location && <div style={{ fontSize: 11, color: '#722ed1' }}>{data.location}</div>}
      {data.ports.length > 0 && <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>{data.ports.join(', ')}</div>}
    </div>
  );
}

const nodeTypes = { panel: PanelNode };

const endLocation = (ep: EndpointDto) => [ep.room?.name, ep.cabinet?.name].filter(Boolean).join(' / ');

/** Lay the peers out on a circle around the root panel. */
function circleLayout(ids: string[], rootId: string) {
  const others = ids.filter((id) => id !== rootId);
  const pos = new Map<string, { x: number; y: number }>([[rootId, { x: 0, y: 0 }]]);
  const radius = Math.max(520, others.length * 60);
  others.forEach((id, i) => {
    const angle = (2 * Math.PI * i) / Math.max(1, others.length);
    pos.set(id, { x: radius * Math.cos(angle), y: radius * Math.sin(angle) });
  });
  return pos;
}

function CableEdgeModal({ connection, onClose, onSaved }: { connection: PanelConnection | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation(['cable', 'common']);
  const navigate = useNavigate();
  const [cable, setCable] = useState<CableDto | null>(null);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm<{ label?: string; medium: CableMedium; lengthM?: number | null; color?: string; notes?: string }>();

  useEffect(() => {
    setEditing(false);
    setCable(null);
    if (!connection) return;
    cableService.get({ id: connection.cable.id }).then(
      (c) => {
        setCable(c);
        form.setFieldsValue({ label: c.label ?? '', medium: c.medium, lengthM: c.lengthM, color: c.color ?? '', notes: c.notes ?? '' });
      },
      () => undefined,
    );
  }, [connection, form]);

  const save = async () => {
    if (!cable) return;
    const v = await form.validateFields();
    try {
      await cableService.update({ id: cable.id, ...v });
      message.success(t('cable:messages.updateSuccess'));
      onSaved();
      onClose();
    } catch {
      // reported by rpc
    }
  };

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          {t('cable:cableDetail.title')}
          {cable && !editing && (
            <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              {t('cable:buttons.edit')}
            </Button>
          )}
        </Space>
      }
      open={!!connection}
      onCancel={onClose}
      width={760}
      forceRender
      footer={
        editing
          ? [
              <Button key="cancel" onClick={() => setEditing(false)}>
                {t('common:actions.cancel')}
              </Button>,
              <Button key="save" type="primary" onClick={save}>
                {t('common:actions.save')}
              </Button>,
            ]
          : [
              cable && (
                <Button key="open" onClick={() => navigate(paths.cable(cable.id))}>
                  {t('cable:topology.openDetail')}
                </Button>
              ),
              <Button key="close" type="primary" onClick={onClose}>
                {t('common:actions.confirm')}
              </Button>,
            ]
      }
    >
      {cable ? (
        <Space direction="vertical" style={{ width: '100%' }}>
          {[...cable.endpoints]
            .sort((a, b) => a.end.localeCompare(b.end))
            .map((ep) => (
              <Descriptions key={ep.id} size="small" bordered column={2} title={t(`cable:ends.${ep.end}`)}>
                <Descriptions.Item label={t('cable:detail.plug')}>{ep.label ? <Text code>{formatShortId(ep.label.shortId)}</Text> : '-'}</Descriptions.Item>
                <Descriptions.Item label={t('cable:detail.port')}>{ep.port?.number ?? t('cable:detail.notPlugged')}</Descriptions.Item>
                <Descriptions.Item label={t('cable:fields.device')}>{ep.device?.name ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('cable:fields.panel')}>{ep.panel?.name ?? '-'}</Descriptions.Item>
                <Descriptions.Item label={t('cable:fields.location')} span={2}>
                  {endLocation(ep) || '-'}
                </Descriptions.Item>
              </Descriptions>
            ))}
          <Divider style={{ margin: '8px 0' }} />
          {editing ? (
            <Form name="cable-topology-form" form={form} layout="vertical">
              <Form.Item name="label" label={t('cable:fields.label')}>
                <Input />
              </Form.Item>
              <Form.Item name="medium" label={t('cable:fields.type')}>
                <Select options={CABLE_MEDIA.map((m) => ({ value: m, label: t(`cable:media.${m}`) }))} />
              </Form.Item>
              <Space>
                <Form.Item name="lengthM" label={t('cable:labels.cableLength')}>
                  <InputNumber min={0.1} step={0.1} />
                </Form.Item>
                <Form.Item name="color" label={t('cable:fields.color')}>
                  <Input />
                </Form.Item>
              </Space>
              <Form.Item name="notes" label={t('cable:fields.notes')}>
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          ) : (
            <Descriptions size="small" column={2}>
              <Descriptions.Item label={t('cable:fields.label')}>{cable.label || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.type')}>
                <Tag color={MEDIUM_COLORS[cable.medium]}>{t(`cable:media.${cable.medium}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.length')}>{cable.lengthM ? `${cable.lengthM} m` : '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.color')}>{cable.color || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.notes')} span={2}>
                {cable.notes || '-'}
              </Descriptions.Item>
            </Descriptions>
          )}
        </Space>
      ) : (
        <Spin />
      )}
    </Modal>
  );
}

/**
 * /topology/panel/:id: the cables of one panel, each to the panel on its other end.
 * Data comes from cables/panel-connections (one request); the depth of the old graph view is gone
 * because a connection is always one hop. Double-click a peer to centre on it.
 */
function CableTopologyContent() {
  const { t } = useTranslation(['cable', 'common', 'device']);
  const { id: panelId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [panels, setPanels] = useState<PanelDto[]>([]);
  const [deviceId, setDeviceId] = useState<string>();
  const [root, setRoot] = useState<PanelDetailDto | null>(null);
  const [connections, setConnections] = useState<PanelConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [highlightCableId, setHighlightCableId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [edgeConnection, setEdgeConnection] = useState<PanelConnection | null>(null);
  const [inspect, setInspect] = useState<PanelDetailDto | null>(null);

  useEffect(() => {
    panelService.list().then(setPanels, () => undefined);
  }, []);

  const load = useCallback(async () => {
    if (!panelId) {
      setRoot(null);
      setConnections([]);
      return;
    }
    setLoading(true);
    try {
      const [p, conns] = await Promise.all([panelService.get({ id: panelId }), cableService.panelConnections({ panelId })]);
      setRoot(p);
      setDeviceId(p.deviceId);
      setConnections(conns);
      setTimeout(() => fitView({ padding: 0.2, duration: 600, maxZoom: 1 }), 50);
    } catch {
      setRoot(null);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [panelId, fitView]);

  useEffect(() => {
    load();
  }, [load]);

  const devices = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const p of panels) m.set(p.deviceId, { id: p.deviceId, name: p.deviceName });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [panels]);

  const { nodes, edges } = useMemo(() => {
    if (!root) return { nodes: [] as Node<PanelNodeData>[], edges: [] as Edge<CableEdgeData>[] };
    const data = new Map<string, PanelNodeData>();
    data.set(root.id, {
      panelId: root.id,
      panelName: root.name,
      deviceName: root.deviceName,
      location: root.path
        .filter((n) => n.kind === 'ROOM' || n.kind === 'CABINET')
        .map((n) => n.name)
        .join(' / '),
      label: root.label ? formatShortId(root.label.shortId) : null,
      ports: [],
      parked: root.parkedCount,
      root: true,
      highlighted: false,
    });
    const edgeList: Edge<CableEdgeData>[] = [];
    for (const c of connections) {
      data.get(root.id)!.ports.push(c.portNumber);
      const peer = c.peer;
      if (!peer?.panel || c.loopback) continue;
      const highlighted = c.cable.id === highlightCableId;
      const existing = data.get(peer.panel.id);
      const portText = peer.port?.number ?? t('cable:detail.parked');
      if (existing) {
        existing.ports.push(portText);
        existing.highlighted ||= highlighted;
      } else {
        data.set(peer.panel.id, {
          panelId: peer.panel.id,
          panelName: peer.panel.name,
          deviceName: peer.device?.name ?? '-',
          location: endLocation(peer),
          label: null,
          ports: [portText],
          parked: 0,
          root: false,
          highlighted,
        });
      }
      edgeList.push({
        id: `${c.cable.id}-${c.local.id}`,
        source: root.id,
        target: peer.panel.id,
        label: `${c.portNumber} - ${portText}`,
        animated: highlighted,
        style: { stroke: MEDIUM_COLORS[c.cable.medium], strokeWidth: highlighted ? 4 : 2, opacity: highlightCableId && !highlighted ? 0.3 : 1 },
        data: { connection: c },
      });
    }
    const pos = circleLayout([...data.keys()], root.id);
    const nodeList: Node<PanelNodeData>[] = [...data.values()].map((d) => ({ id: d.panelId, type: 'panel', position: pos.get(d.panelId)!, data: d }));
    return { nodes: nodeList, edges: edgeList };
  }, [root, connections, highlightCableId, t]);

  const goPanel = (id: string, cableId: string | null = null) => {
    setHighlightCableId(cableId);
    if (id !== panelId) navigate(paths.topologyPanel(id));
  };

  const scan = async (text: string) => {
    let shortId: number | undefined;
    try {
      shortId = parseLabelInput(text);
    } catch {
      message.warning(t('common:label.invalid'));
      return;
    }
    if (shortId === undefined) return;
    setScanInput('');
    try {
      const r = await labelService.resolve({ shortId });
      if (r.bound?.kind === 'PANEL') {
        goPanel(r.bound.id);
        message.success(t('cable:topology.located', { display: r.display }));
        return;
      }
      if (r.bound?.kind === 'CABLE_ENDPOINT') {
        const panelNode = r.bound.path.find((n) => n.kind === 'PANEL');
        const cableNode = r.bound.path.find((n) => n.kind === 'CABLE');
        const plugged = r.bound.path.some((n) => n.kind === 'PORT');
        if (panelNode && plugged) {
          goPanel(panelNode.id, cableNode?.id ?? null);
          message.success(t('cable:topology.located', { display: r.display }));
        } else if (cableNode) {
          message.info(t('cable:topology.endLoose'));
          navigate(paths.cable(cableNode.id));
        }
        return;
      }
      message.warning(t('cable:topology.notLocated'));
    } catch {
      // reported by rpc
    }
  };

  const openInspect = async (id: string) => {
    try {
      setInspect(await panelService.get({ id }));
    } catch {
      // reported by rpc
    }
  };

  const connectedPortIds = useMemo(() => new Set(connections.map((c) => c.portId)), [connections]);
  const devicePanels = panels.filter((p) => p.deviceId === deviceId);

  return (
    <div>
      <Title level={2}>{t('cable:topology.title')}</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            prefix={<ScanOutlined />}
            placeholder={t('cable:topology.scanPlaceholder')}
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onPressEnter={() => scan(scanInput)}
            style={{ width: 300 }}
            size="large"
            allowClear
            data-testid="topology-scan-input"
          />
          <Divider type="vertical" style={{ height: 32 }} />
          <Text strong>{t('cable:topology.selectDevice')}:</Text>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 260 }}
            placeholder={t('cable:labels.selectDevice')}
            value={deviceId}
            onChange={setDeviceId}
            options={devices.map((d) => ({ value: d.id, label: d.name }))}
            data-testid="topology-device-select"
          />
          <Text strong>{t('cable:topology.selectPanel')}:</Text>
          <Select
            showSearch
            optionFilterProp="label"
            style={{ width: 240 }}
            placeholder={t('cable:labels.selectPanel')}
            value={devicePanels.some((p) => p.id === panelId) ? panelId : undefined}
            onChange={(id: string) => goPanel(id)}
            disabled={!deviceId}
            options={devicePanels.map((p) => ({ value: p.id, label: p.name }))}
            data-testid="topology-panel-select"
          />
          <Divider type="vertical" />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)} data-testid="topology-create-cable-btn">
            {t('cable:buttons.createConnection')}
          </Button>
          <Tooltip title={t('cable:buttons.refresh')}>
            <Button icon={<ReloadOutlined />} onClick={load} />
          </Tooltip>
          <Tooltip title={t('cable:buttons.fitView')}>
            <Button icon={<FullscreenOutlined />} onClick={() => fitView({ padding: 0.2, duration: 600, maxZoom: 1 })} />
          </Tooltip>
          <Tooltip title={t('cable:buttons.zoomIn')}>
            <Button icon={<ZoomInOutlined />} onClick={() => zoomIn({ duration: 200 })} />
          </Tooltip>
          <Tooltip title={t('cable:buttons.zoomOut')}>
            <Button icon={<ZoomOutOutlined />} onClick={() => zoomOut({ duration: 200 })} />
          </Tooltip>
        </Space>
        {root && (
          <div style={{ marginTop: 8 }}>
            <Text type="secondary">
              {connections.length ? t('cable:topology.loaded', { count: connections.length }) : t('cable:topology.noConnections')} · {t('cable:topology.hint')}
            </Text>
          </div>
        )}
      </Card>

      <Card>
        <div style={{ height: '70vh', position: 'relative' }}>
          {loading && (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
              <Spin size="large" />
            </div>
          )}
          {!panelId && !loading ? (
            <Empty style={{ paddingTop: 120 }} description={t('cable:topology.choosePanel')} />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              onNodeClick={(_, node) => openInspect(node.id)}
              onNodeDoubleClick={(_, node) => goPanel(node.id)}
              onEdgeClick={(_, edge: Edge<CableEdgeData>) => edge.data && setEdgeConnection(edge.data.connection)}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              minZoom={0.1}
              maxZoom={4}
            >
              <Background />
              <Controls />
              <MiniMap pannable zoomable />
            </ReactFlow>
          )}
        </div>
      </Card>

      <CreateCableModal open={createOpen} onClose={() => setCreateOpen(false)} onSuccess={load} initialPanelId={panelId} />
      <CableEdgeModal connection={edgeConnection} onClose={() => setEdgeConnection(null)} onSaved={load} />

      <Modal
        title={inspect ? `${inspect.deviceName} / ${inspect.name}` : ''}
        open={!!inspect}
        onCancel={() => setInspect(null)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
      >
        {inspect && (
          <>
            <Text type="secondary">{t('cable:topology.panelPorts')}</Text>
            <PanelView
              panel={inspect}
              ports={inspect.ports}
              highlightedPortIds={inspect.id === panelId ? inspect.ports.filter((p) => connectedPortIds.has(p.id)).map((p) => p.id) : []}
              onPortClick={(p) => navigate(paths.port(p.id))}
              scale={1.7}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

export default function CableTopology() {
  return (
    <ReactFlowProvider>
      <CableTopologyContent />
    </ReactFlowProvider>
  );
}
