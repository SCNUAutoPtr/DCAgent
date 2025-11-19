import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Space,
  Typography,
  Tag,
  Row,
  Col,
  Descriptions,
  Progress,
  Tooltip,
  Divider,
  Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ipService, { IpAddress, IpSubnet } from '@/services/ipService';
import { portService } from '@/services/portService';
import { deviceService } from '@/services/deviceService';

const { Title, Text } = Typography;
const { Option } = Select;

// IP状态颜色映射
const IP_STATUS_COLORS = {
  FREE: '#52c41a',
  ALLOCATED: '#1890ff',
  RESERVED: '#faad14',
  BLOCKED: '#d9d9d9',
};

export default function SubnetDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('ip');
  const navigate = useNavigate();

  const [subnet, setSubnet] = useState<IpSubnet | null>(null);
  const [ipAddresses, setIpAddresses] = useState<IpAddress[]>([]);
  const [ports, setPorts] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [allocateModalVisible, setAllocateModalVisible] = useState(false);
  const [selectedIp, setSelectedIp] = useState<IpAddress | null>(null);
  const [form] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();

  useEffect(() => {
    if (id) {
      loadSubnet();
      loadPorts();
      loadDevices();
    }
  }, [id]);

  const loadSubnet = async () => {
    setLoading(true);
    try {
      const data = await ipService.getSubnetById(id!);
      setSubnet(data);
      setIpAddresses(data.ipAddresses || []);
    } catch (error: any) {
      message.error(t('subnet.messages.loadDetailFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPorts = async () => {
    try {
      const data = await portService.getAll();
      setPorts(data);
    } catch (error) {
      console.error('Failed to load ports:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await deviceService.getAll();
      setDevices(data);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const handleAllocate = (ip: IpAddress) => {
    setSelectedIp(ip);
    form.resetFields();
    setAllocateModalVisible(true);
  };

  const handleAllocateSubmit = async () => {
    try {
      const values = await form.validateFields();
      await ipService.allocateIp({
        ipAddressId: selectedIp!.id,
        portId: values.portId,
        deviceId: values.deviceId,
        hostname: values.hostname,
        macAddress: values.macAddress,
        description: values.description,
      });
      message.success(t('ipAddress.messages.allocateSuccess'));
      setAllocateModalVisible(false);
      loadSubnet();
    } catch (error: any) {
      message.error(t('ipAddress.messages.allocateFailed') + ': ' + error.message);
    }
  };

  const handleRelease = async (ipId: string) => {
    try {
      await ipService.releaseIp(ipId);
      message.success(t('ipAddress.messages.releaseSuccess'));
      loadSubnet();
    } catch (error: any) {
      message.error(t('ipAddress.messages.releaseFailed') + ': ' + error.message);
    }
  };

  const getStatusTag = (status: string) => {
    const colorMap: Record<string, string> = {
      FREE: 'success',
      ALLOCATED: 'processing',
      RESERVED: 'warning',
      BLOCKED: 'default',
    };
    return (
      <Tag color={colorMap[status] || 'default'}>
        {t(`ipAddress.status.${status}`)}
      </Tag>
    );
  };

  const filteredIpAddresses = ipAddresses.filter((ip) => {
    const matchesSearch = !searchText ||
      ip.address.includes(searchText) ||
      ip.hostname?.includes(searchText) ||
      ip.macAddress?.includes(searchText);
    const matchesStatus = !statusFilter || ip.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    {
      title: t('ipAddress.fields.address'),
      dataIndex: 'address',
      key: 'address',
      render: (text: string) => <Text code>{text}</Text>,
      sorter: (a: IpAddress, b: IpAddress) => {
        const aNum = a.address.split('.').map((n: string) => parseInt(n)).reduce((acc: number, n: number) => acc * 256 + n, 0);
        const bNum = b.address.split('.').map((n: string) => parseInt(n)).reduce((acc: number, n: number) => acc * 256 + n, 0);
        return aNum - bNum;
      },
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: t('ipAddress.fields.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
      filters: [
        { text: t('ipAddress.status.FREE'), value: 'FREE' },
        { text: t('ipAddress.status.ALLOCATED'), value: 'ALLOCATED' },
        { text: t('ipAddress.status.RESERVED'), value: 'RESERVED' },
        { text: t('ipAddress.status.BLOCKED'), value: 'BLOCKED' },
      ],
      onFilter: (value: any, record: IpAddress) => record.status === value,
    },
    {
      title: t('ipAddress.fields.hostname'),
      dataIndex: 'hostname',
      key: 'hostname',
      render: (text: string) => text || '-',
    },
    {
      title: t('ipAddress.fields.macAddress'),
      dataIndex: 'macAddress',
      key: 'macAddress',
      render: (text: string) => text ? <Text code>{text}</Text> : '-',
    },
    {
      title: t('ipAddress.fields.bindingTarget'),
      key: 'binding',
      render: (record: IpAddress) => {
        if (record.port) {
          return (
            <Tooltip title={`面板: ${record.port.panel?.name || '-'}`}>
              <Tag color="blue">端口: {record.port.label || record.port.number}</Tag>
            </Tooltip>
          );
        }
        if (record.device) {
          return (
            <Tag color="green">设备: {record.device.name}</Tag>
          );
        }
        return '-';
      },
    },
    {
      title: t('ipAddress.fields.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '-',
    },
    {
      title: t('buttons.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 150,
      render: (record: IpAddress) => {
        if (record.status === 'FREE') {
          return (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              onClick={() => handleAllocate(record)}
            >
              {t('buttons.allocate')}
            </Button>
          );
        }
        if (record.status === 'ALLOCATED') {
          return (
            <Popconfirm
              title={t('ipAddress.messages.releaseConfirm')}
              onConfirm={() => handleRelease(record.id)}
              okText={t('buttons.confirm')}
              cancelText={t('buttons.cancel')}
            >
              <Button size="small" danger>
                {t('buttons.release')}
              </Button>
            </Popconfirm>
          );
        }
        return '-';
      },
    },
  ];

  if (!subnet) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  const utilizationRate = parseFloat(subnet.stats?.utilizationRate || '0');

  return (
    <div style={{ padding: '24px' }}>
      {/* 标题和返回按钮 */}
      <Space style={{ marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/ip-management')}>
          {t('buttons.back')}
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          {subnet.name}
        </Title>
      </Space>

      {/* 子网信息卡片 */}
      <Card title={t('subnet.detailTitle')} style={{ marginBottom: 24 }}>
        <Descriptions column={3} bordered>
          <Descriptions.Item label={t('subnet.fields.network')}>
            <Text code>{subnet.network}/{subnet.cidr}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('subnet.fields.gateway')}>
            {subnet.gateway ? <Text code>{subnet.gateway}</Text> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('subnet.fields.vlan')}>
            {subnet.vlan ? <Tag color="blue">{subnet.vlan}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('subnet.fields.room')}>
            {subnet.room ? `${subnet.room.name} (${subnet.room.dataCenter?.name})` : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('subnet.fields.dnsServers')}>
            {subnet.dnsServers && subnet.dnsServers.length > 0
              ? subnet.dnsServers.map((dns: string) => <Tag key={dns}>{dns}</Tag>)
              : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('subnet.fields.description')}>
            {subnet.description || '-'}
          </Descriptions.Item>
        </Descriptions>

        <Divider />

        {/* 使用率统计 */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">{t('subnet.fields.totalIps')}</Text>
                <Title level={3} style={{ margin: '8px 0' }}>{subnet.stats?.total || 0}</Title>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">{t('subnet.fields.freeIps')}</Text>
                <Title level={3} style={{ margin: '8px 0', color: '#52c41a' }}>
                  {subnet.stats?.free || 0}
                </Title>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">{t('subnet.fields.allocatedIps')}</Text>
                <Title level={3} style={{ margin: '8px 0', color: '#1890ff' }}>
                  {subnet.stats?.allocated || 0}
                </Title>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary">{t('subnet.fields.utilizationRate')}</Text>
                <Title level={3} style={{ margin: '8px 0' }}>{utilizationRate.toFixed(2)}%</Title>
                <Progress
                  percent={utilizationRate}
                  showInfo={false}
                  strokeColor={utilizationRate > 80 ? '#ff4d4f' : '#52c41a'}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </Card>

      {/* IP地址列表 */}
      <Card
        title={t('ipAddress.title')}
        extra={
          <Space>
            <Input.Search
              placeholder={t('ipAddress.placeholders.search')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder={t('filters.status')}
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 120 }}
              allowClear
            >
              <Option value="FREE">{t('ipAddress.status.FREE')}</Option>
              <Option value="ALLOCATED">{t('ipAddress.status.ALLOCATED')}</Option>
              <Option value="RESERVED">{t('ipAddress.status.RESERVED')}</Option>
              <Option value="BLOCKED">{t('ipAddress.status.BLOCKED')}</Option>
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadSubnet}>
              {t('buttons.refresh')}
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredIpAddresses}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 个IP地址`,
            pageSize: 50,
          }}
          locale={{
            emptyText: t('noData.noIpAddresses'),
          }}
        />
      </Card>

      {/* 分配IP模态框 */}
      <Modal
        title={`${t('ipAddress.allocate')} - ${selectedIp?.address}`}
        open={allocateModalVisible}
        onOk={handleAllocateSubmit}
        onCancel={() => setAllocateModalVisible(false)}
        width={600}
        okText={t('buttons.allocate')}
        cancelText={t('buttons.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('ipAddress.fields.bindingType')}
            required
            help={t('ipAddress.messages.selectBindingTarget')}
          >
            <Space>
              <Text type="secondary">选择端口或设备（二选一）</Text>
            </Space>
          </Form.Item>

          <Form.Item
            label={t('ipAddress.fields.port')}
            name="portId"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value && !getFieldValue('deviceId')) {
                    return Promise.reject(new Error(t('ipAddress.validation.bindingTargetRequired')));
                  }
                  if (value && getFieldValue('deviceId')) {
                    return Promise.reject(new Error(t('ipAddress.messages.cannotBindBoth')));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Select
              showSearch
              placeholder={t('ipAddress.placeholders.selectPort')}
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {ports.map((port) => (
                <Option key={port.id} value={port.id}>
                  {port.panel?.name || 'Unknown Panel'} - {port.label || port.number}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label={t('ipAddress.fields.device')}
            name="deviceId"
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value && !getFieldValue('portId')) {
                    return Promise.reject(new Error(t('ipAddress.validation.bindingTargetRequired')));
                  }
                  if (value && getFieldValue('portId')) {
                    return Promise.reject(new Error(t('ipAddress.messages.cannotBindBoth')));
                  }
                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Select
              showSearch
              placeholder={t('ipAddress.placeholders.selectDevice')}
              optionFilterProp="children"
              filterOption={(input, option: any) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {devices.map((device) => (
                <Option key={device.id} value={device.id}>
                  {device.name} ({device.type})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item label={t('ipAddress.fields.hostname')} name="hostname">
            <Input placeholder={t('ipAddress.placeholders.hostname')} />
          </Form.Item>

          <Form.Item
            label={t('ipAddress.fields.macAddress')}
            name="macAddress"
            rules={[
              { pattern: /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, message: t('ipAddress.validation.invalidMacAddress') },
            ]}
          >
            <Input placeholder={t('ipAddress.placeholders.macAddress')} />
          </Form.Item>

          <Form.Item label={t('ipAddress.fields.description')} name="description">
            <Input.TextArea rows={3} placeholder={t('ipAddress.placeholders.description')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
