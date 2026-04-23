import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  Popconfirm,
  Typography,
  Tag,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { Panel, PanelType, Device } from '@/types';
import { panelService } from '@/services/panelService';
import { deviceService } from '@/services/deviceService';
import { ShortIdFormatter } from '@/utils/shortIdFormatter';
import { shortIdPoolService } from '@/services/shortIdPoolService';

const { Title, Text } = Typography;
const { Search } = Input;
const { Option } = Select;

// 面板类型颜色映射
const panelTypeColorMap: Record<PanelType, string> = {
  NETWORK: 'blue',
  POWER: 'red',
  CONSOLE: 'orange',
  USB: 'purple',
  MIXED: 'cyan',
  OTHER: 'default',
};

export default function PanelList() {
  const { t } = useTranslation('panel');
  const [panels, setPanels] = useState<Panel[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string>();
  const [selectedType, setSelectedType] = useState<PanelType>();
  const [shortIdChecking, setShortIdChecking] = useState(false);
  const [form] = Form.useForm();

  // 加载设备列表
  const loadDevices = async () => {
    try {
      const data = await deviceService.getAll();
      setDevices(data);
    } catch (error) {
      console.error(error);
    }
  };

  // 加载面板列表
  const loadPanels = async (searchQuery?: string, deviceId?: string, type?: PanelType) => {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await panelService.search(searchQuery);
      } else if (deviceId) {
        data = await panelService.getByDevice(deviceId);
      } else if (type) {
        data = await panelService.getByType(type);
      } else {
        data = await panelService.getAll();
      }
      setPanels(data);
    } catch (error) {
      message.error(t('messages.loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    loadPanels();
  }, []);

  // 打开创建/编辑对话框
  const handleOpenModal = (panel?: Panel) => {
    if (panel) {
      setEditingPanel(panel);
      form.setFieldsValue(panel);
    } else {
      setEditingPanel(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingPanel(null);
    form.resetFields();
  };

  // 保存面板
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingPanel) {
        await panelService.update(editingPanel.id, values);
        message.success(t('messages.updateSuccess'));
      } else {
        await panelService.create(values);
        message.success(t('messages.createSuccess'));
      }
      handleCloseModal();
      loadPanels(undefined, selectedDevice, selectedType);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingPanel ? t('messages.updateFailed') : t('messages.createFailed'));
      console.error(error);
    }
  };

  // 删除面板
  const handleDelete = async (id: string) => {
    try {
      await panelService.delete(id);
      message.success(t('messages.deleteSuccess'));
      loadPanels(undefined, selectedDevice, selectedType);
    } catch (error) {
      message.error(t('messages.deleteFailed'));
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadPanels(value);
  };

  // 按设备过滤
  const handleDeviceFilter = (value: string) => {
    setSelectedDevice(value);
    loadPanels(undefined, value);
  };

  // 按类型过滤
  const handleTypeFilter = (value: PanelType) => {
    setSelectedType(value);
    loadPanels(undefined, undefined, value);
  };

  // 验证shortID是否可用
  const validateShortId = async (_: any, value: number) => {
    if (!value) {
      return Promise.reject('请输入shortID');
    }

    // 如果是编辑模式且shortID未改变，跳过验证
    if (editingPanel && editingPanel.shortId === value) {
      return Promise.resolve();
    }

    setShortIdChecking(true);
    try {
      const result = await shortIdPoolService.checkShortIdExists(value);
      if (result.exists) {
        return Promise.reject(`shortID已被占用: ${result.usedBy === 'pool' ? '在标签池中' : '已绑定到实体'}`);
      }
      return Promise.resolve();
    } catch (error) {
      return Promise.reject('验证失败');
    } finally {
      setShortIdChecking(false);
    }
  };

  const columns = [
    {
      title: t('fields.shortId'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 120,
      render: (shortId: number | undefined) =>
        shortId ? <Text code>{ShortIdFormatter.toDisplayFormat(shortId)}</Text> : '-',
    },
    {
      title: t('fields.name'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('fields.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: PanelType) => {
        const color = panelTypeColorMap[type];
        return <Tag color={color}>{t(`panelTypes.${type}`)}</Tag>;
      },
    },
    {
      title: t('fields.device'),
      dataIndex: 'deviceId',
      key: 'deviceId',
      render: (deviceId: string) => {
        const device = devices.find((d) => d.id === deviceId);
        return device ? <Tag color="green">{device.name}</Tag> : '-';
      },
    },
    {
      title: t('fields.portCount'),
      dataIndex: 'ports',
      key: 'ports',
      render: (ports: any[]) => ports?.length || 0,
    },
    {
      title: t('fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: t('fields.actions'),
      key: 'actions',
      width: 150,
      render: (_: any, record: Panel) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            data-testid="panel-edit-btn"
          >
            {t('buttons.edit')}
          </Button>
          <Popconfirm
            title={t('messages.deleteConfirm')}
            description={t('messages.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
            okButtonProps={{ 'data-testid': 'panel-delete-confirm-btn' } as any}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />} data-testid="panel-delete-btn">
              {t('buttons.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={2}>
        <ApartmentOutlined /> {t('title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        {t('description')}
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()} data-testid="panel-create-btn">
              {t('buttons.create')}
            </Button>
            <Select
              placeholder={t('filters.selectDevice')}
              allowClear
              style={{ width: 200 }}
              onChange={handleDeviceFilter}
              onClear={() => {
                setSelectedDevice(undefined);
                loadPanels();
              }}
            >
              {devices.map((device) => (
                <Option key={device.id} value={device.id}>
                  {device.name}
                </Option>
              ))}
            </Select>
            <Select
              placeholder={t('filters.selectType')}
              allowClear
              style={{ width: 120 }}
              onChange={handleTypeFilter}
              onClear={() => {
                setSelectedType(undefined);
                loadPanels();
              }}
            >
              {Object.entries(panelTypeColorMap).map(([key]) => (
                <Option key={key} value={key}>
                  {t(`panelTypes.${key}`)}
                </Option>
              ))}
            </Select>
          </Space>
          <Search
            placeholder={t('placeholders.search')}
            allowClear
            onSearch={handleSearch}
            style={{ width: 300 }}
          />
        </Space>

        <Table
          columns={columns}
          dataSource={panels}
          loading={loading}
          rowKey="id"
          data-testid="panel-table"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('table.total', { total }),
          }}
        />
      </Card>

      <Modal
        title={editingPanel ? t('editTitle') : t('createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
        okButtonProps={{ 'data-testid': 'panel-save-btn' } as any}
        wrapProps={{ 'data-testid': 'panel-modal' }}
      >
        <Form form={form} layout="vertical" data-testid="panel-form">
          <Form.Item
            name="shortId"
            label={
              <Space>
                <ScanOutlined />
                ShortID
              </Space>
            }
            rules={[
              { required: true, message: '请输入shortID' },
              { validator: validateShortId },
            ]}
            validateTrigger="onBlur"
            help={editingPanel ? '编辑时不可修改shortID' : '请扫码或手动输入shortID'}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="扫码或输入shortID（例如：1, 12345）"
              disabled={!!editingPanel}
              min={1}
              data-testid="panel-shortid-input"
            />
          </Form.Item>
          <Form.Item
            name="name"
            label={t('fields.name')}
            rules={[{ required: true, message: t('validation.nameRequired') }]}
          >
            <Input placeholder={t('placeholders.name')} data-testid="panel-name-input" />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('fields.type')}
            rules={[{ required: true, message: t('validation.typeRequired') }]}
          >
            <Select placeholder={t('placeholders.type')} data-testid="panel-type-select">
              {Object.entries(panelTypeColorMap).map(([key]) => (
                <Option key={key} value={key}>
                  {t(`panelTypes.${key}`)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="deviceId"
            label={t('fields.device')}
            rules={[{ required: true, message: t('validation.deviceRequired') }]}
          >
            <Select placeholder={t('placeholders.device')} showSearch optionFilterProp="children" data-testid="panel-device-select">
              {devices.map((device) => (
                <Option key={device.id} value={device.id}>
                  {device.name} ({device.type})
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
