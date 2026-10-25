import { useEffect, useMemo, useRef, useState } from 'react';
import { effectiveUHeight } from '@contracts/rack';
import { uHeightText } from '@/utils/uHeight';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Col, Descriptions, Divider, Form, Input, InputNumber, Modal, Row, Select, Space, Typography, message } from 'antd';
import type { SelectProps } from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import type { DeviceDto } from '@contracts/devices';
import { PANEL_FACES, PANEL_TYPES, type PanelFace, type PanelType } from '@contracts/enums';
import type { PanelDetailDto, PortDto } from '@contracts/panels';
import type { PanelTemplateDto } from '@contracts/panelTemplates';
import { U_HEIGHT_MM } from '@contracts/scene';
import { formatShortId } from '@contracts/shortId';
import { panelService, portService } from '@/services/panelService';
import { panelTemplateService } from '@/services/panelTemplateService';
import { LabelField } from './LabelField';
import { parseLabelInput, rebindIfChanged } from '@/utils/labels';
import { deleteWithForce } from './confirmForce';
import { ApplyTemplateModal } from './panelTemplate/ApplyTemplateModal';
import PanelCanvasEditor, { type PortDefinition } from './PanelCanvasEditor';
import { DEFAULT_PANEL_MM, layoutPorts } from '@/utils/panelLayoutGenerator';

const { Text } = Typography;

type EditorDevice = Pick<DeviceDto, 'id' | 'name' | 'type' | 'uPosition' | 'uHeight' | 'deviceModel'>;

interface DevicePanelEditorProps {
  open: boolean;
  device: EditorDevice;
  /** edit this panel; omitted: create a new one on the device */
  panelId?: string;
  /** changed: something was written */
  onClose: (changed: boolean) => void;
}

interface FormValues {
  name: string;
  type: PanelType;
  face: PanelFace;
  shortId?: string;
  widthMm: number;
  heightMm: number;
  templateId?: string;
  notes?: string | null;
}

const geometryChanged = (a: PortDto, b: PortDefinition) =>
  a.xMm !== b.xMm || a.yMm !== b.yMm || a.wMm !== b.wMm || a.hMm !== b.hMm || a.rotation !== b.rotation || a.portType !== b.portType || a.number !== b.number;

