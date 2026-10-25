import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Breadcrumb, Button, Card, Col, Descriptions, Popconfirm, Row, Space, Spin, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, DisconnectOutlined, SwapOutlined } from '@ant-design/icons';
import type { CableDto, EndpointDto } from '@contracts/cables';
import type { PathNode } from '@contracts/common';
import type { PortDetailDto } from '@contracts/panels';
import { formatShortId } from '@contracts/shortId';
import { cableService } from '@/services/cableService';
import { portService } from '@/services/panelService';
import { pathForEntity, paths } from '@/routes';

const { Title, Text } = Typography;

function PathCrumbs({ path }: { path: PathNode[] }) {
  const navigate = useNavigate();
  const nodes = path.filter((n) => n.kind !== 'DATACENTER' && n.kind !== 'CABLE' && n.kind !== 'CABLE_ENDPOINT');
  return (
    <Breadcrumb
      items={nodes.map((n) => ({
        title: <a onClick={() => navigate(pathForEntity(n.kind, n.id, path))}>{n.name}</a>,
      }))}
    />
  );
}

/** One end of a cable: where it is plugged (or parked) and its plug label. */
function EndpointCard({ ep, highlight, onDisconnect }: { ep: EndpointDto; highlight: boolean; onDisconnect: (ep: EndpointDto) => void }) {
  const { t } = useTranslation('cable');
  const navigate = useNavigate();
  return (
    <Card
      title={t(`ends.${ep.end}`)}
      style={{ height: '100%', borderColor: highlight ? '#1890ff' : undefined }}
      extra={
        <Space>
          {ep.panel && (
            <Button type="link" size="small" onClick={() => navigate(paths.topologyPanel(ep.panel!.id))}>
              {t('detail.openPanel')}
            </Button>
          )}
          {ep.cabinet && (
            <Button type="link" size="small" onClick={() => navigate(paths.cabinet(ep.cabinet!.id))}>
              {t('detail.openCabinet')}
            </Button>
          )}
        </Space>
      }
    >
      <Descriptions column={1} size="small" bordered>
        <Descriptions.Item label={t('detail.plug')}>{ep.label ? <Text code>{formatShortId(ep.label.shortId)}</Text> : '-'}</Descriptions.Item>
        <Descriptions.Item label={t('detail.connector')}>{ep.connector ? t(`connectors.${ep.connector}`) : '-'}</Descriptions.Item>
        <Descriptions.Item label={t('detail.port')}>
          {ep.port ? (
            <Space>
              <a onClick={() => navigate(paths.port(ep.port!.id))}>{ep.port.number}</a>
              {ep.port.ifName && <Text type="secondary">{ep.port.ifName}</Text>}
            </Space>
          ) : ep.parkedPanelId ? (
            <Tag color="warning">{t('detail.parked')}</Tag>
          ) : (
            <Tag>{t('detail.notPlugged')}</Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('detail.path')}>{ep.path.length ? <PathCrumbs path={ep.path} /> : '-'}</Descriptions.Item>
      </Descriptions>
      {ep.portId && (
        <Popconfirm title={t('detail.disconnectConfirm')} onConfirm={() => onDisconnect(ep)}>
          <Button danger size="small" icon={<DisconnectOutlined />} style={{ marginTop: 12 }}>
            {t('detail.disconnect')}
          </Button>
        </Popconfirm>
      )}
    </Card>
  );
}

/**
 * /ports/:id shows a port and the cable on it; /cables/:id shows a cable with both ends.
 * Everything is read from the path, so a refresh or a shared link shows the same page.
 */
export default function PortDetailView() {
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation(['cable', 'panel']);
  const mode: 'port' | 'cable' = pathname.startsWith('/cables/') ? 'cable' : 'port';

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [port, setPort] = useState<PortDetailDto | null>(null);
  const [cable, setCable] = useState<CableDto | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setFailed(false);
    try {
      if (mode === 'port') {
        const p = await portService.get({ id });
        setPort(p);
        setCable(p.cable ? await cableService.get({ id: p.cable.id }) : null);
      } else {
        setPort(null);
        setCable(await cableService.get({ id }));
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id, mode]);

  useEffect(() => {
    load();
  }, [load]);

  const disconnect = async (ep: EndpointDto) => {
    try {
      await cableService.disconnectEnd({ endpointId: ep.id });
      message.success(t('cable:detail.disconnected'));
      load();
    } catch {
      // reported by rpc
    }
  };

  const back = (
    <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>
      {t('cable:detail.back')}
    </Button>
  );

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" />
      </div>
    );
  }
  if (failed) {
    return (
      <div>
        {back}
        <Alert type="error" showIcon message={t('cable:detail.notFound')} />
      </div>
    );
  }

  const ends = cable ? [...cable.endpoints].sort((a, b) => a.end.localeCompare(b.end)) : [];

  return (
    <div>
      {back}
      <Title level={3}>{mode === 'port' ? t('cable:detail.portTitle') : t('cable:detail.cableTitle')}</Title>

      {port && (
        <Card style={{ marginBottom: 16 }} title={<PathCrumbs path={port.path} />}>
          <Descriptions column={{ xs: 1, md: 3 }} size="small">
            <Descriptions.Item label={t('cable:detail.port')}>{port.number}</Descriptions.Item>
            <Descriptions.Item label={t('cable:detail.ifName')}>{port.ifName ?? '-'}</Descriptions.Item>
            <Descriptions.Item label={t('panel:view.type')}>{t(`panel:portTypes.${port.portType}`)}</Descriptions.Item>
            <Descriptions.Item label={t('cable:detail.adminState')}>{t(`panel:adminStates.${port.adminState}`)}</Descriptions.Item>
            <Descriptions.Item label={t('cable:detail.module')}>
              {port.opticalModule ? `${port.opticalModule.vendor} ${port.opticalModule.model} (${port.opticalModule.serialNo})` : t('cable:detail.none')}
            </Descriptions.Item>
            <Descriptions.Item label={t('cable:detail.ip')}>{port.ipAddress?.address ?? t('cable:detail.none')}</Descriptions.Item>
            <Descriptions.Item label={t('cable:detail.workstations')}>
              {port.attachedWorkstations.length ? port.attachedWorkstations.map((w) => w.name).join(', ') : t('cable:detail.none')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {cable ? (
        <>
          <Card
            style={{ marginBottom: 16 }}
            title={
              <span>
                <SwapOutlined /> {t('cable:detail.cable')}
              </span>
            }
          >
            <Descriptions column={{ xs: 1, md: 4 }} size="small">
              <Descriptions.Item label={t('cable:fields.label')}>{cable.label || '-'}</Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.type')}>
                <Tag color="blue">{t(`cable:media.${cable.medium}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.status')}>
                <Tag color={cable.state === 'IN_USE' ? 'green' : 'gold'}>{t(`cable:states.${cable.state}`)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('cable:fields.length')}>{cable.lengthM ? `${cable.lengthM} m` : '-'}</Descriptions.Item>
              {cable.color && <Descriptions.Item label={t('cable:fields.color')}>{cable.color}</Descriptions.Item>}
              {cable.notes && <Descriptions.Item label={t('cable:fields.notes')}>{cable.notes}</Descriptions.Item>}
            </Descriptions>
          </Card>
          <Row gutter={[16, 16]}>
            {ends.map((ep) => (
              <Col key={ep.id} xs={24} lg={12}>
                <EndpointCard ep={ep} highlight={!!port && ep.portId === port.id} onDisconnect={disconnect} />
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <Alert type="info" showIcon message={t('cable:detail.notConnected')} />
      )}
    </div>
  );
}
