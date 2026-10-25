import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Form, Input, InputNumber, Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, DownloadOutlined, PlusOutlined, PrinterOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import type { PathNode } from '@contracts/common';
import { LABEL_KINDS, LABEL_STATES, type LabelKind, type LabelState, type PrintTaskStatus } from '@contracts/enums';
import type { LabelDto, LabelStats, MissingLabelItem, PrintTaskDto } from '@contracts/labels';
import { formatShortId } from '@contracts/shortId';
import { labelService } from '@/services/labelService';
import { saveBlob } from '@/services/api';
import { pathForEntity } from '@/routes';
import type labelsLocale from '@/locales/zh-CN/labels.json';
import { SearchInput } from '@/components/SearchInput';

const { Title, Text } = Typography;

type LabelsLocale = typeof labelsLocale;

const STATE_COLORS: Record<LabelState, string> = { GENERATED: 'default', PRINTED: 'processing', VOID: 'error' };
const TASK_COLORS: Record<PrintTaskStatus, string> = { PENDING: 'default', COMPLETED: 'success', FAILED: 'error' };

type Mode = 'count' | 'range' | 'bound';

interface Filters {
  state?: LabelState;
  bound?: boolean;
  kind?: LabelKind;
  range?: string;
}

const where = (path: PathNode[]) =>
  path
    .filter((n) => n.kind !== 'DATACENTER')
    .map((n) => n.name)
    .join(' / ');

