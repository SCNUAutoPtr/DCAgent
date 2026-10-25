import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Descriptions, Empty, Input, Popconfirm, Space, Tag, Typography, message } from 'antd';
import type { InputRef } from 'antd';
import { DeleteOutlined, ScanOutlined } from '@ant-design/icons';
import type { CableDto } from '@contracts/cables';
import { formatShortId } from '@contracts/shortId';
import { cableService } from '@/services/cableService';
import { labelService } from '@/services/labelService';
import { parseLabelInput } from '@/utils/labels';

const { Title, Text } = Typography;

const where = (ep: CableDto['endpoints'][number]) =>
  ep.path
    .filter((n) => n.kind !== 'DATACENTER' && n.kind !== 'CABLE' && n.kind !== 'CABLE_ENDPOINT')
    .map((n) => n.name)
    .join(' / ');

export default function CableScrap() {
  const { t } = useTranslation(['cable', 'common']);
  const [input, setInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [cable, setCable] = useState<CableDto | null>(null);
  const [scrapping, setScrapping] = useState(false);
  const inputRef = useRef<InputRef>(null);

  const lookup = async () => {
    let shortId: number | undefined;
    try {
      shortId = parseLabelInput(input);
    } catch {
      message.warning(t('common:label.invalid'));
      return;
    }
    if (shortId === undefined) return;
    setChecking(true);
    setCable(null);
    try {
      const r = await labelService.resolve({ shortId });
      const cableNode = r.bound?.kind === 'CABLE_ENDPOINT' ? r.bound.path.find((n) => n.kind === 'CABLE') : undefined;
      if (!cableNode) {
        message.warning(t('cable:scrap.notEndpoint'));
        return;
      }
      setCable(await cableService.get({ id: cableNode.id }));
    } catch {
      // reported by rpc
    } finally {
      setInput('');
      setChecking(false);
      inputRef.current?.focus();
    }
  };

  const scrap = async () => {
    if (!cable) return;
    setScrapping(true);
    try {
      await cableService.delete({ id: cable.id, voidLabels: true });
      message.success(t('cable:scrap.success'));
      setCable(null);
      inputRef.current?.focus();
    } catch {
      // reported by rpc
    } finally {
      setScrapping(false);
    }
  };

  return (
    <div>
      <Title level={2}>
        <DeleteOutlined /> {t('cable:scrap.title')}
      </Title>
      <Text type="secondary">{t('cable:scrap.description')}</Text>

      <Card style={{ marginTop: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <ScanOutlined /> {t('cable:scrap.scanLabel')}
            </Text>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                ref={inputRef}
                size="large"
                placeholder={t('common:label.placeholder')}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPressEnter={lookup}
                autoFocus
                disabled={checking}
                data-testid="cable-scrap-input"
              />
              <Button type="primary" size="large" icon={<ScanOutlined />} onClick={lookup} loading={checking}>
                {t('cable:scrap.query')}
              </Button>
            </Space.Compact>
          </div>

          {cable ? (
            <>
              <Alert type="info" showIcon message={t('cable:scrap.found')} />
              <Card size="small" title={t('cable:scrap.info')}>
                <Descriptions column={2} size="small" bordered>
                  <Descriptions.Item label={t('cable:fields.label')}>{cable.label || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('cable:fields.type')}>{t(`cable:media.${cable.medium}`)}</Descriptions.Item>
                  <Descriptions.Item label={t('cable:fields.length')}>{cable.lengthM ? `${cable.lengthM} m` : '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('cable:fields.color')}>{cable.color || '-'}</Descriptions.Item>
                  <Descriptions.Item label={t('cable:fields.notes')} span={2}>
                    {cable.notes || '-'}
                  </Descriptions.Item>
                </Descriptions>
                <div style={{ marginTop: 16 }}>
                  <Text strong>{t('cable:scrap.ends')}</Text>
                  {cable.endpoints.map((ep) => (
                    <div key={ep.id} style={{ marginTop: 8, padding: 12, background: '#fafafa', borderRadius: 4 }}>
                      <Space wrap>
                        <Tag>{t(`cable:ends.${ep.end}`)}</Tag>
                        {ep.label && <Text code>{formatShortId(ep.label.shortId)}</Text>}
                        <Text type="secondary">{where(ep) || t('cable:detail.notPlugged')}</Text>
                      </Space>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <Popconfirm
                    title={t('cable:scrap.confirmTitle')}
                    description={t('cable:scrap.confirmContent')}
                    onConfirm={scrap}
                    okText={t('cable:scrap.submit')}
                    cancelText={t('common:actions.cancel')}
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="primary" danger size="large" icon={<DeleteOutlined />} loading={scrapping}>
                      {t('cable:scrap.submit')}
                    </Button>
                  </Popconfirm>
                </div>
              </Card>
            </>
          ) : (
            !checking && <Empty description={t('cable:scrap.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </Space>
      </Card>

      <Alert type="warning" showIcon message={t('cable:scrap.help')} style={{ marginTop: 24 }} />
    </div>
  );
}
