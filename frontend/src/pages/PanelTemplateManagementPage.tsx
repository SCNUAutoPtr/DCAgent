import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('management');
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
      message.error(t('panelTemplate.messages.loadTemplatesFailed') + ': ' + error.message);
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
    // 允许编辑系统模板的布局和样式
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
      message.error(t('panelTemplate.messages.loadTemplateDetailFailed') + ': ' + error.message);
    }
  };

  const handleOpenEditor = async (template: PanelTemplate) => {
    try {
      const fullTemplate = await panelTemplateService.getById(template.id);
      setEditingTemplate(fullTemplate);
      setEditorModalVisible(true);
    } catch (error: any) {
      message.error(t('panelTemplate.messages.loadTemplatesFailed') + ': ' + error.message);
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

      message.success(t('panelTemplate.messages.saveSuccess'));
      setEditorModalVisible(false);
      setEditingTemplate(null);
      loadTemplates();
    } catch (error: any) {
      message.error(t('panelTemplate.messages.saveFailed') + ': ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await panelTemplateService.delete(id);
      message.success(t('panelTemplate.messages.deleteSuccess'));
      loadTemplates();
    } catch (error: any) {
      message.error(t('panelTemplate.messages.deleteFailed') + ': ' + error.message);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (editingTemplate) {
        // 更新
        await panelTemplateService.update(editingTemplate.id, values);
        message.success(t('panelTemplate.messages.updateSuccess'));
      } else {
        // 创建
        await panelTemplateService.create(values);
        message.success(t('panelTemplate.messages.createSuccess'));
      }

      setModalVisible(false);
      loadTemplates();
    } catch (error: any) {
      message.error(t('panelTemplate.messages.saveFailed') + ': ' + error.message);
    }
  };

  const handleInitSystemTemplates = async () => {
    try {
      await panelTemplateService.initSystemTemplates();
      message.success(t('panelTemplate.messages.initSuccess'));
      loadTemplates();
    } catch (error: any) {
      message.error(t('panelTemplate.messages.initFailed') + ': ' + error.message);
    }
  };

  const columns = [
    {
      title: t('panelTemplate.fields.name'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: PanelTemplate) => (
        <Space>
          {text}
          {record.isSystem && <Tag color="blue">{t('panelTemplate.table.systemTag')}</Tag>}
        </Space>
      ),
    },
    {
      title: t('panelTemplate.fields.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: PanelType) => {
        const typeLabels: Record<PanelType, string> = {
          ETHERNET: t('panelTemplate.panelTypes.ETHERNET'),
          FIBER: t('panelTemplate.panelTypes.FIBER'),
          POWER: t('panelTemplate.panelTypes.POWER'),
          SERIAL: t('panelTemplate.panelTypes.SERIAL'),
          USB: t('panelTemplate.panelTypes.USB'),
          OTHER: t('panelTemplate.panelTypes.OTHER'),
        };
        return typeLabels[type] || type;
      },
    },
    {
      title: t('panelTemplate.fields.portCount'),
      dataIndex: 'portCount',
      key: 'portCount',
    },
    {
      title: t('panelTemplate.fields.description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('panelTemplate.fields.usage'),
      key: 'usage',
      render: (_: any, record: any) => {
        return record.panels?.length || 0;
      },
    },
    {
      title: t('panelTemplate.actions.create'),
      key: 'action',
      render: (_: any, record: PanelTemplate) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleView(record)}
          >
            {t('panelTemplate.actions.view')}
          </Button>
          <Button
            type="link"
            icon={<LayoutOutlined />}
            onClick={() => handleOpenEditor(record)}
          >
            {t('panelTemplate.actions.editLayout')}
          </Button>
          {!record.isSystem && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                {t('panelTemplate.actions.edit')}
              </Button>
              <Popconfirm
                title={t('panelTemplate.modals.deleteConfirm')}
                description={t('panelTemplate.modals.deleteConfirmDescription')}
                onConfirm={() => handleDelete(record.id)}
                okText={t('panelTemplate.buttons.confirm')}
                cancelText={t('panelTemplate.buttons.cancel')}
              >
                <Button type="link" danger icon={<DeleteOutlined />}>
                  {t('panelTemplate.actions.delete')}
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
              <Title level={3}>{t('panelTemplate.title')}</Title>
              <Paragraph type="secondary">
                {t('panelTemplate.description')}
              </Paragraph>
            </div>
            <Space>
              <Button onClick={handleInitSystemTemplates}>{t('panelTemplate.actions.initSystemTemplates')}</Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreate}
              >
                {t('panelTemplate.actions.create')}
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
        title={editingTemplate ? t('panelTemplate.modals.editTitle') : t('panelTemplate.modals.createTitle')}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label={t('panelTemplate.formLabels.name')}
            rules={[{ required: true, message: t('panelTemplate.validation.nameRequired') }]}
          >
            <Input placeholder={t('panelTemplate.formPlaceholders.name')} />
          </Form.Item>

          <Form.Item
            name="type"
            label={t('panelTemplate.formLabels.type')}
            rules={[{ required: true, message: t('panelTemplate.validation.typeRequired') }]}
          >
            <Select>
              <Select.Option value="ETHERNET">{t('panelTemplate.panelTypes.ETHERNET')}</Select.Option>
              <Select.Option value="FIBER">{t('panelTemplate.panelTypes.FIBER')}</Select.Option>
              <Select.Option value="POWER">{t('panelTemplate.panelTypes.POWER')}</Select.Option>
              <Select.Option value="SERIAL">{t('panelTemplate.panelTypes.SERIAL')}</Select.Option>
              <Select.Option value="USB">{t('panelTemplate.panelTypes.USB')}</Select.Option>
              <Select.Option value="OTHER">{t('panelTemplate.panelTypes.OTHER')}</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="portCount"
            label={t('panelTemplate.formLabels.portCount')}
            rules={[{ required: true, message: t('panelTemplate.validation.portCountRequired') }]}
          >
            <InputNumber min={1} max={96} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label={t('panelTemplate.formLabels.description')}>
            <Input.TextArea rows={3} placeholder={t('panelTemplate.formPlaceholders.description')} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 查看模板详情 Modal */}
      <Modal
        title={t('panelTemplate.modals.viewTitle')}
        open={viewModalVisible}
        onCancel={() => setViewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setViewModalVisible(false)}>
            {t('panelTemplate.buttons.close')}
          </Button>,
        ]}
        width={800}
      >
        {viewingTemplate && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Card size="small" title={t('panelTemplate.modals.basicInfo')}>
              <p>
                <strong>{t('panelTemplate.fields.name')}:</strong> {viewingTemplate.name}
              </p>
              <p>
                <strong>{t('panelTemplate.fields.type')}:</strong> {viewingTemplate.type}
              </p>
              <p>
                <strong>{t('panelTemplate.fields.portCount')}:</strong> {viewingTemplate.portCount}
              </p>
              <p>
                <strong>{t('panelTemplate.fields.description')}:</strong> {viewingTemplate.description || t('panelTemplate.table.noData')}
              </p>
              <p>
                <strong>{t('panelTemplate.fields.size')}:</strong> {formatPanelSize(viewingTemplate.width, viewingTemplate.height)}
              </p>
            </Card>

            {viewingTemplate.portDefinitions && (
              <Card size="small" title={t('panelTemplate.modals.portLayoutPreview')}>
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
                        message.info(t('panelTemplate.messages.portInfo', { number: port.number }));
                      }}
                    />
                  );
                })()}
              </Card>
            )}

            {(viewingTemplate as any).panels && (
              <Card size="small" title={t('panelTemplate.modals.usePanels')}>
                <p>{t('panelTemplate.table.panelCount', { count: (viewingTemplate as any).panels.length })}</p>
              </Card>
            )}
          </Space>
        )}
      </Modal>

      {/* 布局编辑器 Modal */}
      <Modal
        title={t('panelTemplate.modals.editLayoutTitle')}
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
