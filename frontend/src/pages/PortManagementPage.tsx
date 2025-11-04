import { useState, useEffect } from 'react';
import {
  Layout,
  Card,
  List,
  Typography,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  InputNumber,
  Collapse,
  Empty,
  Divider,
  Tabs,
  Table,
  Popconfirm,
  Badge,
} from 'antd';
import {
  ApiOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Device, Panel, Port, PortStatus, PanelType } from '@/types';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';
import { portService } from '@/services/portService';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import { sortPorts } from '@/utils/portUtils';
import {
  PORT_GROUP_TEMPLATES,
  PortGroupTemplate,
  generatePortsFromTemplate,
  STANDARD_1U,
} from '@/utils/portTemplates';
import './PortManagementPage.css';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { Panel: CollapsePanel } = Collapse;
const { TabPane } = Tabs;
const { Search } = Input;

// 端口状态中文映射
const portStatusMap: Record<PortStatus, { label: string; color: string }> = {
  AVAILABLE: { label: '可用', color: 'success' },
  OCCUPIED: { label: '已占用', color: 'error' },
  RESERVED: { label: '预留', color: 'warning' },
  FAULTY: { label: '故障', color: 'default' },
};

// 面板类型中文映射
const panelTypeMap: Record<PanelType, { label: string; color: string }> = {
  ETHERNET: { label: '网口', color: 'blue' },
  FIBER: { label: '光纤', color: 'cyan' },
  POWER: { label: '电源', color: 'red' },
  SERIAL: { label: '串口', color: 'orange' },
  USB: { label: 'USB', color: 'purple' },
  OTHER: { label: '其他', color: 'default' },
};

