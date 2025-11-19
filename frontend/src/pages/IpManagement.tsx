import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Space,
  Popconfirm,
  Typography,
  Tag,
  Row,
  Col,
  Statistic,
  Switch,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  CalculatorOutlined,
  EyeOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ipService, { IpSubnet, CreateSubnetDto } from '@/services/ipService';
import { roomService } from '@/services/roomService';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

export default function IpManagement() {
  const { t } = useTranslation('ip');
  const navigate = useNavigate();

  const [subnets, setSubnets] = useState<IpSubnet[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<IpSubnet | null>(null);
  const [statistics, setStatistics] = useState<any>(null);
  const [calculatorVisible, setCalculatorVisible] = useState(false);
  const [calculationResult, setCalculationResult] = useState<any>(null);
  const [form] = Form.useForm();
  const [calcForm] = Form.useForm();

  // 搜索和筛选
  const [searchText, setSearchText] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>();
  const [selectedVlan, setSelectedVlan] = useState<string>();

  useEffect(() => {
    loadSubnets();
    loadRooms();
    loadStatistics();
  }, []);

  const loadSubnets = async (filters?: { roomId?: string; vlan?: string; search?: string }) => {
    setLoading(true);
    try {
      const data = await ipService.getSubnets(filters);
      setSubnets(data);
    } catch (error: any) {
      message.error(t('subnet.messages.loadFailed') + ': ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRooms = async () => {
    try {
      const data = await roomService.getAll();
      setRooms(data);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await ipService.getSubnetStatistics();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  const handleSearch = () => {
    loadSubnets({
      roomId: selectedRoom,
      vlan: selectedVlan,
      search: searchText,
    });
  };

  const handleReset = () => {
    setSearchText('');
    setSelectedRoom(undefined);
    setSelectedVlan(undefined);
    loadSubnets();
  };

  const handleCreate = () => {
    setEditingSubnet(null);
    form.resetFields();
    form.setFieldsValue({ autoGenerateIps: true, cidr: 24 });
    setModalVisible(true);
  };

  const handleEdit = (subnet: IpSubnet) => {
    setEditingSubnet(subnet);
    form.setFieldsValue({
      name: subnet.name,
      network: subnet.network,
      cidr: subnet.cidr,
      gateway: subnet.gateway,
      vlan: subnet.vlan,
      dnsServers: subnet.dnsServers?.join(', '),
      description: subnet.description,
      roomId: subnet.roomId,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await ipService.deleteSubnet(id);
      message.success(t('subnet.messages.deleteSuccess'));
      loadSubnets();
      loadStatistics();
    } catch (error: any) {
      message.error(t('subnet.messages.deleteFailed') + ': ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 处理DNS服务器（从逗号分隔的字符串转为数组）
      const dnsServers = values.dnsServers
        ? values.dnsServers.split(',').map((s: string) => s.trim()).filter((s: string) => s)
        : undefined;

      if (editingSubnet) {
        // 更新子网
        await ipService.updateSubnet(editingSubnet.id, {
          name: values.name,
          gateway: values.gateway,
          vlan: values.vlan,
          dnsServers,
          description: values.description,
          roomId: values.roomId || undefined,
        });
        message.success(t('subnet.messages.updateSuccess'));
      } else {
        // 创建子网
        const createData: CreateSubnetDto = {
          name: values.name,
          network: values.network,
          cidr: values.cidr,
          gateway: values.gateway,
          vlan: values.vlan,
          dnsServers,
          description: values.description,
          roomId: values.roomId || undefined,
          autoGenerateIps: values.autoGenerateIps !== false,
          reservedIps: values.gateway ? [values.gateway] : [],
        };
        await ipService.createSubnet(createData);
        message.success(t('subnet.messages.createSuccess'));
      }

      setModalVisible(false);
      loadSubnets();
      loadStatistics();
    } catch (error: any) {
      const errorMsg = editingSubnet
        ? t('subnet.messages.updateFailed')
        : t('subnet.messages.createFailed');
      message.error(errorMsg + ': ' + error.message);
    }
  };

  const handleCalculate = async () => {
    try {
      const values = await calcForm.validateFields();
      const result = await ipService.calculateSubnet(values.network, values.cidr);
      setCalculationResult(result);
    } catch (error: any) {
      message.error('计算失败: ' + error.message);
    }
  };

  const columns = [
    {
      title: t('subnet.fields.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: IpSubnet) => (
        <Button type="link" onClick={() => navigate(`/ip-management/subnet/${record.id}`)}>
          {text}
        </Button>
      ),
    },
    {
      title: t('subnet.fields.network'),
      key: 'network',
      render: (record: IpSubnet) => `${record.network}/${record.cidr}`,
    },
    {
      title: t('subnet.fields.gateway'),
      dataIndex: 'gateway',
      key: 'gateway',
      render: (text: string) => text || '-',
    },
    {
      title: t('subnet.fields.vlan'),
      dataIndex: 'vlan',
      key: 'vlan',
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: t('subnet.fields.room'),
      key: 'room',
      render: (record: IpSubnet) => record.room?.name || '-',
    },
    {
      title: t('subnet.fields.totalIps'),
      key: 'totalIps',
      align: 'right' as const,
      render: (record: IpSubnet) => record.stats?.total || 0,
    },
    {
      title: t('subnet.fields.freeIps'),
      key: 'freeIps',
      align: 'right' as const,
      render: (record: IpSubnet) => (
        <Text type="success">{record.stats?.free || 0}</Text>
      ),
    },
    {
      title: t('subnet.fields.allocatedIps'),
      key: 'allocatedIps',
      align: 'right' as const,
      render: (record: IpSubnet) => (
        <Text type="warning">{record.stats?.allocated || 0}</Text>
      ),
    },
    {
      title: t('subnet.fields.utilizationRate'),
      key: 'utilizationRate',
      align: 'right' as const,
      render: (record: IpSubnet) => `${record.stats?.utilizationRate || '0.00'}%`,
    },
    {
      title: t('subnet.fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: t('buttons.actions'),
      key: 'actions',
      fixed: 'right' as const,
      width: 200,
      render: (record: IpSubnet) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/ip-management/subnet/${record.id}`)}
          >
            {t('buttons.viewDetail')}
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title={t('subnet.messages.deleteConfirm')}
            description={t('subnet.messages.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
          >
            <Button type="link" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{t('title')}</Title>
      <Text type="secondary">{t('description')}</Text>

      {/* 统计卡片 */}
      {statistics && (
        <Row gutter={16} style={{ marginTop: 24, marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.totalSubnets')}
                value={statistics.totalSubnets}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.totalIps')}
                value={statistics.totalIps}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.freeIps')}
                value={statistics.byStatus.free}
                valueStyle={{ color: '#3f8600' }}
                suffix="个"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.utilizationRate')}
                value={parseFloat(statistics.utilizationRate)}
                precision={2}
                suffix="%"
                valueStyle={{ color: parseFloat(statistics.utilizationRate) > 80 ? '#cf1322' : '#3f8600' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选和操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space wrap>
            <Search
              placeholder={t('subnet.placeholders.search')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 250 }}
              allowClear
            />
            <Select
              placeholder={t('filters.room')}
              value={selectedRoom}
              onChange={setSelectedRoom}
              style={{ width: 150 }}
              allowClear
            >
              {rooms.map((room) => (
                <Option key={room.id} value={room.id}>
                  {room.name}
                </Option>
              ))}
            </Select>
            <Input
              placeholder={t('filters.vlan')}
              value={selectedVlan}
              onChange={(e) => setSelectedVlan(e.target.value)}
              style={{ width: 120 }}
              allowClear
            />
            <Button onClick={handleSearch} icon={<SearchOutlined />}>
              {t('filters.applyFilter')}
            </Button>
            <Button onClick={handleReset}>
              {t('filters.reset')}
            </Button>
          </Space>
          <Space>
            <Button
              icon={<CalculatorOutlined />}
              onClick={() => setCalculatorVisible(true)}
            >
              {t('subnet.calculation.title')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              {t('buttons.createSubnet')}
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => { loadSubnets(); loadStatistics(); }}>
              {t('buttons.refresh')}
            </Button>
          </Space>
        </Space>
      </Card>

      {/* 子网列表 */}
      <Card>
        <Table
          columns={columns}
          dataSource={subnets}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1400 }}
          locale={{
            emptyText: t('noData.noSubnets'),
          }}
        />
      </Card>

      {/* 创建/编辑子网模态框 */}
      <Modal
        title={editingSubnet ? t('subnet.editTitle') : t('subnet.createTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('subnet.fields.name')}
            name="name"
            rules={[{ required: true, message: t('subnet.validation.nameRequired') }]}
          >
            <Input placeholder={t('subnet.placeholders.name')} />
          </Form.Item>

          {!editingSubnet && (
            <>
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    label={t('subnet.fields.network')}
                    name="network"
                    rules={[
                      { required: true, message: t('subnet.validation.networkRequired') },
                      { pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, message: t('subnet.validation.invalidNetwork') },
                    ]}
                  >
                    <Input placeholder={t('subnet.placeholders.network')} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    label={t('subnet.fields.cidr')}
                    name="cidr"
                    rules={[
                      { required: true, message: t('subnet.validation.cidrRequired') },
                      { type: 'number', min: 0, max: 32, message: t('subnet.validation.invalidCidr') },
                    ]}
                  >
                    <InputNumber placeholder={t('subnet.placeholders.cidr')} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label={t('subnet.fields.autoGenerateIps')}
                name="autoGenerateIps"
                valuePropName="checked"
              >
                <Switch defaultChecked />
              </Form.Item>
            </>
          )}

          <Form.Item
            label={t('subnet.fields.gateway')}
            name="gateway"
            rules={[
              { pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, message: t('subnet.validation.invalidGateway') },
            ]}
          >
            <Input placeholder={t('subnet.placeholders.gateway')} />
          </Form.Item>

          <Form.Item label={t('subnet.fields.vlan')} name="vlan">
            <Input placeholder={t('subnet.placeholders.vlan')} />
          </Form.Item>

          <Form.Item label={t('subnet.fields.dnsServers')} name="dnsServers">
            <Input placeholder={t('subnet.placeholders.dnsServers')} />
          </Form.Item>

          <Form.Item label={t('subnet.fields.room')} name="roomId">
            <Select placeholder="选择机房" allowClear>
              {rooms.map((room) => (
                <Option key={room.id} value={room.id}>
                  {room.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label={t('subnet.fields.description')} name="description">
            <TextArea
              rows={3}
              placeholder={t('subnet.placeholders.description')}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 子网计算器模态框 */}
      <Modal
        title={t('subnet.calculation.title')}
        open={calculatorVisible}
        onCancel={() => {
          setCalculatorVisible(false);
          setCalculationResult(null);
          calcForm.resetFields();
        }}
        footer={[
          <Button key="close" onClick={() => setCalculatorVisible(false)}>
            {t('buttons.cancel')}
          </Button>,
        ]}
        width={700}
      >
        <Form form={calcForm} layout="inline" style={{ marginBottom: 24 }}>
          <Form.Item
            name="network"
            rules={[
              { required: true, message: t('subnet.validation.networkRequired') },
              { pattern: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, message: t('subnet.validation.invalidNetwork') },
            ]}
          >
            <Input placeholder={t('subnet.placeholders.network')} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item
            name="cidr"
            rules={[
              { required: true, message: t('subnet.validation.cidrRequired') },
              { type: 'number', min: 0, max: 32, message: t('subnet.validation.invalidCidr') },
            ]}
          >
            <InputNumber placeholder={t('subnet.placeholders.cidr')} style={{ width: 100 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleCalculate} icon={<CalculatorOutlined />}>
              {t('subnet.calculation.calculate')}
            </Button>
          </Form.Item>
        </Form>

        {calculationResult && (
          <Card>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.networkAddress')}: </Text>
                <Text code>{calculationResult.networkAddress}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.broadcastAddress')}: </Text>
                <Text code>{calculationResult.broadcastAddress}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.fields.subnetMask')}: </Text>
                <Text code>{calculationResult.subnetMask}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.wildcardMask')}: </Text>
                <Text code>{calculationResult.wildcardMask}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.firstUsableIp')}: </Text>
                <Text code>{calculationResult.firstUsableIp}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.lastUsableIp')}: </Text>
                <Text code>{calculationResult.lastUsableIp}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.totalHosts')}: </Text>
                <Text>{calculationResult.totalHosts}</Text>
              </Col>
              <Col span={12}>
                <Text strong>{t('subnet.calculation.usableHosts')}: </Text>
                <Text>{calculationResult.usableHosts}</Text>
              </Col>
            </Row>
          </Card>
        )}
      </Modal>
    </div>
  );
}
