import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Modal, Row, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { ApiOutlined, CheckCircleOutlined, LinkOutlined, ScanOutlined, SwapOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { CABLE_MEDIA, type CableMedium } from '@contracts/enums';
import type { LabelResolveResult } from '@contracts/labels';
import type { PanelDetailDto, PanelDto, PortDto } from '@contracts/panels';
import { formatShortId } from '@contracts/shortId';
import { cableService } from '@/services/cableService';
import { labelService } from '@/services/labelService';
import { panelService } from '@/services/panelService';
import { PanelView } from './panel/PanelView';
import { parseLabelInput } from '@/utils/labels';

const { Title, Text } = Typography;

interface CableFields {
  label?: string;
  medium?: CableMedium;
  lengthM?: number | null;
  color?: string;
  notes?: string;
}

interface CreateCableModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** start the quick mode on this panel */
  initialPanelId?: string;
}

const tryParse = (text: string) => {
  try {
    return parseLabelInput(text);
  } catch {
    return undefined;
  }
};

const isFree = (p: PortDto) => !p.connected && p.adminState === 'NORMAL';

/**
 * Quick mode: one end at a time (scan panel, optionally pick a port, scan the plug).
 * A plug that already belongs to a cable is plugged in with connect-end; a new plug creates a cable.
 * Dual mode: both ends at once with cables/create.
 */
