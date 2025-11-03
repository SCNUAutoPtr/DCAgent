import { Card, Row, Col, Statistic, Typography } from 'antd';
import {
  CloudServerOutlined,
  ApiOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

export default function Dashboard() {
  return (
    <div>
      <Title level={2}>系统概览</Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        数据中心全生命周期管理 - 设备、线缆、连接关系一览无余
      </p>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="设备总数"
              value={0}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="线缆连接"
              value={0}
              prefix={<ApiOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="机柜数量"
              value={0}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="端口占用率"
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
          <Card title="最近添加的设备" bordered={false}>
            <p style={{ color: '#8c8c8c' }}>暂无数据</p>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="线缆连接状态" bordered={false}>
            <p style={{ color: '#8c8c8c' }}>暂无数据</p>
          </Card>
        </Col>
      </Row>

      <Card title="功能路线图" style={{ marginTop: 24 }}>
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <h4>✅ 已实现</h4>
            <ul>
              <li>设备管理（数据中心 → 机房 → 机柜 → 设备）</li>
              <li>线缆连接跟踪（端口到端口）</li>
              <li>图数据库集成（Neo4j）</li>
            </ul>
          </Col>
          <Col span={24}>
            <h4>🚧 开发中</h4>
            <ul>
              <li>U位详细管理和可视化</li>
              <li>IP地址管理和端口映射</li>
              <li>电源管理（Phase、市电/UPS）</li>
              <li>网状拓扑图可视化</li>
            </ul>
          </Col>
          <Col span={24}>
            <h4>📋 计划中</h4>
            <ul>
              <li>SNMP/IPMI 监控集成</li>
              <li>设备健康追踪</li>
              <li>资产盘点功能</li>
              <li>AI 优化布局建议</li>
              <li>二维码/RFID 标签管理</li>
            </ul>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
