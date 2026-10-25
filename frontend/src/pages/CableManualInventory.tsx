import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Divider, Form, Input, InputNumber, Select, Space, Spin, Table, Tag, Typography, message } from 'antd';
import type { InputRef } from 'antd';
import { CheckCircleOutlined, DeleteOutlined, SaveOutlined, ScanOutlined, WarningOutlined } from '@ant-design/icons';
import { CABLE_MEDIA, type CableEnd, type CableMedium } from '@contracts/enums';
import { formatShortId } from '@contracts/shortId';
import { cableService } from '@/services/cableService';
import { labelService } from '@/services/labelService';
import { errorText } from '@/services/api';
import { parseLabelInput } from '@/utils/labels';

const { Title, Text } = Typography;

interface BaseInfo {
  medium: CableMedium;
  lengthM?: number | null;
  color?: string | null;
  notes?: string | null;
}

interface CableRecord {
  key: number;
  a: number;
  b: number;
  status: 'submitting' | 'success' | 'failed';
  error?: string;
}

/** Bulk registration of loose (in stock) cables: scan the two plug labels of each cable. */
export default function CableManualInventory() {
  const { t } = useTranslation(['cable', 'common']);
  const [form] = Form.useForm<BaseInfo>();
  const [base, setBase] = useState<BaseInfo | null>(null);
  const [input, setInput] = useState('');
  const [endA, setEndA] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [records, setRecords] = useState<CableRecord[]>([]);
  const seq = useRef(0);
  const inputRef = useRef<InputRef>(null);
  const side: CableEnd = endA === null ? 'A' : 'B';

  useEffect(() => {
    if (base) inputRef.current?.focus();
  }, [base, endA]);

  /** A plug label must not be void or bound to anything else; unknown numbers are registered by the server. */
  const checkLabel = async (shortId: number): Promise<string | null> => {
    const r = await labelService.resolve({ shortId });
    if (r.state === 'VOID') return t('common:label.void');
    if (r.bound) return t('common:label.bound', { name: r.bound.path.map((n) => n.name).join(' / ') });
    return null;
  };

  const submit = async (rec: CableRecord) => {
    if (!base) return;
    setRecords((rs) => rs.map((r) => (r.key === rec.key ? { ...r, status: 'submitting', error: undefined } : r)));
    try {
      await cableService.create({ ...base, ends: { A: { labelShortId: rec.a }, B: { labelShortId: rec.b } } });
      setRecords((rs) => rs.map((r) => (r.key === rec.key ? { ...r, status: 'success' } : r)));
      message.success(t('cable:messages.inventorySuccess'));
    } catch (e) {
      setRecords((rs) => rs.map((r) => (r.key === rec.key ? { ...r, status: 'failed', error: errorText(e) } : r)));
    }
  };

  const scan = async () => {
    let shortId: number | undefined;
    try {
      shortId = parseLabelInput(input);
    } catch {
      message.error(t('cable:messages.invalidShortId'));
      setInput('');
      return;
    }
    setInput('');
    if (shortId === undefined) return;
    if (side === 'B' && shortId === endA) {
      message.error(t('cable:messages.duplicatePort'));
      return;
    }
    setChecking(true);
    try {
      const problem = await checkLabel(shortId);
      if (problem) {
        message.error(problem);
        return;
      }
      message.success(t('cable:messages.portSuccess', { side, shortId: formatShortId(shortId) }));
      if (side === 'A') {
        setEndA(shortId);
        return;
      }
      const rec: CableRecord = { key: ++seq.current, a: endA!, b: shortId, status: 'submitting' };
      setRecords((rs) => [rec, ...rs]);
      setEndA(null);
      await submit(rec);
    } catch {
      // reported by rpc
    } finally {
      setChecking(false);
    }
  };

  const statusTag = (r: CableRecord) => {
    if (r.status === 'submitting') return <Tag color="processing">{t('cable:portStatus.submitting')}</Tag>;
    if (r.status === 'success')
      return (
        <Tag color="success" icon={<CheckCircleOutlined />}>
          {t('cable:portStatus.success')}
        </Tag>
      );
    return (
      <Tag color="error" icon={<WarningOutlined />} title={r.error}>
        {t('cable:portStatus.failed')}
      </Tag>
    );
  };

  const columns = [
    { title: t('cable:ends.A'), key: 'a', render: (_: unknown, r: CableRecord) => <Text code>{formatShortId(r.a)}</Text> },
    { title: t('cable:ends.B'), key: 'b', render: (_: unknown, r: CableRecord) => <Text code>{formatShortId(r.b)}</Text> },
    { title: t('cable:manualInventory.status'), key: 'status', width: 120, render: (_: unknown, r: CableRecord) => statusTag(r) },
    { title: '', key: 'error', render: (_: unknown, r: CableRecord) => (r.error ? <Text type="danger">{r.error}</Text> : null) },
    {
      title: t('cable:manualInventory.action'),
      key: 'action',
      width: 160,
      render: (_: unknown, r: CableRecord) => (
        <Space>
          {r.status === 'failed' && (
            <Button type="link" size="small" onClick={() => submit(r)}>
              {t('cable:buttons.retry')}
            </Button>
          )}
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => setRecords((rs) => rs.filter((x) => x.key !== r.key))}>
            {t('cable:buttons.removeRecord')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Title level={2}>{t('cable:manualInventory.title')}</Title>
        <Text type="secondary">{t('cable:manualInventory.description')}</Text>
        <Divider />

        {!base ? (
          <div>
            <Alert message={t('cable:manualInventory.step1')} description={t('cable:manualInventory.step1Desc')} type="info" showIcon style={{ marginBottom: 24 }} />
            <Form
              form={form}
              layout="vertical"
              initialValues={{ medium: 'CAT6' }}
              onFinish={(v) => {
                setBase(v);
                message.success(t('cable:messages.baseInfoConfirmed'));
              }}
            >
              <Form.Item label={t('cable:labels.cableType')} name="medium" rules={[{ required: true, message: t('cable:validation.typeRequired') }]}>
                <Select size="large" options={CABLE_MEDIA.map((m) => ({ value: m, label: t(`cable:media.${m}`) }))} />
              </Form.Item>
              <Form.Item label={t('cable:labels.cableLength')} name="lengthM">
                <InputNumber min={0.1} step={0.5} placeholder={t('cable:placeholders.length')} style={{ width: '100%' }} size="large" />
              </Form.Item>
              <Form.Item label={t('cable:labels.cableColor')} name="color">
                <Input placeholder={t('cable:placeholders.color')} size="large" />
              </Form.Item>
              <Form.Item label={t('cable:labels.cableNotes')} name="notes">
                <Input.TextArea rows={2} placeholder={t('cable:placeholders.notes')} />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" icon={<SaveOutlined />}>
                {t('cable:buttons.startScan')}
              </Button>
            </Form>
          </div>
        ) : (
          <div>
            <Card size="small" style={{ marginBottom: 24, backgroundColor: '#f0f5ff' }}>
              <Space split={<Divider type="vertical" />}>
                <div>
                  <Text type="secondary">{t('cable:manualInventory.cableType')}: </Text>
                  <Tag color="blue">{t(`cable:media.${base.medium}`)}</Tag>
                </div>
                {base.lengthM && (
                  <div>
                    <Text type="secondary">{t('cable:manualInventory.cableLength')}: </Text>
                    <Text strong>{base.lengthM} m</Text>
                  </div>
                )}
                {base.color && (
                  <div>
                    <Text type="secondary">{t('cable:manualInventory.cableColor')}: </Text>
                    <Text strong>{base.color}</Text>
                  </div>
                )}
                <Button
                  type="link"
                  onClick={() => {
                    setBase(null);
                    setEndA(null);
                  }}
                >
                  {t('cable:buttons.editBaseInfo')}
                </Button>
              </Space>
            </Card>

            <Alert message={t('cable:manualInventory.step2')} description={t('cable:manualInventory.step2Desc')} type={side === 'A' ? 'info' : 'success'} showIcon style={{ marginBottom: 24 }} />

            <Card size="small" style={{ marginBottom: 24 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                {t('cable:manualInventory.scanEnd', { end: t(`cable:ends.${side}`) })}
              </Text>
              <Input
                ref={inputRef}
                prefix={<ScanOutlined />}
                placeholder={t('cable:placeholders.portId')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={scan}
                size="large"
                autoFocus
                suffix={checking ? <Spin size="small" /> : null}
                disabled={checking}
                data-testid="cable-inventory-input"
              />
              {endA !== null && (
                <Space style={{ marginTop: 16 }}>
                  <Tag color="blue">{t('cable:ends.A')}</Tag>
                  <Text code>{formatShortId(endA)}</Text>
                  <Button type="link" size="small" onClick={() => setEndA(null)}>
                    {t('common:actions.reset')}
                  </Button>
                </Space>
              )}
            </Card>

            {records.length > 0 && (
              <div>
                <Title level={4}>
                  {t('cable:manualInventory.records')} ({records.filter((r) => r.status === 'success').length}/{records.length})
                </Title>
                <Table rowKey="key" dataSource={records} columns={columns} pagination={false} size="small" scroll={{ y: 400 }} />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
