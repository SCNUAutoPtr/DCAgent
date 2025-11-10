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

// 获取模块状态映射的函数
const getModuleStatusMap = (t: any): Record<ModuleStatus, { label: string; color: string }> => ({
  IN_STOCK: { label: t('moduleStatus.IN_STOCK'), color: 'default' },
  INSTALLED: { label: t('moduleStatus.INSTALLED'), color: 'green' },
  RESERVED: { label: t('moduleStatus.RESERVED'), color: 'blue' },
  FAULTY: { label: t('moduleStatus.FAULTY'), color: 'red' },
  SCRAPPED: { label: t('moduleStatus.SCRAPPED'), color: 'gray' },
});

// 获取模块类型映射的函数
const getModuleTypeMap = (t: any): Record<ModuleType, { label: string; speed: string }> => {
  const speeds: Record<ModuleType, string> = {
    SFP: '1G',
    SFP_PLUS: '10G',
    QSFP: '40G',
    QSFP28: '100G',
    QSFP_DD: '400G',
  };

  return {
    SFP: { label: t('moduleTypes.SFP'), speed: speeds.SFP },
    SFP_PLUS: { label: t('moduleTypes.SFP_PLUS'), speed: speeds.SFP_PLUS },
    QSFP: { label: t('moduleTypes.QSFP'), speed: speeds.QSFP },
    QSFP28: { label: t('moduleTypes.QSFP28'), speed: speeds.QSFP28 },
    QSFP_DD: { label: t('moduleTypes.QSFP_DD'), speed: speeds.QSFP_DD },
  };
};