export default function LabelManagement() {
  const { t } = useTranslation(['labels', 'common']);
  const navigate = useNavigate();
  const [tab, setTab] = useState('labels');
  const [stats, setStats] = useState<LabelStats | null>(null);
  const [missingCount, setMissingCount] = useState<number | null>(null);

  const [labels, setLabels] = useState<LabelDto[]>([]);
  const [labelTotal, setLabelTotal] = useState(0);
  const [labelPage, setLabelPage] = useState({ current: 1, pageSize: 50 });
  const [filters, setFilters] = useState<Filters>({});
  const [loading, setLoading] = useState(false);

  const [tasks, setTasks] = useState<PrintTaskDto[]>([]);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskPage, setTaskPage] = useState({ current: 1, pageSize: 50 });
  const [missing, setMissing] = useState<MissingLabelItem[]>([]);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [generateForm] = Form.useForm();
  const [taskForm] = Form.useForm();
  const [voidForm] = Form.useForm();
  const generateMode: Mode = Form.useWatch('mode', generateForm) ?? 'count';
  const taskMode: Mode = Form.useWatch('mode', taskForm) ?? 'count';

  const loadStats = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([labelService.stats(), labelService.missing()]);
      setStats(s);
      setMissingCount(m.length);
      setMissing(m);
    } catch {
      // reported by rpc
    }
  }, []);

  const loadLabels = useCallback(async () => {
    setLoading(true);
    try {
      const r = await labelService.list({ ...filters, take: labelPage.pageSize, skip: (labelPage.current - 1) * labelPage.pageSize });
      setLabels(r.items);
      setLabelTotal(r.total);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [filters, labelPage]);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await labelService.printTasks.list({ take: taskPage.pageSize, skip: (taskPage.current - 1) * taskPage.pageSize });
      setTasks(r.items);
      setTaskTotal(r.total);
    } catch {
      // reported by rpc
    } finally {
      setLoading(false);
    }
  }, [taskPage]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (tab === 'labels') loadLabels();
    if (tab === 'tasks') loadTasks();
  }, [tab, loadLabels, loadTasks]);

  const refresh = () => {
    loadStats();
    if (tab === 'labels') loadLabels();
    if (tab === 'tasks') loadTasks();
  };

  const generate = async () => {
    const v = await generateForm.validateFields();
    try {
      const r = await labelService.generate(v.mode === 'range' ? { rangeExpr: v.rangeExpr, batchNo: v.batchNo } : { count: v.count, batchNo: v.batchNo });
      message.success(t('labels:messages.generated', { created: r.created.length, existing: r.existing.length }));
      setGenerateOpen(false);
      generateForm.resetFields();
      refresh();
    } catch {
      // reported by rpc
    }
  };

  const createTask = async () => {
    const v = await taskForm.validateFields();
    try {
      const base = { name: v.name, notes: v.notes, createdBy: v.createdBy };
      let body;
      if (v.mode === 'range') body = { ...base, rangeExpr: v.rangeExpr as string };
      else if (v.mode === 'bound') {
        const pending = await labelService.list({ state: 'GENERATED', bound: true, take: 1000 });
        if (!pending.items.length) {
          message.info(t('labels:messages.noMissing'));
          return;
        }
        body = { ...base, shortIds: pending.items.map((l) => l.shortId) };
      } else body = { ...base, count: v.count as number };
      const r = await labelService.printTasks.create(body);
      message.success(t('labels:messages.taskCreated', { count: r.count }));
      setTaskOpen(false);
      taskForm.resetFields();
      setTab('tasks');
      refresh();
    } catch {
      // reported by rpc
    }
  };

  const voidLabels = async (body: { shortIds?: number[]; rangeExpr?: string; reason?: string }) => {
    try {
      const r = await labelService.void(body);
      if (r.failed.length) {
        Modal.warning({
          title: t('labels:messages.voidPartial', { ok: r.voided.length, failed: r.failed.length }),
          content: (
            <ul style={{ maxHeight: 300, overflow: 'auto' }}>
              {r.failed.map((f) => (
                <li key={f.shortId}>
                  <Text code>{formatShortId(f.shortId)}</Text> {t(`labels:messages.voidReasons.${f.reason}`)}
                </li>
              ))}
            </ul>
          ),
        });
      } else message.success(t('labels:messages.voided', { count: r.voided.length }));
      refresh();
      return true;
    } catch {
      return false;
    }
  };

  const batchVoid = async () => {
    const v = await voidForm.validateFields();
    if (await voidLabels({ rangeExpr: v.rangeExpr, reason: v.reason })) {
      setVoidOpen(false);
      voidForm.resetFields();
    }
  };

  const exportTask = async (task: PrintTaskDto) => {
    try {
      saveBlob(await labelService.printTasks.exportCsv({ id: task.id }), `labels_${task.name}_${new Date().toISOString().slice(0, 10)}.csv`);
      message.success(t('labels:messages.exported'));
    } catch {
      // reported by rpc
    }
  };

  const completeTask = async (id: string, status: 'COMPLETED' | 'FAILED') => {
    try {
      await labelService.printTasks.complete({ id, status });
      message.success(t('labels:messages.taskCompleted'));
      refresh();
    } catch {
      // reported by rpc
    }
  };

  const boundCell = (l: LabelDto) =>
    l.bound ? (
      <span>
        <Tag>{t(`common:entityKinds.${l.bound.kind}`)}</Tag>
        {l.bound.name}
      </span>
    ) : (
      '-'
    );

  const dateCell = (v: string | null) => (v ? new Date(v).toLocaleString() : '-');

  const labelColumns = [
    { title: t('labels:fields.shortId'), dataIndex: 'display', key: 'display', width: 120, render: (v: string) => <Text code>{v}</Text> },
    { title: t('labels:fields.state'), dataIndex: 'state', key: 'state', width: 100, render: (s: LabelState) => <Tag color={STATE_COLORS[s]}>{t(`labels:states.${s}`)}</Tag> },
    { title: t('labels:fields.bound'), key: 'bound', render: (_: unknown, l: LabelDto) => boundCell(l) },
    { title: t('labels:fields.batchNo'), dataIndex: 'batchNo', key: 'batchNo', width: 160, render: (v: string | null) => v || '-' },
    { title: t('labels:fields.printedAt'), dataIndex: 'printedAt', key: 'printedAt', width: 170, render: dateCell },
    { title: t('labels:fields.firstBoundAt'), dataIndex: 'firstBoundAt', key: 'firstBoundAt', width: 170, render: dateCell },
    { title: t('labels:fields.notes'), dataIndex: 'notes', key: 'notes', ellipsis: true },
    {
      title: t('labels:fields.actions'),
      key: 'actions',
      width: 90,
      render: (_: unknown, l: LabelDto) =>
        l.state !== 'VOID' && !l.bound ? (
          <Popconfirm title={t('labels:modals.void', { display: l.display })} onConfirm={() => voidLabels({ shortIds: [l.shortId] })}>
            <Button type="link" danger size="small" icon={<StopOutlined />}>
              {t('labels:actions.void')}
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  const taskColumns = [
    { title: t('labels:fields.taskName'), dataIndex: 'name', key: 'name' },
    { title: t('labels:fields.count'), dataIndex: 'count', key: 'count', width: 80 },
    { title: t('labels:fields.state'), dataIndex: 'status', key: 'status', width: 100, render: (s: PrintTaskStatus) => <Tag color={TASK_COLORS[s]}>{t(`labels:taskStatuses.${s}`)}</Tag> },
    { title: t('labels:fields.createdBy'), dataIndex: 'createdBy', key: 'createdBy', width: 110, render: (v: string | null) => v || '-' },
    { title: t('labels:fields.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 170, render: dateCell },
    { title: t('labels:fields.completedAt'), dataIndex: 'completedAt', key: 'completedAt', width: 170, render: dateCell },
    {
      title: t('labels:fields.actions'),
      key: 'actions',
      width: 300,
      render: (_: unknown, task: PrintTaskDto) => (
        <Space>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => exportTask(task)}>
            {t('labels:actions.exportCsv')}
          </Button>
          {task.status === 'PENDING' && (
            <>
              <Popconfirm title={t('labels:modals.confirmComplete')} onConfirm={() => completeTask(task.id, 'COMPLETED')}>
                <Button type="link" size="small" icon={<CheckCircleOutlined />}>
                  {t('labels:actions.complete')}
                </Button>
              </Popconfirm>
              <Button type="link" size="small" danger icon={<CloseCircleOutlined />} onClick={() => completeTask(task.id, 'FAILED')}>
                {t('labels:actions.fail')}
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const missingColumns = [
    { title: t('labels:fields.kind'), dataIndex: 'kind', key: 'kind', width: 120, render: (k: LabelKind) => t(`common:entityKinds.${k}`) },
    { title: t('labels:fields.name'), dataIndex: 'name', key: 'name' },
    {
      title: t('labels:fields.location'),
      key: 'path',
      render: (_: unknown, m: MissingLabelItem) => <a onClick={() => navigate(pathForEntity(m.kind, m.id, m.path))}>{where(m.path)}</a>,
    },
  ];

  const statCards: { key: keyof LabelsLocale['stats']; value: number | undefined; color?: string }[] = [
    { key: 'total', value: stats?.total },
    { key: 'bound', value: stats?.bound, color: '#52c41a' },
    { key: 'allocatable', value: stats?.allocatable },
    { key: 'toPrint', value: stats?.toPrint, color: '#1890ff' },
    { key: 'void', value: stats?.byState.VOID, color: '#ff4d4f' },
    { key: 'missing', value: missingCount ?? undefined, color: missingCount ? '#cf1322' : undefined },
  ];

  const modeFields = (mode: Mode, withBound: boolean) => (
    <>
      <Form.Item name="mode" initialValue="count">
        <Radio.Group>
          <Radio.Button value="count">{t('labels:modals.modeCount')}</Radio.Button>
          <Radio.Button value="range">{t('labels:modals.modeRange')}</Radio.Button>
          {withBound && <Radio.Button value="bound">{t('labels:modals.modeBound')}</Radio.Button>}
        </Radio.Group>
      </Form.Item>
      {mode === 'count' && (
        <Form.Item name="count" label={t('labels:form.count')} rules={[{ required: true, message: t('labels:validation.countRequired') }]}>
          <InputNumber min={1} max={10000} style={{ width: '100%' }} />
        </Form.Item>
      )}
      {mode === 'range' && (
        <Form.Item name="rangeExpr" label={t('labels:form.rangeExpr')} extra={t('labels:modals.rangeHelp')} rules={[{ required: true, message: t('labels:validation.rangeRequired') }]}>
          <Input placeholder={t('labels:placeholders.rangeExpr')} />
        </Form.Item>
      )}
    </>
  );

  return (
    <div>
      <Title level={2}>{t('labels:title')}</Title>
      <Text type="secondary">{t('labels:description')}</Text>

      <Row gutter={16} style={{ margin: '24px 0' }}>
        {statCards.map((s) => (
          <Col key={s.key} xs={12} md={4}>
            <Card size="small">
              <Statistic title={t(`labels:stats.${s.key}`)} value={s.value ?? '-'} valueStyle={s.color ? { color: s.color } : undefined} />
            </Card>
          </Col>
        ))}
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateOpen(true)}>
            {t('labels:actions.generate')}
          </Button>
          <Button icon={<PrinterOutlined />} onClick={() => setTaskOpen(true)}>
            {t('labels:actions.createPrintTask')}
          </Button>
          <Button danger icon={<StopOutlined />} onClick={() => setVoidOpen(true)}>
            {t('labels:actions.batchVoid')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={refresh}>
            {t('labels:actions.refresh')}
          </Button>
        </Space>

        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'labels',
              label: t('labels:tabs.labels'),
              children: (
                <>
                  <Space wrap style={{ marginBottom: 16 }}>
                    <Select
                      allowClear
                      placeholder={t('labels:filters.state')}
                      style={{ width: 130 }}
                      options={LABEL_STATES.map((s) => ({ value: s, label: t(`labels:states.${s}`) }))}
                      onChange={(state?: LabelState) => {
                        setFilters((f) => ({ ...f, state }));
                        setLabelPage((p) => ({ ...p, current: 1 }));
                      }}
                    />
                    <Select
                      allowClear
                      placeholder={t('labels:filters.bound')}
                      style={{ width: 130 }}
                      options={[
                        { value: 'yes', label: t('labels:bound.yes') },
                        { value: 'no', label: t('labels:bound.no') },
                      ]}
                      onChange={(v?: string) => {
                        setFilters((f) => ({ ...f, bound: v === undefined ? undefined : v === 'yes' }));
                        setLabelPage((p) => ({ ...p, current: 1 }));
                      }}
                    />
                    <Select
                      allowClear
                      placeholder={t('labels:filters.kind')}
                      style={{ width: 140 }}
                      options={LABEL_KINDS.map((k) => ({ value: k, label: t(`common:entityKinds.${k}`) }))}
                      onChange={(kind?: LabelKind) => {
                        setFilters((f) => ({ ...f, kind }));
                        setLabelPage((p) => ({ ...p, current: 1 }));
                      }}
                    />
                    <SearchInput
                      placeholder={t('labels:filters.range')}
                      style={{ width: 240 }}
                      onSearch={(v) => {
                        setFilters((f) => ({ ...f, range: v || undefined }));
                        setLabelPage((p) => ({ ...p, current: 1 }));
                      }}
                    />
                  </Space>
                  <Table
                    rowKey="shortId"
                    size="small"
                    columns={labelColumns}
                    dataSource={labels}
                    loading={loading}
                    scroll={{ x: 1200 }}
                    pagination={{
                      ...labelPage,
                      total: labelTotal,
                      showSizeChanger: true,
                      showTotal: (total) => t('labels:pagination.total', { total }),
                      onChange: (current, pageSize) => setLabelPage({ current, pageSize }),
                    }}
                  />
                </>
              ),
            },
            {
              key: 'tasks',
              label: t('labels:tabs.tasks'),
              children: (
                <Table
                  rowKey="id"
                  size="small"
                  columns={taskColumns}
                  dataSource={tasks}
                  loading={loading}
                  pagination={{
                    ...taskPage,
                    total: taskTotal,
                    showTotal: (total) => t('labels:pagination.total', { total }),
                    onChange: (current, pageSize) => setTaskPage({ current, pageSize }),
                  }}
                />
              ),
            },
            {
              key: 'missing',
              label: `${t('labels:tabs.missing')}${missingCount ? ` (${missingCount})` : ''}`,
              children: <Table rowKey="id" size="small" columns={missingColumns} dataSource={missing} locale={{ emptyText: t('labels:messages.noMissing') }} pagination={false} />,
            },
          ]}
        />
      </Card>

      <Modal title={t('labels:modals.generate')} open={generateOpen} onOk={generate} onCancel={() => setGenerateOpen(false)} forceRender>
        <Form name="label-management-generate-form" form={generateForm} layout="vertical">
          {modeFields(generateMode, false)}
          <Form.Item name="batchNo" label={t('labels:form.batchNo')}>
            <Input placeholder={t('labels:placeholders.batchNo')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('labels:modals.createPrintTask')} open={taskOpen} onOk={createTask} onCancel={() => setTaskOpen(false)} forceRender>
        <Form name="label-management-task-form" form={taskForm} layout="vertical">
          <Form.Item name="name" label={t('labels:form.taskName')} rules={[{ required: true, message: t('labels:validation.taskNameRequired') }]}>
            <Input placeholder={t('labels:placeholders.taskName')} />
          </Form.Item>
          {modeFields(taskMode, true)}
          <Form.Item name="createdBy" label={t('labels:form.createdBy')}>
            <Input placeholder={t('labels:placeholders.createdBy')} />
          </Form.Item>
          <Form.Item name="notes" label={t('labels:form.notes')}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={t('labels:modals.batchVoid')} open={voidOpen} onOk={batchVoid} onCancel={() => setVoidOpen(false)} okButtonProps={{ danger: true }} forceRender>
        <Form name="label-management-void-form" form={voidForm} layout="vertical">
          <Form.Item name="rangeExpr" label={t('labels:form.rangeExpr')} extra={t('labels:modals.rangeHelp')} rules={[{ required: true, message: t('labels:validation.rangeRequired') }]}>
            <Input placeholder={t('labels:placeholders.rangeExpr')} />
          </Form.Item>
          <Form.Item name="reason" label={t('labels:form.reason')} rules={[{ required: true, message: t('labels:validation.reasonRequired') }]}>
            <Input placeholder={t('labels:placeholders.reason')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
