import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Col, Drawer, Form, Input, InputNumber, Modal, Row, Segmented, Select, Space, Typography, message } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { PANEL_FACES, PANEL_TYPES, type PanelFace, type PanelType } from '@contracts/enums';
import { GENERATOR_PRESETS, generatorIssues, type GeneratorPresetKey, type PanelGenerator } from '@contracts/panelGenerator';
import type { PanelTemplateDto } from '@contracts/panelTemplates';
import { U_HEIGHT_MM } from '@contracts/scene';
import PanelCanvasEditor, { type PortDefinition } from '@/components/PanelCanvasEditor';
import { useDeviceModels } from '@/api/hooks/deviceModels';
import { useCreateTemplate, useUpdateTemplate } from '@/api/hooks/panelTemplates';
import { DEFAULT_PANEL_MM } from '@/utils/panelLayoutGenerator';
import { GeneratorEditor } from './GeneratorEditor';
import { previewPorts } from './previewPorts';

const { Text } = Typography;

type Mode = 'generator' | 'manual';

interface FormValues {
  name: string;
  type: PanelType;
  face: PanelFace;
  widthMm: number;
  heightMm: number;
  deviceModelId?: string | null;
  description?: string | null;
}

interface TemplateEditorDrawerProps {
  open: boolean;
  /** edit this template (with ports); null: create */
  template: PanelTemplateDto | null;
  onClose: (changed: boolean) => void;
}

const PRESET_KEYS = Object.keys(GENERATOR_PRESETS) as GeneratorPresetKey[];
const START: PanelGenerator = GENERATOR_PRESETS.switch24ge4xge.generator;