export default function PortManagementPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPanel, setSelectedPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');

  // 列表视图的过滤状态
  const [selectedPanelId, setSelectedPanelId] = useState<string>();
  const [selectedStatus, setSelectedStatus] = useState<PortStatus>();

  // 对话框状态
  const [portModalVisible, setPortModalVisible] = useState(false);
  const [panelConfigModalVisible, setPanelConfigModalVisible] = useState(false);
  const [bulkCreateModalVisible, setBulkCreateModalVisible] = useState(false);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [editingPort, setEditingPort] = useState<Port | null>(null);

  const [portForm] = Form.useForm();
  const [panelConfigForm] = Form.useForm();
  const [bulkCreateForm] = Form.useForm();
  const [templateForm] = Form.useForm();

  // 加载设备列表
  const loadDevices = async () => {
    try {
      const data = await deviceService.getAll();
      setDevices(data);
    } catch (error) {
      message.error('加载设备列表失败');
      console.error(error);
    }
  };

  // 加载面板列表
  const loadPanels = async () => {
    try {
      const data = await panelService.getAll();
      setPanels(data);
    } catch (error) {
      message.error('加载面板列表失败');
      console.error(error);
    }
  };

  // 加载端口列表（支持按面板过滤、搜索、状态过滤）
  const loadPorts = async (searchQuery?: string, panelId?: string, status?: PortStatus) => {
    setLoading(true);
    try {
      let allPorts;
      if (searchQuery) {
        allPorts = await portService.search(searchQuery);
      } else {
        allPorts = await portService.getAll();
      }

      // 应用面板过滤
      let filteredPorts = panelId
        ? allPorts.filter((p) => p.panelId === panelId)
        : allPorts;

      // 应用状态过滤
      if (status) {
        filteredPorts = filteredPorts.filter((p) => p.status === status);
      }

      // 使用自然排序
      setPorts(sortPorts(filteredPorts));
    } catch (error) {
      message.error('加载端口列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    loadPanels();
    loadPorts(); // 初始加载所有端口（用于列表视图）
  }, []);

  // 选择面板（用于可视化视图）
  const handleSelectPanel = (panel: Panel) => {
    setSelectedPanel(panel);
    loadPorts(undefined, panel.id); // 只加载该面板的端口
  };

  // 打开端口编辑对话框
  const handleOpenPortModal = (port?: Port) => {
    if (port) {
      setEditingPort(port);
      portForm.setFieldsValue(port);
    } else {
      setEditingPort(null);
      portForm.resetFields();
      if (selectedPanel) {
        portForm.setFieldsValue({ panelId: selectedPanel.id });
      }
    }
    setPortModalVisible(true);
  };

  // 保存端口
  const handleSavePort = async () => {
    try {
      const values = await portForm.validateFields();
      if (editingPort) {
        await portService.update(editingPort.id, values);
        message.success('端口更新成功');
      } else {
        await portService.create(values);
        message.success('端口创建成功');
      }
      setPortModalVisible(false);
      portForm.resetFields();
      // 重新加载端口列表
      if (activeTab === 'visual' && selectedPanel) {
        loadPorts(undefined, selectedPanel.id);
      } else {
        loadPorts(undefined, selectedPanelId, selectedStatus);
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingPort ? '更新失败' : '创建失败');
      console.error(error);
    }
  };

  // 删除端口
  const handleDeletePort = async (port: Port) => {
    Modal.confirm({
      title: '确定要删除这个端口吗？',
      content: `端口 ${port.number} (${port.label || '无标签'})`,
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await portService.delete(port.id);
          message.success('端口删除成功');
          // 重新加载端口列表
          if (activeTab === 'visual' && selectedPanel) {
            loadPorts(undefined, selectedPanel.id);
          } else {
            loadPorts(undefined, selectedPanelId, selectedStatus);
          }
        } catch (error) {
          message.error('删除失败');
          console.error(error);
        }
      },
    });
  };

  // 更新端口状态
  const handleUpdatePortStatus = async (portId: string, status: PortStatus) => {
    try {
      await portService.updateStatus(portId, status);
      message.success('状态更新成功');
      // 重新加载端口列表
      if (activeTab === 'visual' && selectedPanel) {
        loadPorts(undefined, selectedPanel.id);
      } else {
        loadPorts(undefined, selectedPanelId, selectedStatus);
      }
    } catch (error) {
      message.error('状态更新失败');
      console.error(error);
    }
  };

  // 列表视图专用函数
  const handleSearch = (value: string) => {
    loadPorts(value, selectedPanelId, selectedStatus);
  };

  const handlePanelFilter = (value: string) => {
    setSelectedPanelId(value);
    loadPorts(undefined, value, selectedStatus);
  };

  const handleStatusFilter = (value: PortStatus) => {
    setSelectedStatus(value);
    loadPorts(undefined, selectedPanelId, value);
  };

  const handleBulkCreate = async () => {
    try {
      const values = await bulkCreateForm.validateFields();
      await portService.createBulk(values.panelId, values.count, values.prefix);
      message.success(`成功创建 ${values.count} 个端口`);
      setBulkCreateModalVisible(false);
      bulkCreateForm.resetFields();
      loadPorts(undefined, selectedPanelId, selectedStatus);
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('批量创建失败');
      console.error(error);
    }
  };

  // 打开面板配置对话框
  const handleOpenPanelConfig = () => {
    if (!selectedPanel) return;
    panelConfigForm.setFieldsValue({
      ...selectedPanel.position,
      ...selectedPanel.size,
      backgroundColor: selectedPanel.backgroundColor,
      image: selectedPanel.image,
      svgPath: selectedPanel.svgPath,
    });
    setPanelConfigModalVisible(true);
  };

  // 保存面板配置
  const handleSavePanelConfig = async () => {
    if (!selectedPanel) return;
    try {
      const values = await panelConfigForm.validateFields();
      await panelService.update(selectedPanel.id, {
        ...selectedPanel,
        position: { x: values.x, y: values.y },
        size: { width: values.width, height: values.height },
        backgroundColor: values.backgroundColor,
        image: values.image,
        svgPath: values.svgPath,
      });
      message.success('面板配置已更新');
      setPanelConfigModalVisible(false);
      loadPanels();
      // 重新加载选中的面板
      const updatedPanels = await panelService.getAll();
      const updatedPanel = updatedPanels.find((p) => p.id === selectedPanel.id);
      if (updatedPanel) {
        setSelectedPanel(updatedPanel);
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('更新失败');
      console.error(error);
    }
  };

  // 打开模板选择对话框
  const handleOpenTemplateModal = () => {
    if (!selectedPanel) return;
    templateForm.resetFields();
    setTemplateModalVisible(true);
  };

  // 应用端口组模板
  const handleApplyTemplate = async () => {
    if (!selectedPanel) return;
    try {
      const values = await templateForm.validateFields();
      const template = PORT_GROUP_TEMPLATES.find((t) => t.id === values.templateId);
      if (!template) {
        message.error('模板不存在');
        return;
      }

      // 生成端口配置
      const portsConfig = generatePortsFromTemplate(template, {
        slot: values.slot,
        module: values.module,
        card: values.card,
        startNumber: values.startNumber || 0,
      });

      // 批量创建端口
      const createPromises = portsConfig.map((portConfig) =>
        portService.create({
          ...portConfig,
          panelId: selectedPanel.id,
          status: 'AVAILABLE' as PortStatus,
        })
      );

      await Promise.all(createPromises);

      // 更新面板尺寸
      await panelService.update(selectedPanel.id, {
        ...selectedPanel,
        width: template.panelSize.width,
        height: template.panelSize.height,
      });

      message.success(`成功应用模板，创建了 ${portsConfig.length} 个端口`);
      setTemplateModalVisible(false);
      templateForm.resetFields();
      loadPorts(selectedPanel.id);
      loadPanels();

      // 更新选中的面板
      const updatedPanels = await panelService.getAll();
      const updatedPanel = updatedPanels.find((p) => p.id === selectedPanel.id);
      if (updatedPanel) {
        setSelectedPanel(updatedPanel);
      }
    } catch (error: any) {
      if (error.errorFields) return;
      message.error('应用模板失败');
      console.error(error);
    }
  };

  // 批量创建端口
  const handleOpenBulkCreate = () => {
    if (!selectedPanel) return;
    bulkCreateForm.resetFields();
    bulkCreateForm.setFieldsValue({ panelId: selectedPanel.id });
    setBulkCreateModalVisible(true);
  };

  // 按设备分组面板
  const panelsByDevice = devices.map((device) => ({
    device,
    panels: panels.filter((p) => p.deviceId === device.id),
  }));

  return (
    <div className="port-management-page">
      <Title level={2}>
        <ApiOutlined /> 端口管理
      </Title>
      <p style={{ color: '#8c8c8c', marginBottom: 24 }}>
        管理面板上的所有端口，支持批量创建、状态管理和可视化布局
      </p>

      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card">
        <TabPane tab={<span><ApiOutlined /> 端口列表</span>} key="list">
          <Card>
            <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenPortModal()}>
                  新建端口
                </Button>
                <Button
                  type="default"
                  icon={<ThunderboltOutlined />}
                  onClick={() => setBulkCreateModalVisible(true)}
                >
                  批量创建
                </Button>
                <Select
                  placeholder="选择面板"
                  allowClear
                  style={{ width: 200 }}
                  onChange={handlePanelFilter}
                  onClear={() => {
                    setSelectedPanelId(undefined);
                    loadPorts();
                  }}
                >
                  {panels.map((panel) => {
                    const device = devices.find((d) => d.id === panel.deviceId);
                    return (
                      <Option key={panel.id} value={panel.id}>
                        {device?.name} - {panel.name}
                      </Option>
                    );
                  })}
                </Select>
                <Select
                  placeholder="选择状态"
                  allowClear
                  style={{ width: 120 }}
                  onChange={handleStatusFilter}
                  onClear={() => {
                    setSelectedStatus(undefined);
                    loadPorts();
                  }}
                >
                  {Object.entries(portStatusMap).map(([key, value]) => (
                    <Option key={key} value={key}>
                      <Badge status={value.color as any} text={value.label} />
                    </Option>
                  ))}
                </Select>
              </Space>
              <Search
                placeholder="搜索端口号或标签"
                allowClear
                onSearch={handleSearch}
                style={{ width: 300 }}
              />
            </Space>

            <Table
              columns={[
                {
                  title: 'ID',
                  dataIndex: 'shortId',
                  key: 'shortId',
                  width: 80,
                },
                {
                  title: '端口号',
                  dataIndex: 'number',
                  key: 'number',
                },
                {
                  title: '标签',
                  dataIndex: 'label',
                  key: 'label',
                  render: (text: string) => text || '-',
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status: PortStatus, record: Port) => (
                    <Select
                      size="small"
                      value={status}
                      style={{ width: 100 }}
                      onChange={(newStatus) => handleUpdatePortStatus(record.id, newStatus)}
                    >
                      {Object.entries(portStatusMap).map(([key, value]) => (
                        <Option key={key} value={key}>
                          <Badge status={value.color as any} text={value.label} />
                        </Option>
                      ))}
                    </Select>
                  ),
                },
                {
                  title: '所属面板',
                  dataIndex: 'panelId',
                  key: 'panelId',
                  render: (panelId: string) => {
                    const panel = panels.find((p) => p.id === panelId);
                    if (!panel) return '-';
                    const device = devices.find((d) => d.id === panel.deviceId);
                    return (
                      <Space>
                        <Tag color="blue">{device?.name}</Tag>
                        <Tag color="green">{panel.name}</Tag>
                      </Space>
                    );
                  },
                },
                {
                  title: '创建时间',
                  dataIndex: 'createdAt',
                  key: 'createdAt',
                  render: (text: string) => new Date(text).toLocaleString('zh-CN'),
                },
                {
                  title: '操作',
                  key: 'actions',
                  width: 150,
                  render: (_: any, record: Port) => (
                    <Space>
                      <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenPortModal(record)}
                      >
                        编辑
                      </Button>
                      <Popconfirm
                        title="确定要删除这个端口吗？"
                        onConfirm={() => handleDeletePort(record)}
                        okText="确定"
                        cancelText="取消"
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    </Space>
                  ),
                },
              ]}
              dataSource={ports}
              loading={loading}
              rowKey="id"
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        </TabPane>

        <TabPane tab={<span><SettingOutlined /> 可视化管理</span>} key="visual">
          <Text type="secondary" style={{ marginBottom: 16, display: 'block' }}>
            选择面板查看端口的物理布局，支持精确到毫米的位置管理
          </Text>

      <Layout style={{ background: '#fff', minHeight: 'calc(100vh - 300px)' }}>
        {/* 左侧：设备和面板列表 */}
        <Sider
          width={300}
          style={{
            background: '#fafafa',
            borderRight: '1px solid #e8e8e8',
            overflowY: 'auto',
            maxHeight: 'calc(100vh - 200px)',
          }}
        >
          <div style={{ padding: 16 }}>
            <Title level={4}>设备与面板</Title>
            {panelsByDevice.length === 0 ? (
              <Empty description="暂无设备" />
            ) : (
              <Collapse ghost>
                {panelsByDevice.map(({ device, panels: devicePanels }) => (
                  <CollapsePanel
                    key={device.id}
                    header={
                      <Space>
                        <Text strong>{device.name}</Text>
                        <Tag>{device.type}</Tag>
                        <Tag color="blue">{devicePanels.length} 个面板</Tag>
                      </Space>
                    }
                  >
                    {devicePanels.length === 0 ? (
                      <Empty description="暂无面板" />
                    ) : (
                      <List
                        size="small"
                        dataSource={devicePanels}
                        renderItem={(panel) => (
                          <List.Item
                            className={
                              selectedPanel?.id === panel.id ? 'panel-item-selected' : ''
                            }
                            style={{
                              cursor: 'pointer',
                              padding: '8px 12px',
                              borderRadius: 4,
                            }}
                            onClick={() => handleSelectPanel(panel)}
                          >
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Space>
                                <Text strong>{panel.name}</Text>
                                <Tag color={panelTypeMap[panel.type].color} size="small">
                                  {panelTypeMap[panel.type].label}
                                </Tag>
                              </Space>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {panel.size
                                  ? `${panel.size.width} × ${panel.size.height} mm`
                                  : '未配置尺寸'}
                              </Text>
                            </Space>
                          </List.Item>
                        )}
                      />
                    )}
                  </CollapsePanel>
                ))}
              </Collapse>
            )}
          </div>
        </Sider>

        {/* 右侧：面板可视化 */}
        <Content style={{ padding: 24 }}>
          {selectedPanel ? (
            <div>
              <div style={{ marginBottom: 16 }}>
                <Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenPortModal()}
                  >
                    新建端口
                  </Button>
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={handleOpenBulkCreate}
                  >
                    批量创建
                  </Button>
                  <Button
                    type="dashed"
                    icon={<ThunderboltOutlined />}
                    onClick={handleOpenTemplateModal}
                  >
                    应用模板
                  </Button>
                  <Button
                    icon={<SettingOutlined />}
                    onClick={handleOpenPanelConfig}
                  >
                    面板配置
                  </Button>
                </Space>
              </div>

              <PanelVisualizer
                panel={selectedPanel}
                ports={ports}
                onPortClick={handleOpenPortModal}
                scale={0.8}
              />

              <Divider />

              {/* 端口列表 */}
              <Card title="端口列表" size="small">
                <List
                  loading={loading}
                  dataSource={ports}
                  renderItem={(port) => (
                    <List.Item
                      actions={[
                        <Select
                          size="small"
                          value={port.status}
                          style={{ width: 100 }}
                          onChange={(status) => handleUpdatePortStatus(port.id, status)}
                        >
                          {Object.entries(portStatusMap).map(([key, value]) => (
                            <Option key={key} value={key}>
                              {value.label}
                            </Option>
                          ))}
                        </Select>,
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleOpenPortModal(port)}
                        />,
                        <Button
                          type="link"
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeletePort(port)}
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>端口 {port.number}</Text>
                            {port.label && <Tag>{port.label}</Tag>}
                          </Space>
                        }
                        description={
                          <Space size={16}>
                            {port.position && (
                              <Text type="secondary">
                                位置: ({port.position.x}, {port.position.y}) mm
                              </Text>
                            )}
                            {port.size && (
                              <Text type="secondary">
                                尺寸: {port.size.width} × {port.size.height} mm
                              </Text>
                            )}
                            {port.ipAddress && <Text type="secondary">IP: {port.ipAddress}</Text>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Card>
            </div>
          ) : (
            <Empty
              description="请从左侧选择一个面板"
              style={{ marginTop: 100 }}
            />
          )}
        </Content>
      </Layout>
        </TabPane>
      </Tabs>

      {/* 端口编辑对话框 */}
      <Modal
        title={editingPort ? '编辑端口' : '新建端口'}
        open={portModalVisible}
        onOk={handleSavePort}
        onCancel={() => {
          setPortModalVisible(false);
          portForm.resetFields();
        }}
        width={600}
      >
        <Form form={portForm} layout="vertical">
          <Form.Item name="panelId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="number"
            label="端口号"
            rules={[{ required: true, message: '请输入端口号' }]}
          >
            <Input placeholder="例如：1" />
          </Form.Item>
          <Form.Item name="label" label="标签">
            <Input placeholder="例如：eth0-1" />
          </Form.Item>
          <Form.Item
            name="status"
            label="状态"
            initialValue={PortStatus.AVAILABLE}
            rules={[{ required: true }]}
          >
            <Select>
              {Object.entries(portStatusMap).map(([key, value]) => (
                <Option key={key} value={key}>
                  {value.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>物理布局（可选）</Divider>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name={['position', 'x']} label="X 坐标 (mm)">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
            <Form.Item name={['position', 'y']} label="Y 坐标 (mm)">
              <InputNumber min={0} placeholder="0" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name={['size', 'width']} label="宽度 (mm)">
              <InputNumber min={0} placeholder="20" />
            </Form.Item>
            <Form.Item name={['size', 'height']} label="高度 (mm)">
              <InputNumber min={0} placeholder="20" />
            </Form.Item>
          </Space>

          <Divider>扩展信息（可选）</Divider>

          <Form.Item name="ipAddress" label="IP 地址">
            <Input placeholder="例如：192.168.1.1" />
          </Form.Item>
          <Form.Item name="vlan" label="VLAN">
            <Input placeholder="例如：100" />
          </Form.Item>
          <Form.Item name="speed" label="速率">
            <Input placeholder="例如：1000Mbps" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建端口对话框 */}
      <Modal
        title="批量创建端口"
        open={bulkCreateModalVisible}
        onOk={handleBulkCreate}
        onCancel={() => setBulkCreateModalVisible(false)}
        okText="创建"
        cancelText="取消"
      >
        <Form form={bulkCreateForm} layout="vertical">
          <Form.Item
            name="panelId"
            label="所属面板"
            rules={[{ required: true, message: '请选择面板' }]}
          >
            <Select placeholder="选择面板" showSearch optionFilterProp="children">
              {panels.map((panel) => {
                const device = devices.find((d) => d.id === panel.deviceId);
                return (
                  <Option key={panel.id} value={panel.id}>
                    {device?.name} - {panel.name}
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
          <Form.Item
            name="count"
            label="端口数量"
            initialValue={24}
            rules={[
              { required: true, message: '请输入端口数量' },
              { type: 'number', min: 1, max: 128, message: '端口数量必须在 1-128 之间' },
            ]}
          >
            <InputNumber min={1} max={128} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="prefix" label="标签前缀" initialValue="Port-">
            <Input placeholder="例如：Port-" />
          </Form.Item>
          <p style={{ color: '#8c8c8c', fontSize: '12px' }}>
            将创建编号为 1 到 {bulkCreateForm.getFieldValue('count') || 24} 的端口，标签格式为 {bulkCreateForm.getFieldValue('prefix') || 'Port-'}1, {bulkCreateForm.getFieldValue('prefix') || 'Port-'}2, ...
          </p>
        </Form>
      </Modal>

      {/* 面板配置对话框 */}
      <Modal
        title="面板配置"
        open={panelConfigModalVisible}
        onOk={handleSavePanelConfig}
        onCancel={() => setPanelConfigModalVisible(false)}
        width={600}
      >
        <Form form={panelConfigForm} layout="vertical">
          <Divider>物理尺寸</Divider>
          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="x"
              label="X 坐标 (mm)"
              initialValue={0}
              rules={[{ required: true }]}
            >
              <InputNumber min={0} />
            </Form.Item>
            <Form.Item
              name="y"
              label="Y 坐标 (mm)"
              initialValue={0}
              rules={[{ required: true }]}
            >
              <InputNumber min={0} />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="width"
              label="宽度 (mm)"
              initialValue={STANDARD_1U.width}
              rules={[{ required: true }]}
              tooltip="标准 19 英寸机架宽度为 482.6mm"
            >
              <InputNumber min={1} step={0.1} />
            </Form.Item>
            <Form.Item
              name="height"
              label="高度 (mm)"
              initialValue={STANDARD_1U.height}
              rules={[{ required: true }]}
              tooltip="标准 1U 高度为 44.45mm"
            >
              <InputNumber min={1} step={0.1} />
            </Form.Item>
          </Space>

          <Divider>视觉样式</Divider>
          <Form.Item name="backgroundColor" label="背景颜色">
            <Input placeholder="例如：#f5f5f5" />
          </Form.Item>
          <Form.Item name="image" label="图片 URL">
            <Input placeholder="例如：https://example.com/panel.png" />
          </Form.Item>
          <Form.Item name="svgPath" label="SVG 路径">
            <Input placeholder="例如：/images/panel.svg" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 批量创建对话框 */}
      <Modal
        title="批量创建端口"
        open={bulkCreateModalVisible}
        onOk={handleBulkCreate}
        onCancel={() => setBulkCreateModalVisible(false)}
      >
        <Form form={bulkCreateForm} layout="vertical">
          <Form.Item name="panelId" hidden>
            <Input />
          </Form.Item>
          <Form.Item
            name="count"
            label="端口数量"
            initialValue={24}
            rules={[
              { required: true },
              { type: 'number', min: 1, max: 128, message: '数量必须在 1-128 之间' },
            ]}
          >
            <InputNumber min={1} max={128} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="prefix" label="标签前缀" initialValue="Port-">
            <Input placeholder="例如：Port-" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 端口组模板对话框 */}
      <Modal
        title="应用端口组模板"
        open={templateModalVisible}
        onOk={handleApplyTemplate}
        onCancel={() => setTemplateModalVisible(false)}
        width={700}
      >
        <Form form={templateForm} layout="vertical">
          <Form.Item
            name="templateId"
            label="选择模板"
            rules={[{ required: true, message: '请选择模板' }]}
          >
            <Select
              placeholder="选择端口组模板"
              onChange={(value) => {
                const template = PORT_GROUP_TEMPLATES.find((t) => t.id === value);
                if (template) {
                  message.info(`将创建 ${template.portCount} 个端口`);
                }
              }}
            >
              {PORT_GROUP_TEMPLATES.map((template) => (
                <Option key={template.id} value={template.id}>
                  <div>
                    <strong>{template.name}</strong>
                    <div style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {template.description}
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider>编号参数（可选）</Divider>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="slot" label="Slot" initialValue={1}>
              <InputNumber min={0} max={99} placeholder="1" />
            </Form.Item>
            <Form.Item name="module" label="Module" initialValue={0}>
              <InputNumber min={0} max={99} placeholder="0" />
            </Form.Item>
            <Form.Item name="card" label="Card" initialValue={0}>
              <InputNumber min={0} max={99} placeholder="0" />
            </Form.Item>
            <Form.Item name="startNumber" label="起始编号" initialValue={0}>
              <InputNumber min={0} max={999} placeholder="0" />
            </Form.Item>
          </Space>

          <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 16 }}>
            提示：模板将自动设置端口的物理位置和面板尺寸。不同的编号模式会生成不同格式的端口号。
          </p>
        </Form>
      </Modal>
    </div>
  );
}