/** Create or edit one panel of a device: fields, label, template and port layout. */
export function DevicePanelEditor({ open, device, panelId, onClose }: DevicePanelEditorProps) {
  const { t } = useTranslation(['panel', 'common', 'device']);
  const [form] = Form.useForm<FormValues>();
  const [panel, setPanel] = useState<PanelDetailDto | null>(null);
  const [templates, setTemplates] = useState<PanelTemplateDto[]>([]);
  const [draft, setDraft] = useState<PortDefinition[]>([]);
  const [portsTouched, setPortsTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const widthMm = Form.useWatch('widthMm', form) ?? DEFAULT_PANEL_MM.w;
  const heightMm = Form.useWatch('heightMm', form) ?? DEFAULT_PANEL_MM.h;
  const templateId = Form.useWatch('templateId', form);
  const template = useMemo(() => templates.find((x) => x.id === templateId) ?? null, [templates, templateId]);
  const templateOptions = useMemo((): SelectProps['options'] => {
    const option = (x: PanelTemplateDto) => ({ value: x.id, label: `${x.name} (${t('panel:editor.templateInfo', { count: x.portCount, revision: x.revision })})` });
    const modelId = device.deviceModel?.id;
    const forModel = templates.filter((x) => modelId && x.deviceModelId === modelId);
    if (!forModel.length) return templates.map(option);
    return [
      { label: t('panel:editor.templatesForModel'), options: forModel.map(option) },
      { label: t('panel:editor.otherTemplates'), options: templates.filter((x) => !forModel.includes(x)).map(option) },
    ];
  }, [templates, device.deviceModel?.id, t]);
  // unknown height: the hint shows 1U, the U the device sits in
  const deviceHeight = Math.round(effectiveUHeight(device.uHeight) * U_HEIGHT_MM * 100) / 100;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setApplyOpen(false);
    setPortsTouched(false);
    panelTemplateService.list().then(setTemplates, () => undefined);
    form.resetFields();
    if (!panelId) {
      setPanel(null);
      setDraft([]);
      form.setFieldsValue({ name: '', type: 'NETWORK', face: 'FRONT', shortId: '', widthMm: DEFAULT_PANEL_MM.w, heightMm: deviceHeight, notes: '' });
      return;
    }
    panelService.get({ id: panelId }).then(
      (p) => {
        setPanel(p);
        const w = p.widthMm ?? DEFAULT_PANEL_MM.w;
        const h = p.heightMm ?? deviceHeight;
        // ports without stored geometry get the default layout, so the editor can show and save them
        setDraft(layoutPorts(p.ports, w, h).map((x) => ({ id: x.id, number: x.number, portType: x.portType, xMm: x.xMm, yMm: x.yMm, wMm: x.wMm, hMm: x.hMm, rotation: x.rotation, label: x.label, ifName: x.ifName })));
        form.setFieldsValue({
          name: p.name,
          type: p.type,
          face: p.face,
          shortId: p.label ? formatShortId(p.label.shortId) : '',
          widthMm: w,
          heightMm: h,
          templateId: p.templateId ?? undefined,
          notes: p.notes ?? '',
        });
      },
      () => closeRef.current(false),
    );
  }, [open, panelId, deviceHeight, form]);

  const savePorts = async (p: PanelDetailDto) => {
    const before = new Map(p.ports.map((x) => [x.id, x]));
    const kept = new Set(draft.filter((d) => d.id).map((d) => d.id!));
    const rot = (r: number) => r as 0 | 90 | 180 | 270;
    for (const d of draft) {
      const geometry = { xMm: Math.max(0, d.xMm), yMm: Math.max(0, d.yMm), wMm: d.wMm, hMm: d.hMm, rotation: rot(d.rotation) };
      if (!d.id) {
        await portService.create({ panelId: p.id, number: d.number, portType: d.portType, ...geometry });
      } else {
        const old = before.get(d.id);
        if (old && geometryChanged(old, d)) await portService.update({ id: d.id, number: d.number, portType: d.portType, ...geometry });
      }
    }
    for (const old of p.ports) if (!kept.has(old.id)) await portService.delete({ id: old.id });
  };

  const save = async () => {
    const v = await form.validateFields();
    const shortId = parseLabelInput(v.shortId);
    setSaving(true);
    try {
      if (panel) {
        await panelService.update({ id: panel.id, name: v.name, type: v.type, face: v.face, notes: v.notes, widthMm: v.widthMm, heightMm: v.heightMm });
        await rebindIfChanged({ kind: 'PANEL', id: panel.id }, panel.label?.shortId, shortId);
        if (portsTouched) await savePorts(panel);
      } else if (v.templateId) {
        await panelTemplateService.createPanel({ templateId: v.templateId, deviceId: device.id, name: v.name, face: v.face, labelShortId: shortId });
      } else {
        await panelService.create({ deviceId: device.id, name: v.name, type: v.type, face: v.face, notes: v.notes, widthMm: v.widthMm, heightMm: v.heightMm, labelShortId: shortId });
      }
      message.success(t('panel:editor.saved'));
      onClose(true);
    } catch {
      // reported by rpc
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!panel) return;
    const ok = await deleteWithForce((force, opts) => panelService.delete({ id: panel.id, force }, opts), {
      code: 'PORT_HAS_DEPENDENTS',
      title: t('panel:messages.forceDeleteTitle'),
      content: t('panel:messages.forceDeleteContent'),
      okText: t('common:actions.delete'),
      cancelText: t('common:actions.cancel'),
    });
    if (ok) {
      message.success(t('panel:editor.deleted'));
      onClose(true);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <EditOutlined />
          {panel ? t('panel:editor.editTitle') : t('panel:editor.createTitle')}
        </Space>
      }
      open={open}
      onCancel={() => onClose(false)}
      width={panel ? 1200 : 760}
      forceRender
      wrapProps={{ 'data-testid': 'device-panel-editor-modal' }}
      footer={[
        panel && (
          <Button key="delete" danger icon={<DeleteOutlined />} onClick={remove} style={{ float: 'left' }} data-testid="device-panel-delete-btn">
            {t('panel:editor.delete')}
          </Button>
        ),
        <Button key="cancel" onClick={() => onClose(false)}>
          {t('common:actions.cancel')}
        </Button>,
        <Button key="save" type="primary" icon={<SaveOutlined />} loading={saving} onClick={save} data-testid="device-panel-save-btn">
          {t('common:actions.save')}
        </Button>,
      ]}
    >
      <div style={{ maxHeight: '72vh', overflowY: 'auto' }}>
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={3} size="small">
            <Descriptions.Item label={t('panel:editor.device')}>{device.name}</Descriptions.Item>
            <Descriptions.Item label={t('panel:editor.deviceType')}>{t(`device:deviceTypes.${device.type}`)}</Descriptions.Item>
            <Descriptions.Item label={t('panel:editor.model')}>{device.deviceModel?.name ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('panel:editor.uPosition')}>{device.uPosition ? `U${device.uPosition} (${uHeightText(device.uHeight, t('device:fields.uHeightUnknown'))})` : '-'}</Descriptions.Item>
            {panel?.label && (
              <Descriptions.Item label={t('panel:fields.label')}>
                <Text code>{formatShortId(panel.label.shortId)}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>

        <Form name="device-panel-editor-form" form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="name" label={t('panel:fields.name')} rules={[{ required: true, message: t('panel:validation.nameRequired') }]}>
                <Input placeholder={t('panel:editor.placeholders.name')} data-testid="device-panel-name-input" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="type" label={t('panel:fields.type')}>
                <Select data-testid="device-panel-type-select" options={PANEL_TYPES.map((v) => ({ value: v, label: t(`panel:panelTypes.${v}`) }))} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="face" label={t('panel:fields.face')}>
                <Select options={PANEL_FACES.map((v) => ({ value: v, label: t(`panel:faces.${v}`) }))} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <LabelField name="shortId" autoAllocate self={panel ? { kind: 'PANEL', id: panel.id } : undefined} testId="device-panel-shortid-input" />
            </Col>
            <Col span={8}>
              <Form.Item name="widthMm" label={t('panel:editor.widthMm')} rules={[{ required: true }]}>
                <InputNumber min={1} max={10000} step={0.1} style={{ width: '100%' }} data-testid="device-panel-width-input" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="heightMm" label={t('panel:editor.heightMm')} rules={[{ required: true }]} extra={t('panel:editor.heightHint', { u: effectiveUHeight(device.uHeight), mm: deviceHeight })}>
                <InputNumber min={1} max={10000} step={0.01} style={{ width: '100%' }} data-testid="device-panel-height-input" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="templateId" label={t('panel:editor.template')}>
            <Select
              allowClear
              placeholder={t('panel:editor.noTemplate')}
              options={templateOptions}
            />
          </Form.Item>
          {panel && template && (
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              {panel.templateOutdated && panel.templateId === template.id && <Alert type="info" showIcon message={t('panel:editor.templateOutdated', { revision: template.revision })} />}
              <Button onClick={() => setApplyOpen(true)} data-testid="device-panel-apply-template-btn">
                {t('panel:editor.applyTemplate')}
              </Button>
            </Space>
          )}
          <Form.Item name="notes" label={t('panel:fields.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>

        {panel && (
          <>
            <Divider orientation="left">{t('panel:editor.ports')}</Divider>
            <Text type="secondary">{t('panel:editor.portsHint')}</Text>
            <PanelCanvasEditor
              key={panel.id}
              width={widthMm}
              height={heightMm}
              initialPorts={draft}
              onPortsChange={(ports) => {
                setDraft(ports);
                setPortsTouched(true);
              }}
            />
          </>
        )}
      </div>
      <ApplyTemplateModal
        open={applyOpen}
        templateId={template?.id ?? null}
        panelId={panel?.id ?? null}
        onClose={(changed) => {
          setApplyOpen(false);
          if (changed) onClose(true);
        }}
      />
    </Modal>
  );
}

export default DevicePanelEditor;
