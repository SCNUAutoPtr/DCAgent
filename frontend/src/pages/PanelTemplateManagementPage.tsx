import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Tag,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { PanelTemplate, PanelType, Panel, Port } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';
import { PanelVisualizer } from '@/components/PanelVisualizer';
import PanelTemplateEditor from '@/components/PanelTemplateEditor';
import { formatPanelSize } from '@/utils/panelUtils';

const { Title, Paragraph } = Typography;

/**
 * 面板模板管理页面
 */
export default function PanelTemplateManagementPage() {
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editorModalVisible, setEditorModalVisible] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PanelTemplate | null>(null);
  const [viewingTemplate, setViewingTemplate] = useState<PanelTemplate | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await panelTemplateService.getAll();
      setTemplates(data);
    } catch (error: any) {
      message.error('加载模板失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (template: PanelTemplate) => {
    if (template.isSystem) {
      message.warning('系统预设模板不可编辑');
      return;
    }
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      type: template.type,
      portCount: template.portCount,
      description: template.description,
    });
    setModalVisible(true);
  };

  const handleView = async (template: PanelTemplate) => {
    try {
      const fullTemplate = await panelTemplateService.getById(template.id);
      setViewingTemplate(fullTemplate);
      setViewModalVisible(true);
    } catch (error: any) {
      message.error('加载模板详情失败: ' + error.message);
    }
  };

  const handleOpenEditor = async (template: PanelTemplate) => {
    try {
      const fullTemplate = await panelTemplateService.getById(template.id);
      setEditingTemplate(fullTemplate);
      setEditorModalVisible(true);
    } catch (error: any) {
      message.error('加载模板失败: ' + error.message);
    }
  };

  const handleSaveFromEditor = async (
    ports: Array<{
      number: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
      group?: string;
    }>,
    groups: Array<{
      id: string;
      name: string;
      portNumbers: string[];
      color: string;
    }>
  ) => {
    if (!editingTemplate) return;

    try {
      // 更新端口定义
      await panelTemplateService.update(editingTemplate.id, {
        portDefinitions: ports,
        layoutConfig: { groups }, // 保存端口组信息
      });

      message.success('模板已保存');
      setEditorModalVisible(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      message.error('保存失败: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await panelTemplateService.delete(id);
      message.success('删除成功');
      loadTemplates();
    } catch (error: any) {
      message.error('删除失败: ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingTemplate) {
        // 更新
        await panelTemplateService.update(editingTemplate.id, values);
        message.success('更新成功');
      } else {
        // 创建
        await panelTemplateService.create(values);
        message.success('创建成功');
      }

      setModalVisible(false);
      loadTemplates();
    } catch (error: any) {
      message.error('保存失败: ' + error.message);
    }
  };

  const handleInitSystemTemplates = async () => {
    try {
      await panelTemplateService.initSystemTemplates();
      message.success('系统预设模板初始化成功');
      loadTemplates();
    } catch (error: any) {
      message.error('初始化失败: ' + error.message);
    }
  };

  const columns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PanelTemplate) => (
        <Space>
          {text}
          {record.isSystem && <Tag color="blue">系统预设</Tag>}
        </Space>
      ),
    },
    {
      title: '面板类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: PanelType) => {
        const typeLabels: Record<PanelType, string> = {
          ETHERNET: '以太网',
          FIBER: '光纤',
          POWER: '电源',
          SERIAL: '串口',
          USB: 'USB',
          OTHER: '其他',
        };
        return typeLabels[type] || type;
      },
    },
    {
      title: '端口数量',
      dataIndex: 'portCount',
      key: 'portCount',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '使用次数',
      key: 'usage',
      render: (_: any, record: any) => {
        return record.panels?.length || 0;
      },
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: PanelTemplate) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            查看
          </Button>
          <Button
            type="link"
            icon={<LayoutOutlined />}
            onClick={() => handleOpenEditor(record)}
          >
            编辑布局
          </Button>
          {!record.isSystem && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Popconfirm
                title="确认删除此模板？"
                description="删除后无法恢复"
                onConfirm={() => handleDelete(record.id)}
                okText="确认"
                cancelText="取消"
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Title level={3}>面板模板管理</Title>
              <Paragraph type="secondary">
                管理可复用的面板配置模板，用于快速创建标准化的设备面板
              </Paragraph>
            </div>
            <Space>
              <Button onClick={handleInitSystemTemplates}>初始化系统模板</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                创建自定义模板
              </Button>
            </Space>
          </div>

          <Table
            dataSource={templates}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </Card>

      {/* 创建/编辑模板 Modal */}
      <Modal
        title={editingTemplate ? '编辑模板' : '创建模板'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="模板名称"
            rules={[{ required: true, message: '请输入模板名称' }]}
          >
            <Input placeholder="例如：24口交换机面板" />
          </Form.Item>

          <Form.Item
            name="type"
            label="面板类型"
            rules={[{ required: true, message: '请选择面板类型' }]}
          >
            <Select>
              <Select.Option value="ETHERNET">以太网</Select.Option>
              <Select.Option value="FIBER">光纤</Select.Option>
              <Select.Option value="POWER">电源</Select.Option>
              <Select.Option value="SERIAL">串口</Select.Option>
              <Select.Option value="USB">USB</Select.Option>
              <Select.Option value="OTHER">其他</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="portCount"
            label="端口数量"
            rules={[{ required: true, message: '请输入端口数量' }]}
          >
            <InputNumber min={1} max={96} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="模板描述信息" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看模板详情 Modal */}
      <Modal
        title="模板详情"
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {viewingTemplate && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small" title="基本信息">
              <p>
                <strong>模板名称:</strong> {viewingTemplate.name}
              </p>
              <p>
                <strong>面板类型:</strong> {viewingTemplate.type}
              </p>
              <p>
                <strong>端口数量:</strong> {viewingTemplate.portCount}
              </p>
              <p>
                <strong>描述:</strong> {viewingTemplate.description || '无'}
              </p>
              <p>
                <strong>尺寸:</strong> {formatPanelSize(viewingTemplate.width, viewingTemplate.height)}
              </p>
            </Card>

            {viewingTemplate.portDefinitions && (
              <Card size="small" title="端口布局预览">
                {(() => {
                  // 将模板转换为Panel和Port格式以供PanelVisualizer使用
                  const previewPanel: Panel = {
                    id: viewingTemplate.id,
                    name: viewingTemplate.name,
                    type: viewingTemplate.type,
                    deviceId: 'preview',
                    templateId: viewingTemplate.id,
                    isCustomized: false,
                    size: {
                      width: viewingTemplate.width,
                      height: viewingTemplate.height,
                    },
                    backgroundColor: viewingTemplate.backgroundColor,
                    image: viewingTemplate.image,
                    svgPath: viewingTemplate.svgPath,
                    createdAt: viewingTemplate.createdAt,
                    updatedAt: viewingTemplate.updatedAt,
                  };

                  const previewPorts = viewingTemplate.portDefinitions.map((portDef) => ({
                    id: `preview-${portDef.number}`,
                    number: portDef.number,
                    status: 'AVAILABLE' as const,
                    panelId: viewingTemplate.id,
                    position: portDef.position,
                    size: portDef.size,
                    createdAt: viewingTemplate.createdAt,
                    updatedAt: viewingTemplate.updatedAt,
                  })) as Port[];

                  return (
                    <PanelVisualizer
                      panel={previewPanel}
                      ports={previewPorts}
                      onPortClick={(port) => {
                        message.info(`端口 ${port.number}`);
                      }}
                    />
                  );
                })()}
              </Card>
            )}

            {(viewingTemplate as any).panels && (
              <Card size="small" title="使用此模板的面板">
                <p>共 {(viewingTemplate as any).panels.length} 个面板使用此模板</p>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      {/* 布局编辑器 Modal */}
      <Modal
        title="编辑面板布局"
        open={editorModalVisible}
        onCancel={() => {
          setEditorModalVisible(false);
          setEditingTemplate(null);
        }}
        footer={null}
        width="95%"
        style={{ top: 20 }}
      >
        {editingTemplate && (
          <PanelTemplateEditor
            templateName={editingTemplate.name}
            panelType={editingTemplate.type}
            portCount={editingTemplate.portCount}
            width={editingTemplate.width}
            height={editingTemplate.height}
            initialPorts={editingTemplate.portDefinitions}
            onSave={handleSaveFromEditor}
            onCancel={() => {
              setEditorModalVisible(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
