import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Col, Collapse, Input, InputNumber, Row, Segmented, Select, Space, Tooltip, Typography } from 'antd';
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';
import { PORT_TYPES, type PortType } from '@contracts/enums';
import {
  GENERATOR_ORDERS,
  generatorIssues,
  pruneOverrides,
  type GeneratorGroup,
  type PanelGenerator,
} from '@contracts/panelGenerator';
import { previewPorts } from './previewPorts';
import { GeneratorCanvas, type DragResult } from './GeneratorCanvas';

const { Text } = Typography;

interface GeneratorEditorProps {
  value: PanelGenerator;
  onChange: (g: PanelGenerator) => void;
  widthMm: number;
  heightMm: number;
}

const round = (v: number) => Math.round(v * 2) / 2;

const NEW_GROUP: GeneratorGroup = { portType: 'RJ45', count: 8, numberPrefix: 'ge', rows: 1 };

/** Parametric port groups with a live, draggable SVG preview (drag: one port, shift-drag: the whole group). */
export function GeneratorEditor({ value, onChange, widthMm, heightMm }: GeneratorEditorProps) {
  const { t } = useTranslation('panel');
  const ports = useMemo(() => previewPorts(value, heightMm), [value, heightMm]);
  const issues = useMemo(() => generatorIssues(value, { panelHeightMm: heightMm }), [value, heightMm]);
  const groupIndex = useMemo(() => value.groups.flatMap((g, gi) => Array.from({ length: g.count }, () => gi)), [value.groups]);

  const setGroups = (groups: GeneratorGroup[]) => onChange(pruneOverrides({ ...value, groups }));
  const patch = (gi: number, p: Partial<GeneratorGroup>) => {
    const next = { ...value.groups[gi], ...p };
    for (const k of Object.keys(p) as (keyof GeneratorGroup)[]) if (p[k] === undefined || p[k] === null || p[k] === '') delete next[k];
    setGroups(value.groups.map((g, i) => (i === gi ? next : g)));
  };
  const move = (gi: number, d: -1 | 1) => {
    const groups = [...value.groups];
    [groups[gi], groups[gi + d]] = [groups[gi + d], groups[gi]];
    setGroups(groups);
  };

  const onDragEnd = ({ index, dxMm, dyMm, group }: DragResult) => {
    const port = ports[index];
    if (!port) return;
    if (!group) {
      const overrides = (value.overrides ?? []).filter((o) => o.number !== port.number);
      overrides.push({ number: port.number, xMm: Math.max(0, round(port.xMm + dxMm)), yMm: Math.max(0, round(port.yMm + dyMm)) });
      onChange({ ...value, overrides });
      return;
    }
    const gi = groupIndex[index];
    const first = groupIndex.indexOf(gi);
    const base = previewPorts({ ...value, overrides: undefined }, heightMm)[first];
    if (!base) return;
    const members = new Set(ports.filter((_, i) => groupIndex[i] === gi).map((p) => p.number));
    const overrides = (value.overrides ?? []).map((o) => (members.has(o.number) ? { ...o, xMm: Math.max(0, round(o.xMm + dxMm)), yMm: Math.max(0, round(o.yMm + dyMm)) } : o));
    const groups = value.groups.map((g, i) => (i === gi ? { ...g, xMm: Math.max(0, round(base.xMm + dxMm)), yMm: Math.max(0, round(base.yMm + dyMm)) } : g));
    onChange({ ...value, groups, ...(overrides.length ? { overrides } : {}) });
  };

  const num = (gi: number, key: keyof GeneratorGroup, props: { min?: number; max?: number; step?: number; auto?: boolean } = {}) => (
    <InputNumber
      size="small"
      style={{ width: '100%' }}
      min={props.min ?? 0}
      max={props.max}
      step={props.step ?? 0.5}
      placeholder={props.auto ? t('generator.auto') : undefined}
      value={value.groups[gi][key] as number | undefined}
      onChange={(v) => patch(gi, { [key]: v ?? undefined })}
    />
  );
  const field = (label: string, node: React.ReactNode, span = 4) => (
    <Col span={span} key={label}>
      <Text type="secondary" style={{ fontSize: 12 }}>
        {label}
      </Text>
      {node}
    </Col>
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <GeneratorCanvas widthMm={widthMm} heightMm={heightMm} ports={ports} groupIndex={groupIndex} onDragEnd={onDragEnd} />
      <Space wrap>
        <Text type="secondary">{t('generator.dragHint', { count: ports.length })}</Text>
        {!!value.overrides?.length && (
          <Button size="small" icon={<UndoOutlined />} onClick={() => onChange({ version: 1, groups: value.groups })}>
            {t('generator.clearOverrides', { count: value.overrides.length })}
          </Button>
        )}
      </Space>
      {issues.length > 0 && (
        <Alert
          type="error"
          showIcon
          data-testid="generator-issues"
          message={t('generator.issuesTitle')}
          description={issues.map((i) => (
            <div key={`${i.kind}-${i.value}`}>{t(`generator.issues.${i.kind}`, { value: i.value })}</div>
          ))}
        />
      )}
      {value.groups.map((g, gi) => {
        const named = !!g.names;
        return (
          <Card
            key={gi}
            size="small"
            data-testid={`generator-group-${gi}`}
            title={t('generator.group', { n: gi + 1 })}
            extra={
              <Space size={0}>
                <Tooltip title={t('generator.moveUp')}>
                  <Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={gi === 0} onClick={() => move(gi, -1)} />
                </Tooltip>
                <Tooltip title={t('generator.moveDown')}>
                  <Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={gi === value.groups.length - 1} onClick={() => move(gi, 1)} />
                </Tooltip>
                <Tooltip title={t('generator.removeGroup')}>
                  <Button type="text" size="small" danger icon={<DeleteOutlined />} disabled={value.groups.length === 1} onClick={() => setGroups(value.groups.filter((_, i) => i !== gi))} />
                </Tooltip>
              </Space>
            }
          >
            <Row gutter={[8, 8]}>
              {field(
                t('generator.portType'),
                <Select<PortType>
                  size="small"
                  style={{ width: '100%' }}
                  value={g.portType}
                  options={PORT_TYPES.map((v) => ({ value: v, label: t(`portTypes.${v}`) }))}
                  onChange={(v) => patch(gi, { portType: v })}
                />,
                6,
              )}
              {field(t('generator.count'), num(gi, 'count', { min: 1, max: 256, step: 1 }), 3)}
              {field(
                t('generator.numbering'),
                <Segmented
                  size="small"
                  value={named ? 'names' : 'prefix'}
                  options={[
                    { value: 'prefix', label: t('generator.numberingPrefix') },
                    { value: 'names', label: t('generator.numberingNames') },
                  ]}
                  onChange={(v) =>
                    patch(gi, v === 'names' ? { names: previewNames(g), numberPrefix: undefined, startIndex: undefined, indexStep: undefined } : { names: undefined })
                  }
                />,
                6,
              )}
              {named
                ? field(
                    t('generator.names'),
                    <Input
                      size="small"
                      value={g.names!.join(', ')}
                      placeholder="PSU1, PSU2"
                      onChange={(e) => {
                        const names = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                        patch(gi, { names, count: Math.max(1, names.length) });
                      }}
                    />,
                    9,
                  )
                : [
                    field(
                      t('generator.prefix'),
                      <Input size="small" value={g.numberPrefix ?? ''} placeholder="ge / GE0/0/" onChange={(e) => patch(gi, { numberPrefix: e.target.value })} />,
                      4,
                    ),
                    field(t('generator.start'), num(gi, 'startIndex', { step: 1, auto: true }), 3),
                    field(t('generator.step'), num(gi, 'indexStep', { min: 1, step: 1, auto: true }), 2),
                  ]}
              {field(
                t('generator.ifName'),
                <Input size="small" value={g.ifNamePattern ?? ''} placeholder="GigabitEthernet0/0/{n}" onChange={(e) => patch(gi, { ifNamePattern: e.target.value })} />,
                8,
              )}
              {field(t('generator.rows'), num(gi, 'rows', { min: 1, max: 8, step: 1, auto: true }), 3)}
              {field(
                t('generator.order'),
                <Select
                  size="small"
                  style={{ width: '100%' }}
                  value={g.order ?? 'ROW_MAJOR'}
                  options={GENERATOR_ORDERS.map((o) => ({ value: o, label: t(`generator.orders.${o}`) }))}
                  onChange={(v) => patch(gi, { order: v })}
                />,
                5,
              )}
              {field(t('generator.gap'), num(gi, 'gapMm', { auto: true }), 4)}
              {field(t('generator.xMm'), num(gi, 'xMm', { auto: true }), 2)}
              {field(t('generator.yMm'), num(gi, 'yMm', { auto: true }), 2)}
            </Row>
            <Collapse
              ghost
              size="small"
              items={[
                {
                  key: 'geometry',
                  label: t('generator.geometry'),
                  children: (
                    <Row gutter={[8, 8]}>
                      {field(t('generator.pitchX'), num(gi, 'pitchXMm', { auto: true }))}
                      {field(t('generator.pitchY'), num(gi, 'pitchYMm', { auto: true }))}
                      {field(t('generator.wMm'), num(gi, 'wMm', { min: 0.5, auto: true }))}
                      {field(t('generator.hMm'), num(gi, 'hMm', { min: 0.5, auto: true }))}
                      {field(
                        t('generator.rotation'),
                        <Select
                          size="small"
                          style={{ width: '100%' }}
                          value={g.rotation ?? 0}
                          options={[0, 90, 180, 270].map((r) => ({ value: r, label: `${r}°` }))}
                          onChange={(v) => patch(gi, { rotation: v as GeneratorGroup['rotation'] })}
                        />,
                      )}
                    </Row>
                  ),
                },
              ]}
            />
          </Card>
        );
      })}
      <Button icon={<PlusOutlined />} onClick={() => setGroups([...value.groups, NEW_GROUP])} data-testid="generator-add-group">
        {t('generator.addGroup')}
      </Button>
    </Space>
  );

  function previewNames(g: GeneratorGroup): string[] {
    return Array.from({ length: g.count }, (_, i) => `${g.numberPrefix ?? ''}${(g.startIndex ?? 1) + i * (g.indexStep ?? 1)}`);
  }
}

export default GeneratorEditor;
