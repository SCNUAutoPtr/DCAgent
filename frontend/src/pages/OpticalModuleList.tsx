import { useState, useEffect } from 'react';
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
  DatePicker,
  Switch,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ToolOutlined,
  SearchOutlined,
  ExportOutlined,
  BarcodeOutlined,
} from '@ant-design/icons';
import { OpticalModule, ModuleStatus, ModuleType } from '@/types';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// 模块状态映射
const moduleStatusMap: Record<ModuleStatus, { label: string; color: string }> = {
  IN_STOCK: { label: '在库', color: 'default' },
  INSTALLED: { label: '已安装', color: 'green' },
  RESERVED: { label: '预留', color: 'blue' },
  FAULTY: { label: '故障', color: 'red' },
  SCRAPPED: { label: '已报废', color: 'gray' },
};

// 模块类型映射
const moduleTypeMap: Record<ModuleType, { label: string; speed: string }> = {
  SFP: { label: 'SFP', speed: '1G' },
  SFP_PLUS: { label: 'SFP+', speed: '10G' },
  QSFP: { label: 'QSFP', speed: '40G' },
  QSFP28: { label: 'QSFP28', speed: '100G' },
  QSFP_DD: { label: 'QSFP-DD', speed: '400G' },
};

export default function OpticalModuleList() {
  const [modules, setModules] = useState<OpticalModule[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingModule, setEditingModule] = useState<OpticalModule | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ModuleStatus>();
  const [selectedType, setSelectedType] = useState<string>();
  const [searchText, setSearchText] = useState('');
  const [statistics, setStatistics] = useState<any>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  // 加载光模块列表
  const loadModules = async (filters?: {
    status?: ModuleStatus;
    moduleType?: string;
    search?: string;
  }) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.moduleType) params.append('moduleType', filters.moduleType);
      if (filters?.search) params.append('search', filters.search);

      const response = await fetch(
        `http://localhost:3000/api/v1/optical-modules?${params.toString()}`
      );
      if (!response.ok) throw new Error('Failed to load modules');
      const data = await response.json();
      setModules(data);
    } catch (error) {
      message.error('加载光模块列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // 加载统计信息
  const loadStatistics = async () => {
    try {
      const response = await fetch(
        'http://localhost:3000/api/v1/optical-modules/statistics'
      );
      if (!response.ok) throw new Error('Failed to load statistics');
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('加载统计信息失败:', error);
    }
  };

  useEffect(() => {
    loadModules();
    loadStatistics();
  }, []);

  // 筛选处理
  const handleFilter = () => {
    loadModules({
      status: selectedStatus,
      moduleType: selectedType,
      search: searchText,
    });
  };

  // 重置筛选
  const handleResetFilter = () => {
    setSelectedStatus(undefined);
    setSelectedType(undefined);
    setSearchText('');
    loadModules();
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (module?: OpticalModule) => {
    if (module) {
      setEditingModule(module);
      form.setFieldsValue({
        ...module,
        purchaseDate: module.purchaseDate ? dayjs(module.purchaseDate) : null,
        warrantyExpiry: module.warrantyExpiry ? dayjs(module.warrantyExpiry) : null,
      });
    } else {
      setEditingModule(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingModule(null);
    form.resetFields();
  };

  // 保存光模块
  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      // 转换日期格式
      const payload = {
        ...values,
        purchaseDate: values.purchaseDate
          ? dayjs(values.purchaseDate).toISOString()
          : undefined,
        warrantyExpiry: values.warrantyExpiry
          ? dayjs(values.warrantyExpiry).toISOString()
          : undefined,
      };

      if (editingModule) {
        const response = await fetch(
          `http://localhost:3000/api/v1/optical-modules/${editingModule.id}/update`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }
        );
        if (!response.ok) throw new Error('Update failed');
        message.success('光模块更新成功');
      } else {
        const response = await fetch('http://localhost:3000/api/v1/optical-modules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Create failed');
        }
        message.success('光模块创建成功');
      }

      handleCloseModal();
      loadModules({ status: selectedStatus, moduleType: selectedType, search: searchText });
      loadStatistics();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || (editingModule ? '更新失败' : '创建失败'));
      console.error(error);
    }
  };

  // 删除光模块
  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/optical-modules/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }
      message.success('删除成功');
      loadModules({ status: selectedStatus, moduleType: selectedType, search: searchText });
      loadStatistics();
    } catch (error: any) {
      message.error(error.message || '删除失败');
      console.error(error);
    }
  };

  // 查看详情
  const handleViewDetail = (module: OpticalModule) => {
    navigate(`/optical-modules/${module.id}`);
  };

  // 表格列定义
  const columns = [
    {
      title: '序列号',
      dataIndex: 'serialNo',
      key: 'serialNo',
      width: 150,
      render: (text: string, record: OpticalModule) => (
        <Button type="link" onClick={() => handleViewDetail(record)}>
          <BarcodeOutlined /> {text}
        </Button>
      ),
    },
    {
      title: '型号',
      dataIndex: 'model',
      key: 'model',
      width: 150,
    },
    {
      title: '厂商',
      dataIndex: 'vendor',
      key: 'vendor',
      width: 120,
    },
    {
      title: '类型/速率',
      dataIndex: 'moduleType',
      key: 'moduleType',
      width: 120,
      render: (type: string) => {
        const info = moduleTypeMap[type as ModuleType];
        return (
          <Space>
            <Tag color="blue">{info?.label || type}</Tag>
            <Text type="secondary">{info?.speed}</Text>
          </Space>
        );
      },
    },
    {
      title: '波长/距离',
      key: 'specs',
      width: 150,
      render: (_: any, record: OpticalModule) => (
        <Space direction="vertical" size={0}>
          {record.wavelength && <Text type="secondary">λ: {record.wavelength}</Text>}
          {record.distance && <Text type="secondary">📏 {record.distance}</Text>}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ModuleStatus) => {
        const info = moduleStatusMap[status];
        return <Tag color={info?.color}>{info?.label}</Tag>;
      },
    },
    {
      title: '当前位置',
      key: 'location',
      width: 200,
      render: (_: any, record: OpticalModule) => {
        if (!record.currentPort) {
          return <Text type="secondary">库存</Text>;
        }
        const port = record.currentPort;
        const device = port.panel?.device;
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{device?.name || '未知设备'}</Text>
            <Text type="secondary">
              {port.panel?.name} - 端口 {port.number}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '采购信息',
      key: 'purchase',
      width: 180,
      render: (_: any, record: OpticalModule) => (
        <Space direction="vertical" size={0}>
          {record.supplier && <Text type="secondary">供应商: {record.supplier}</Text>}
          {record.price && <Text type="secondary">价格: ¥{record.price}</Text>}
          {record.purchaseDate && (
            <Text type="secondary">
              日期: {dayjs(record.purchaseDate).format('YYYY-MM-DD')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right' as const,
      render: (_: any, record: OpticalModule) => (
        <Space>
          <Button
            type="link"
            icon={<SearchOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            编辑
          </Button>
          {record.status === 'IN_STOCK' && (
            <Popconfirm
              title="确定删除该光模块吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <ToolOutlined /> 光模块管理
      </Title>

      {/* 统计信息卡片 */}
      {statistics && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总数" value={statistics.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="在库"
                value={statistics.byStatus.inStock}
                valueStyle={{ color: '#999' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="已安装"
                value={statistics.byStatus.installed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="故障"
                value={statistics.byStatus.faulty}
                valueStyle={{ color: '#ff4d4f' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 筛选和操作栏 */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={16}>
            <Col span={6}>
              <Search
                placeholder="搜索序列号、型号、厂商"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleFilter}
                enterButton
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="状态"
                style={{ width: '100%' }}
                value={selectedStatus}
                onChange={setSelectedStatus}
                allowClear
              >
                {Object.entries(moduleStatusMap).map(([key, value]) => (
                  <Option key={key} value={key}>
                    {value.label}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="模块类型"
                style={{ width: '100%' }}
                value={selectedType}
                onChange={setSelectedType}
                allowClear
              >
                {Object.entries(moduleTypeMap).map(([key, value]) => (
                  <Option key={key} value={key}>
                    {value.label} ({value.speed})
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={10}>
              <Space>
                <Button onClick={handleFilter}>应用筛选</Button>
                <Button onClick={handleResetFilter}>重置</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                  采购入库
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
      </Card>

      {/* 表格 */}
      <Card>
        <Table
          columns={columns}
          dataSource={modules}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* 创建/编辑对话框 */}
      <Modal
        title={editingModule ? '编辑光模块' : '采购入库'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="serialNo"
                label="序列号"
                rules={[{ required: true, message: '请输入序列号' }]}
              >
                <Input placeholder="输入光模块序列号" disabled={!!editingModule} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model"
                label="型号"
                rules={[{ required: true, message: '请输入型号' }]}
              >
                <Input placeholder="如 SFP-10G-LR" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="vendor"
                label="厂商"
                rules={[{ required: true, message: '请选择厂商' }]}
              >
                <Select placeholder="选择厂商">
                  <Option value="Cisco">Cisco</Option>
                  <Option value="Huawei">Huawei</Option>
                  <Option value="H3C">H3C</Option>
                  <Option value="Mellanox">Mellanox</Option>
                  <Option value="Finisar">Finisar</Option>
                  <Option value="FS">FS</Option>
                  <Option value="Other">其他</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="moduleType"
                label="模块类型"
                rules={[{ required: true, message: '请选择模块类型' }]}
              >
                <Select placeholder="选择模块类型">
                  {Object.entries(moduleTypeMap).map(([key, value]) => (
                    <Option key={key} value={key}>
                      {value.label} ({value.speed})
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="wavelength" label="波长">
                <Input placeholder="如 850nm, 1310nm" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="distance" label="传输距离">
                <Input placeholder="如 300m, 10km" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ddmSupport" label="DDM支持" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier" label="供应商">
                <Input placeholder="采购供应商" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label="采购价格">
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="单位：元"
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="purchaseDate" label="采购日期">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warrantyExpiry" label="保修到期日">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