export default function OpticalModuleList() {
  const { t } = useTranslation('opticalModule');
  const moduleStatusMap = getModuleStatusMap(t);
  const moduleTypeMap = getModuleTypeMap(t);

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
      message.error(t('messages.loadFailed'));
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
      console.error(t('messages.loadFailed'), error);
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
        message.success(t('messages.updateSuccess'));
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
        message.success(t('messages.createSuccess'));
      }

      handleCloseModal();
      loadModules({ status: selectedStatus, moduleType: selectedType, search: searchText });
      loadStatistics();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.message || (editingModule ? t('messages.updateFailed') : t('messages.createFailed')));
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
      message.success(t('messages.deleteSuccess'));
      loadModules({ status: selectedStatus, moduleType: selectedType, search: searchText });
      loadStatistics();
    } catch (error: any) {
      message.error(error.message || t('messages.deleteFailed'));
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
      title: t('fields.serialNo'),
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
      title: t('fields.model'),
      dataIndex: 'model',
      key: 'model',
      width: 150,
    },
    {
      title: t('fields.vendor'),
      dataIndex: 'vendor',
      key: 'vendor',
      width: 120,
    },
    {
      title: t('fields.moduleType'),
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
      title: t('fields.wavelength') + '/' + t('fields.distance'),
      key: 'specs',
      width: 150,
      render: (_: any, record: OpticalModule) => (
        <Space direction="vertical" size={0}>
          {record.wavelength && <Text type="secondary">λ: {record.wavelength}</Text>}
          {record.distance && <Text type="secondary">{record.distance}</Text>}
        </Space>
      ),
    },
    {
      title: t('fields.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ModuleStatus) => {
        const info = moduleStatusMap[status];
        return <Tag color={info?.color}>{info?.label}</Tag>;
      },
    },
    {
      title: t('fields.currentPort'),
      key: 'location',
      width: 200,
      render: (_: any, record: OpticalModule) => {
        if (!record.currentPort) {
          return <Text type="secondary">{t('noData.noLocation')}</Text>;
        }
        const port = record.currentPort;
        const device = port.panel?.device;
        return (
          <Space direction="vertical" size={0}>
            <Text strong>{device?.name || t('noData.moduleNotFound')}</Text>
            <Text type="secondary">
              {port.panel?.name} - {t('fields.currentPort')} {port.number}
            </Text>
          </Space>
        );
      },
    },
    {
      title: t('fields.purchaseInfo'),
      key: 'purchase',
      width: 180,
      render: (_: any, record: OpticalModule) => (
        <Space direction="vertical" size={0}>
          {record.supplier && <Text type="secondary">{t('fields.supplier')}: {record.supplier}</Text>}
          {record.price && <Text type="secondary">{t('fields.price')}: {record.price}</Text>}
          {record.purchaseDate && (
            <Text type="secondary">
              {t('fields.purchaseDate')}: {dayjs(record.purchaseDate).format('YYYY-MM-DD')}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: t('fields.actions'),
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
            {t('buttons.viewDetail')}
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            {t('buttons.edit')}
          </Button>
          {record.status === 'IN_STOCK' && (
            <Popconfirm
              title={t('messages.deleteConfirm')}
              onConfirm={() => handleDelete(record.id)}
              okText={t('buttons.confirm')}
              cancelText={t('buttons.cancel')}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                {t('buttons.delete')}
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
        <ToolOutlined /> {t('title')}
      </Title>

      {/* 统计信息卡片 */}
      {statistics && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title={t('statistics.total')} value={statistics.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.inStock')}
                value={statistics.byStatus.inStock}
                valueStyle={{ color: '#999' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.installed')}
                value={statistics.byStatus.installed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title={t('statistics.faulty')}
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
                placeholder={t('filters.search')}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleFilter}
                enterButton
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder={t('filters.status')}
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
                placeholder={t('filters.moduleType')}
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
                <Button onClick={handleFilter}>{t('filters.applyFilter')}</Button>
                <Button onClick={handleResetFilter}>{t('filters.reset')}</Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                  {t('buttons.create')}
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
            showTotal: (total) => `${t('statistics.total')} ${total}`,
          }}
        />
      </Card>

      {/* 创建/编辑对话框 */}
      <Modal
        title={editingModule ? t('editTitle') : t('createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        width={800}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="serialNo"
                label={t('fields.serialNo')}
                rules={[{ required: true, message: t('validation.serialNoRequired') }]}
              >
                <Input placeholder={t('placeholders.serialNo')} disabled={!!editingModule} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="model"
                label={t('fields.model')}
                rules={[{ required: true, message: t('validation.modelRequired') }]}
              >
                <Input placeholder={t('placeholders.model')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="vendor"
                label={t('fields.vendor')}
                rules={[{ required: true, message: t('validation.vendorRequired') }]}
              >
                <Select placeholder={t('placeholders.vendor')}>
                  <Option value="Cisco">Cisco</Option>
                  <Option value="Huawei">Huawei</Option>
                  <Option value="H3C">H3C</Option>
                  <Option value="Mellanox">Mellanox</Option>
                  <Option value="Finisar">Finisar</Option>
                  <Option value="FS">FS</Option>
                  <Option value="Other">{t('placeholders.vendor')}</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="moduleType"
                label={t('fields.moduleType')}
                rules={[{ required: true, message: t('validation.moduleTypeRequired') }]}
              >
                <Select placeholder={t('placeholders.moduleType')}>
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
              <Form.Item name="wavelength" label={t('fields.wavelength')}>
                <Input placeholder={t('placeholders.wavelength')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="distance" label={t('fields.distance')}>
                <Input placeholder={t('placeholders.distance')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="ddmSupport" label={t('fields.ddmSupport')} valuePropName="checked">
            <Switch />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="supplier" label={t('fields.supplier')}>
                <Input placeholder={t('placeholders.supplier')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price" label={t('fields.price')}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('placeholders.price')}
                  min={0}
                  precision={2}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="purchaseDate" label={t('fields.purchaseDate')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="warrantyExpiry" label={t('fields.warranty')}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label={t('fields.notes')}>
            <Input.TextArea rows={3} placeholder={t('placeholders.notes')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