export default function CreateCableModal({ open, onClose, onSuccess, initialPanelId }: CreateCableModalProps) {
  const { t } = useTranslation(['cable', 'common']);
  const [form] = Form.useForm<CableFields>();
  const [tab, setTab] = useState('single');
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [panels, setPanels] = useState<PanelDto[]>([]);

  // quick mode
  const [panelInput, setPanelInput] = useState('');
  const [panel, setPanel] = useState<PanelDetailDto | null>(null);
  const [portId, setPortId] = useState<string | null>(null);
  const [plugInput, setPlugInput] = useState('');
  const [plug, setPlug] = useState<LabelResolveResult | null>(null);

  // dual mode
  const [panelA, setPanelA] = useState<string>();
  const [panelB, setPanelB] = useState<string>();
  const [portA, setPortA] = useState<string>();
  const [portB, setPortB] = useState<string>();
  const [labelA, setLabelA] = useState('');
  const [labelB, setLabelB] = useState('');
  const [portsById, setPortsById] = useState<Record<string, PortDto[]>>({});

  const choosePanel = async (id: string | undefined) => {
    setPortId(null);
    if (!id) {
      setPanel(null);
      return;
    }
    try {
      setPanel(await panelService.get({ id }));
    } catch {
      setPanel(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    setTab('single');
    setShowDetails(false);
    setPanelInput('');
    setPanel(null);
    setPortId(null);
    setPlugInput('');
    setPlug(null);
    setPanelA(undefined);
    setPanelB(undefined);
    setPortA(undefined);
    setPortB(undefined);
    setLabelA('');
    setLabelB('');
    setPortsById({});
    panelService.list().then(setPanels, () => undefined);
    if (initialPanelId) choosePanel(initialPanelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);

  const panelOptions = useMemo(
    () =>
      panels.map((p) => {
        const label = `${p.deviceName} / ${p.name}${p.label ? ` (${formatShortId(p.label.shortId)})` : ''}`;
        return { value: p.id, label, title: label };
      }),
    [panels],
  );

  const portsOf = async (id: string) => {
    if (portsById[id]) return;
    try {
      const ports = await panelService.get({ id }).then((p) => p.ports);
      setPortsById((m) => ({ ...m, [id]: ports }));
    } catch {
      // reported by rpc
    }
  };

  const scanPanel = async (text: string) => {
    const shortId = tryParse(text);
    if (shortId === undefined) return;
    try {
      const r = await labelService.resolve({ shortId });
      if (r.bound?.kind !== 'PANEL') {
        message.warning(t('cable:create.notPanel'));
        return;
      }
      await choosePanel(r.bound.id);
    } catch {
      // reported by rpc
    }
  };

  const scanPlug = async (text: string) => {
    const shortId = tryParse(text);
    if (shortId === undefined) {
      setPlug(null);
      return;
    }
    try {
      const r = await labelService.resolve({ shortId });
      if (r.state === 'VOID' || (r.bound && r.bound.kind !== 'CABLE_ENDPOINT')) {
        message.error(r.state === 'VOID' ? t('common:label.void') : t('common:label.bound', { name: r.bound!.path.map((n) => n.name).join(' / ') }));
        setPlug(null);
        return;
      }
      setPlug(r);
    } catch {
      setPlug(null);
    }
  };

  const cableFields = () => {
    const v = form.getFieldsValue();
    return { label: v.label, medium: v.medium ?? 'CAT6', lengthM: v.lengthM ?? null, color: v.color, notes: v.notes };
  };

  const submitSingle = async () => {
    if (!panel || !plug) return;
    setLoading(true);
    try {
      if (plug.bound?.kind === 'CABLE_ENDPOINT') {
        if (portId) {
          await cableService.connectEnd({ endpointId: plug.bound.id, portId });
          message.success(t('cable:create.connected'));
        } else {
          await cableService.disconnectEnd({ endpointId: plug.bound.id, parkPanelId: panel.id });
          message.success(t('cable:create.parked'));
        }
      } else {
        const here = portId ? { portId } : { parkedPanelId: panel.id };
        await cableService.create({ ...cableFields(), ends: { A: { labelShortId: plug.shortId, ...here }, B: {} } });
        message.success(t('cable:create.created'));
      }
      onSuccess?.();
      onClose();
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  };

  const submitDual = async () => {
    if (!portA || !portB) return;
    setLoading(true);
    try {
      await cableService.create({
        ...cableFields(),
        ends: { A: { portId: portA, labelShortId: tryParse(labelA) }, B: { portId: portB, labelShortId: tryParse(labelB) } },
      });
      message.success(t('cable:create.created'));
      onSuccess?.();
      onClose();
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  };

  const detailFields = (
    <>
      <Form.Item label={t('cable:fields.label')} name="label">
        <Input placeholder={t('cable:create.labelPlaceholder')} data-testid="cable-label-input" />
      </Form.Item>
      <Form.Item label={t('cable:fields.type')} name="medium">
        <Select
          placeholder={t('cable:create.mediumPlaceholder')}
          allowClear
          data-testid="cable-type-select"
          options={CABLE_MEDIA.map((m) => ({ value: m, label: t(`cable:media.${m}`) }))}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item label={t('cable:labels.cableLength')} name="lengthM">
            <InputNumber min={0.1} step={0.1} placeholder={t('cable:create.lengthPlaceholder')} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label={t('cable:fields.color')} name="color">
            <Input placeholder={t('cable:create.colorPlaceholder')} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item label={t('cable:fields.notes')} name="notes">
        <Input.TextArea rows={2} placeholder={t('cable:create.notesPlaceholder')} />
      </Form.Item>
    </>
  );

  const selectedPort = panel?.ports.find((p) => p.id === portId);

  const singleMode = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="cable-single-mode">
      <Alert message={t('cable:create.singleTitle')} description={t('cable:create.singleDesc')} type="info" showIcon icon={<ThunderboltOutlined />} />
      <Row gutter={16}>
        <Col span={9}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Card size="small" title={t('cable:create.step1')}>
              <Text type="secondary">{t('cable:create.panelLabel')}</Text>
              <Input
                prefix={<ScanOutlined />}
                placeholder={t('cable:create.scanPlaceholder')}
                value={panelInput}
                onChange={(e) => setPanelInput(e.target.value)}
                onPressEnter={() => scanPanel(panelInput)}
                onBlur={() => scanPanel(panelInput)}
                size="large"
                allowClear
                data-testid="cable-single-panel-scan-input"
              />
              <Divider style={{ margin: '12px 0' }}>{t('cable:create.or')}</Divider>
              <Select
                placeholder={t('cable:create.selectPanel')}
                value={panel?.id}
                onChange={(id?: string) => choosePanel(id)}
                showSearch
                optionFilterProp="label"
                style={{ width: '100%' }}
                allowClear
                data-testid="cable-single-panel-select"
                options={panelOptions}
              />
              {panel && (
                <Tag color="blue" style={{ marginTop: 8 }}>
                  {panel.deviceName} / {panel.name}
                  {panel.label ? ` (${formatShortId(panel.label.shortId)})` : ''}
                </Tag>
              )}
            </Card>
            {panel && (
              <Card size="small" title={t('cable:create.step3')}>
                <Text type="secondary">{t('cable:create.plugLabel')}</Text>
                <Input
                  prefix={<ScanOutlined />}
                  placeholder={t('cable:create.scanPlaceholder')}
                  value={plugInput}
                  onChange={(e) => setPlugInput(e.target.value)}
                  onPressEnter={() => scanPlug(plugInput)}
                  onBlur={() => scanPlug(plugInput)}
                  size="large"
                  allowClear
                  data-testid="cable-single-shortid-input"
                />
                {plug && (
                  <Space direction="vertical" style={{ marginTop: 8 }}>
                    <Tag color="green">{t('cable:create.plugRecorded', { display: plug.display })}</Tag>
                    <Text type="secondary">{plug.bound ? t('cable:create.plugExisting') : t('cable:create.plugNew')}</Text>
                  </Space>
                )}
              </Card>
            )}
          </Space>
        </Col>
        <Col span={15}>
          <Card size="small" title={t('cable:create.step2')} style={{ height: '100%' }}>
            {panel ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary">{t('cable:create.portHint')}</Text>
                  {selectedPort && (
                    <Tag color="green" style={{ marginLeft: 8 }}>
                      {t('cable:create.selectedPort', { number: selectedPort.number })}
                    </Tag>
                  )}
                </div>
                <PanelView
                  panel={panel}
                  ports={panel.ports}
                  highlightedPortIds={portId ? [portId] : []}
                  labelMode="always"
                  scale={1.4}
                  onPortClick={(p) => {
                    if (!isFree(p)) {
                      message.warning(t('cable:create.portBusy', { number: p.number }));
                      return;
                    }
                    setPortId(p.id === portId ? null : p.id);
                  }}
                />
              </>
            ) : (
              <Text type="secondary">{t('cable:create.choosePanelFirst')}</Text>
            )}
          </Card>
        </Col>
      </Row>
      {panel && plug && !plug.bound && (
        <>
          <Divider style={{ margin: '4px 0' }}>
            <Button type="link" size="small" onClick={() => setShowDetails(!showDetails)}>
              {t('cable:create.showDetails')}
            </Button>
          </Divider>
          {showDetails && <Card size="small">{detailFields}</Card>}
        </>
      )}
    </div>
  );

  const endCard = (end: 'A' | 'B') => {
    const panelId = end === 'A' ? panelA : panelB;
    const setPanelId = end === 'A' ? setPanelA : setPanelB;
    const port = end === 'A' ? portA : portB;
    const setPort = end === 'A' ? setPortA : setPortB;
    const label = end === 'A' ? labelA : labelB;
    const setLabel = end === 'A' ? setLabelA : setLabelB;
    const other = end === 'A' ? portB : portA;
    const ports = (panelId && portsById[panelId]) || [];
    const key = end.toLowerCase();
    return (
      <Card size="small" title={t(`cable:create.end${end}`)} style={{ marginBottom: 16 }}>
        <Form.Item label={t('cable:create.selectPanel')} required>
          <Select
            placeholder={t('cable:create.selectPanel')}
            value={panelId}
            onChange={(id: string) => {
              setPanelId(id);
              setPort(undefined);
              portsOf(id);
            }}
            showSearch
            optionFilterProp="label"
            data-testid={`cable-panel-${key}-select`}
            options={panelOptions.map((o) => ({ ...o, label: <span data-testid={`cable-panel-option-${o.value}`}>{o.label}</span> }))}
            filterOption={(input, option) => String(option?.title ?? '').toLowerCase().includes(input.toLowerCase())}
          />
        </Form.Item>
        <Form.Item label={t('cable:create.selectPort')} required>
          <Select
            placeholder={t('cable:create.selectPort')}
            value={port}
            onChange={setPort}
            disabled={!panelId}
            data-testid={`cable-port-${key}-select`}
            options={ports
              .filter((p) => isFree(p) && p.id !== other)
              .map((p) => {
                const text = `${p.number}${p.label ? ` (${p.label})` : ''}`;
                return { value: p.id, label: <span data-testid={`cable-port-option-${p.id}`}>{text}</span> };
              })}
          />
        </Form.Item>
        <Form.Item label={t('cable:create.plugLabel')} extra={t('cable:create.optionalAuto')}>
          <Input prefix={<ScanOutlined />} placeholder={t('cable:create.scanPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} data-testid={`cable-shortid-${key}-input`} />
        </Form.Item>
      </Card>
    );
  };

  const dualMode = (
    <Space direction="vertical" style={{ width: '100%' }} size="large" data-testid="cable-dual-mode">
      <Alert message={t('cable:create.dualTitle')} description={t('cable:create.dualDesc')} type="info" showIcon icon={<SwapOutlined />} />
      <Row gutter={16}>
        <Col span={12}>{endCard('A')}</Col>
        <Col span={12}>{endCard('B')}</Col>
      </Row>
      <Card size="small" title={t('cable:create.cableInfo')}>
        {detailFields}
      </Card>
    </Space>
  );

  const canSubmit = tab === 'single' ? !!panel && !!plug : !!portA && !!portB;

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined style={{ fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>
            {t('cable:create.title')}
          </Title>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={1200}
      forceRender
      wrapProps={{ 'data-testid': 'create-cable-modal' }}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('common:actions.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          icon={<CheckCircleOutlined />}
          loading={loading}
          disabled={!canSubmit}
          onClick={tab === 'single' ? submitSingle : submitDual}
          data-testid="cable-submit-btn"
        >
          {t('cable:create.submit')}
        </Button>,
      ]}
    >
      <Form name="create-cable-modal-form" form={form} layout="vertical" component={false}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'single',
              label: (
                <span data-testid="cable-tab-single">
                  <ThunderboltOutlined /> {t('cable:create.tabSingle')}
                </span>
              ),
              children: singleMode,
            },
            {
              key: 'dual',
              label: (
                <span data-testid="cable-tab-dual">
                  <ApiOutlined /> {t('cable:create.tabDual')}
                </span>
              ),
              children: dualMode,
            },
          ]}
        />
      </Form>
    </Modal>
  );
}
