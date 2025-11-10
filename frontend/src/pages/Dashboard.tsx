import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  CloudServerOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title } = Typography;

export default function Dashboard() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <Title level={2}>{t('title')}</Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        {t('description')}
      </p>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('statistics.totalDevices')}
              value={0}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('statistics.cableConnections')}
              value={0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('statistics.cabinetCount')}
              value={0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title={t('statistics.portOccupancy')}
              value={0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card title={t('cards.recentDevices')} bordered={false}>
            <p style={{ color: '#8c8c8c' }}>{t('emptyState')}</p>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={t('cards.cableStatus')} bordered={false}>
            <p style={{ color: '#8c8c8c' }}>{t('emptyState')}</p>
          </Card>
        </Col>
      </Row>

      <Card title={t('cards.roadmap')} style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <h4>✅ {t('roadmap.implemented')}</h4>
            <ul>
              {t('roadmap.items.implemented', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Col>
          <Col span={24}>
            <h4>🚧 {t('roadmap.inDevelopment')}</h4>
            <ul>
              {t('roadmap.items.inDevelopment', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Col>
          <Col span={24}>
            <h4>📋 {t('roadmap.planned')}</h4>
            <ul>
              {t('roadmap.items.planned', { returnObjects: true }).map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