/** Create or edit a template: parametric generator (default) or hand-placed ports. */
export function TemplateEditorDrawer({ open, template, onClose }: TemplateEditorDrawerProps) {
  const { t } = useTranslation('panel');
  const [form] = Form.useForm<FormValues>();
  const models = useDeviceModels();
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const [mode, setMode] = useState<Mode>('generator');
  const [generator, setGenerator] = useState<PanelGenerator>(START);
  const [manual, setManual] = useState<PortDefinition[]>([]);
  const widthMm: number = Form.useWatch('widthMm', form) ?? DEFAULT_PANEL_MM.w;
  const heightMm: number = Form.useWatch('heightMm', form) ?? DEFAULT_PANEL_MM.h;
  const issues = useMemo(() => (mode === 'generator' ? generatorIssues(generator, { panelHeightMm: heightMm }) : []), [mode, generator, heightMm]);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({
      name: template?.name ?? '',
      type: template?.type ?? 'NETWORK',
      face: template?.face ?? 'FRONT',
      widthMm: template?.widthMm ?? DEFAULT_PANEL_MM.w,
      heightMm: template?.heightMm ?? DEFAULT_PANEL_MM.h,
      deviceModelId: template?.deviceModelId ?? undefined,
      description: template?.description ?? '',
    });
    const explicit = !!template && !template.generator;
    setMode(explicit ? 'manual' : 'generator');
    setGenerator(template?.generator ?? START);
    setManual((template?.ports ?? []).map(({ id: _id, sortIndex: _s, ...p }) => ({ ...p, label: null })));
  }, [open, template, form]);

  const applyPreset = (key: GeneratorPresetKey) => {
    const p = GENERATOR_PRESETS[key];
    form.setFieldsValue({ widthMm: p.widthMm, heightMm: p.heightMm });
    setGenerator(p.generator);
    setMode('generator');
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    if (next === 'manual') {
      // start hand placement from what the generator produces now
      setManual(previewPorts(generator, heightMm).map(({ sortIndex: _s, ...p }) => ({ ...p, label: null })));
      setMode('manual');
      return;
    }
    Modal.confirm({
      title: t('templates.toGeneratorTitle'),
      content: t('templates.toGeneratorContent'),
      onOk: () => setMode('generator'),
    });
  };

  const save = async () => {
    const v = await form.validateFields();
    if (issues.length) return;
    const meta = { ...v, deviceModelId: v.deviceModelId ?? null };
    const ports =
      mode === 'manual'
        ? manual.map((p, i) => ({
            number: p.number,
            sortIndex: i + 1,
            portType: p.portType,
            ifName: p.ifName ?? null,
            xMm: Math.max(0, p.xMm),
            yMm: Math.max(0, p.yMm),
            wMm: p.wMm,
            hMm: p.hMm,
            rotation: p.rotation as 0 | 90 | 180 | 270,
          }))
        : undefined;
    const shape = mode === 'generator' ? { generator } : { ports };
    try {
      if (template) await update.mutateAsync({ id: template.id, ...meta, ...shape });
      else await create.mutateAsync({ ...meta, ...shape });
      message.success(t(template ? 'templates.updated' : 'templates.created'));
      onClose(true);
    } catch {
      // reported by rpc
    }
  };

  return (
    <Drawer
      title={template ? t('templates.editTitle', { name: template.name }) : t('templates.createTitle')}
      open={open}
      onClose={() => onClose(false)}
      width="min(1280px, 96vw)"
      destroyOnHidden
      extra={
        <Space>
          <Button onClick={() => onClose(false)}>{t('buttons.cancel')}</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={save} loading={create.isPending || update.isPending} disabled={issues.length > 0} data-testid="template-save">
            {t('buttons.save')}
          </Button>
        </Space>
      }
    >
      <Form name="panel-template-editor" form={form} layout="vertical">
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="name" label={t('templates.fields.name')} rules={[{ required: true, message: t('templates.validation.nameRequired') }]}>
              <Input data-testid="template-name-input" />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="type" label={t('templates.fields.type')}>
              <Select options={PANEL_TYPES.map((v) => ({ value: v, label: t(`panelTypes.${v}`) }))} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="face" label={t('templates.fields.face')}>
              <Select options={PANEL_FACES.map((v) => ({ value: v, label: t(`faces.${v}`) }))} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="deviceModelId" label={t('templates.fields.deviceModel')} extra={t('templates.deviceModelHint')}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                loading={models.isLoading}
                options={(models.data ?? []).map((m) => ({ value: m.id, label: `${m.vendor} ${m.name}`.trim() }))}
              />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={4}>
            <Form.Item name="widthMm" label={t('templates.fields.widthMm')} rules={[{ required: true }]}>
              <InputNumber min={1} max={10000} step={0.1} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={4}>
            <Form.Item name="heightMm" label={t('templates.fields.heightMm')} rules={[{ required: true }]} extra={t('templates.heightHint', { u: Math.round((heightMm / U_HEIGHT_MM) * 10) / 10 })}>
              <InputNumber min={1} max={10000} step={0.01} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={16}>
            <Form.Item name="description" label={t('templates.fields.description')}>
              <Input />
            </Form.Item>
          </Col>
        </Row>
      </Form>
      <Space style={{ marginBottom: 12 }} wrap>
        <Segmented
          value={mode}
          onChange={(v) => switchMode(v as Mode)}
          options={[
            { value: 'generator', label: t('templates.modeGenerator') },
            { value: 'manual', label: t('templates.modeManual') },
          ]}
        />
        {mode === 'generator' && (
          <Select<GeneratorPresetKey>
            style={{ width: 300 }}
            placeholder={t('templates.startFromPreset')}
            value={null}
            onChange={applyPreset}
            data-testid="template-preset-select"
            options={PRESET_KEYS.map((k) => ({ value: k, label: t(`generator.presets.${k}`) }))}
          />
        )}
        {template && template.panelCount > 0 && <Text type="secondary">{t('templates.revisionHint', { count: template.panelCount })}</Text>}
      </Space>
      {mode === 'generator' ? (
        <GeneratorEditor value={generator} onChange={setGenerator} widthMm={widthMm} heightMm={heightMm} />
      ) : (
        <>
          <Alert type="info" showIcon style={{ marginBottom: 12 }} message={t('templates.manualHint')} />
          <PanelCanvasEditor key={template?.id ?? 'new'} width={widthMm} height={heightMm} initialPorts={manual} onPortsChange={setManual} />
        </>
      )}
    </Drawer>
  );
}
