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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import { Device, DeviceType, Cabinet, Room, DataCenter } from '@/types';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/cabinetService';
import { roomService } from '@/services/roomService';
import { dataCenterService } from '@/services/dataCenterService';

const { Title } = Typography;
const { Search } = Input;
const { Option } = Select;

// 设备类型颜色映射
const deviceTypeColorMap: Record<DeviceType, string> = {
  SERVER: 'blue',
  SWITCH: 'green',
  ROUTER: 'orange',
  FIREWALL: 'red',
  STORAGE: 'purple',
  PDU: 'cyan',
  OTHER: 'default',
};

export default function DeviceList() {
  const { t } = useTranslation('device');
  const [devices, setDevices] = useState<Device[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [selectedCabinet, setSelectedCabinet] = useState<string>();
  const [selectedType, setSelectedType] = useState<DeviceType>();
  const [form] = Form.useForm();

  // 加载机柜、机房和数据中心
  const loadRelatedData = async () => {
    try {
      const [cabinetData, roomData, dcData] = await Promise.all([
        cabinetService.getAll(),
        roomService.getAll(),
        dataCenterService.getAll(),
      ]);
      setCabinets(cabinetData);
      setRooms(roomData);
      setDataCenters(dcData);
    } catch (error) {
      console.error(error);
    }
  };

  // 加载设备列表
  const loadDevices = async (searchQuery?: string, cabinetId?: string) => {
    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await deviceService.search(searchQuery);
      } else if (cabinetId) {
        data = await deviceService.getAll(cabinetId);
      } else {
        data = await deviceService.getAll();
      }
      setDevices(data);
    } catch (error) {
      message.error(t('messages.loadFailed'));
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelatedData();
    loadDevices();
  }, []);

  // 获取设备位置信息
  const getDeviceLocation = (cabinetId: string) => {
    const cabinet = cabinets.find((c) => c.id === cabinetId);
    if (!cabinet) return null;
    const room = rooms.find((r) => r.id === cabinet.roomId);
    if (!room) return null;
    const dc = dataCenters.find((d) => d.id === room.dataCenterId);
    return { cabinet, room, dc };
  };

  // 打开创建/编辑对话框
  const handleOpenModal = (device?: Device) => {
    if (device) {
      setEditingDevice(device);
      form.setFieldsValue(device);
    } else {
      setEditingDevice(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // 关闭对话框
  const handleCloseModal = () => {
    setModalVisible(false);
    setEditingDevice(null);
    form.resetFields();
  };

  // 保存设备
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editingDevice) {
        await deviceService.update(editingDevice.id, values);
        message.success(t('messages.updateSuccess'));
      } else {
        await deviceService.create(values);
        message.success(t('messages.createSuccess'));
      }
      handleCloseModal();
      loadDevices(undefined, selectedCabinet);
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(editingDevice ? t('messages.updateFailed') : t('messages.createFailed'));
      console.error(error);
    }
  };

  // 删除设备
  const handleDelete = async (id: string) => {
    try {
      await deviceService.delete(id);
      message.success(t('messages.deleteSuccess'));
      loadDevices(undefined, selectedCabinet);
    } catch (error) {
      message.error(t('messages.deleteFailed'));
      console.error(error);
    }
  };

  // 搜索
  const handleSearch = (value: string) => {
    loadDevices(value);
  };

  // 按机柜过滤
  const handleCabinetFilter = (value: string) => {
    setSelectedCabinet(value);
    loadDevices(undefined, value);
  };

  // 按类型过滤
  const handleTypeFilter = (value: DeviceType) => {
    setSelectedType(value);
    // 过滤已加载的设备
    if (value) {
      setDevices(devices.filter((d) => d.type === value));
    } else {
      loadDevices();
    }
  };

  const columns = [
    {
      title: t('fields.id'),
      dataIndex: 'shortId',
      key: 'shortId',
      width: 80,
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
      render: (type: DeviceType) => {
        const label = t(`deviceTypes.${type}`);
        const color = deviceTypeColorMap[type];
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t('fields.model'),
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => text || '-',
    },
    {
      title: t('fields.serialNo'),
      dataIndex: 'serialNo',
      key: 'serialNo',
      render: (text: string) => text || '-',
    },
    {
      title: t('fields.uPosition'),
      key: 'uPosition',
      render: (_: any, record: Device) =>
        record.uPosition ? `${record.uPosition}U (${t('fields.uHeight')}${record.uHeight}U)` : '-',
    },
    {
      title: t('fields.cabinet'),
      dataIndex: 'cabinetId',
      key: 'cabinetId',
      render: (cabinetId: string) => {
        const location = getDeviceLocation(cabinetId);
        if (!location) return '-';
        return (
          <Space size={4} wrap>
            <Tag color="blue">{location.dc?.name}</Tag>
            <Tag color="green">{location.room.name}</Tag>
            <Tag color="orange">{location.cabinet.name}</Tag>
          </Space>
        );
      },
    },
    {
      title: t('fields.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: t('fields.actions'),
      key: 'actions',
      width: 150,
      fixed: 'right' as const,
      render: (_: any, record: Device) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
          >
            {t('buttons.edit')}
          </Button>
          <Popconfirm
            title={t('messages.deleteConfirm')}
            description={t('messages.deleteWarning')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
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
        <CloudServerOutlined /> {t('title')}
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        {t('description')}
      </p>

      <Card>
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
              {t('buttons.create')}
            </Button>
            <Select
              placeholder={t('filters.selectCabinet')}
              allowClear
              style={{ width: 200 }}
              onChange={handleCabinetFilter}
              onClear={() => {
                setSelectedCabinet(undefined);
                loadDevices();
              }}
            >
              {cabinets.map((cabinet) => {
                const room = rooms.find((r) => r.id === cabinet.roomId);
                const dc = dataCenters.find((d) => d.id === room?.dataCenterId);
                return (
                  <Option key={cabinet.id} value={cabinet.id}>
                    {dc?.name} - {room?.name} - {cabinet.name}
                  </Option>
                );
              })}
            </Select>
            <Select
              placeholder={t('filters.selectType')}
              allowClear
              style={{ width: 120 }}
              onChange={handleTypeFilter}
              onClear={() => {
                setSelectedType(undefined);
                loadDevices();
              }}
            >
              {Object.entries(t('deviceTypes', { returnObjects: true })).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
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
          dataSource={devices}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => t('table.total', { total }),
          }}
        />
      </Card>

      <Modal
        title={editingDevice ? t('editTitle') : t('createTitle')}
        open={modalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        okText={t('buttons.save')}
        cancelText={t('buttons.cancel')}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('fields.name')}
            rules={[{ required: true, message: t('validation.nameRequired') }]}
          >
            <Input placeholder={t('placeholders.name')} />
          </Form.Item>
          <Form.Item
            name="type"
            label={t('fields.type')}
            rules={[{ required: true, message: t('validation.typeRequired') }]}
          >
            <Select placeholder={t('placeholders.type')}>
              {Object.entries(t('deviceTypes', { returnObjects: true })).map(([key, label]) => (
                <Option key={key} value={key}>
                  {label}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="model" label={t('fields.model')}>
            <Input placeholder={t('placeholders.model')} />
          </Form.Item>
          <Form.Item name="serialNo" label={t('fields.serialNo')}>
            <Input placeholder={t('placeholders.serialNo')} />
          </Form.Item>
          <Form.Item
            name="cabinetId"
            label={t('fields.cabinet')}
            rules={[{ required: true, message: t('validation.cabinetRequired') }]}
          >
            <Select placeholder={t('placeholders.cabinet')} showSearch optionFilterProp="children">
              {cabinets.map((cabinet) => {
                const room = rooms.find((r) => r.id === cabinet.roomId);
                const dc = dataCenters.find((d) => d.id === room?.dataCenterId);
                return (
                  <Option key={cabinet.id} value={cabinet.id}>
                    {dc?.name} - {room?.name} - {cabinet.name}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="uPosition" label={t('placeholders.uPosition')} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={52} placeholder="1" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="uHeight" label={t('fields.uHeight')} initialValue={1} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={10} placeholder="1" style={{ width: 120 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
