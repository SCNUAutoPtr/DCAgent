import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Modal, Popconfirm, Space, Table, Tag, Typography, message } from 'antd';
import { AppstoreAddOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined, PlusOutlined, ThunderboltOutlined, UploadOutlined } from '@ant-design/icons';
import type { PanelFace, PanelType } from '@contracts/enums';
import type { PanelTemplateDto, TemplateDoc } from '@contracts/panelTemplates';
import { U_HEIGHT_MM } from '@contracts/scene';
import { panelTemplateService } from '@/services/panelTemplateService';
import { saveBlob } from '@/services/api';
import { useDeleteTemplate, useImportPresets, useImportTemplates, usePanelTemplate, usePanelTemplates } from '@/api/hooks/panelTemplates';
import { PanelView } from '@/components/panel/PanelView';
import { TemplateEditorDrawer } from '@/components/panelTemplate/TemplateEditorDrawer';
import { BatchApplyModal } from '@/components/panelTemplate/BatchApplyModal';

const { Title, Paragraph } = Typography;

const DOC_FORMAT = 'dcagent.panel-template';
const uOf = (heightMm: number) => Math.round((heightMm / U_HEIGHT_MM) * 10) / 10;

export default function PanelTemplateManagementPage() {
  const { t } = useTranslation('panel');
  const list = usePanelTemplates();
  const remove = useDeleteTemplate();
  const importDoc = useImportTemplates();
  const importPresets = useImportPresets();
  const [selected, setSelected] = useState<string[]>([]);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [batch, setBatch] = useState<PanelTemplateDto | null>(null);
  const viewing = usePanelTemplate(viewId);
  const editing = usePanelTemplate(editId);
  const fileRef = useRef<HTMLInputElement>(null);

  const imported = (r: { created: string[]; updated: string[]; unchanged: string[] }) =>
    message.success(t('templates.imported', { created: r.created.length, updated: r.updated.length, unchanged: r.unchanged.length }));

  const exportSelected = async () => {
    try {
      const doc = await panelTemplateService.export({ ids: selected.length ? selected : undefined });
      saveBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `panel-templates-${new Date().toISOString().slice(0, 10)}.json`);
      message.success(t('templates.exported', { count: doc.templates.length }));
    } catch {
      // reported by rpc
    }
  };

  const importFile = async (file: File) => {
    let doc: TemplateDoc;
    try {
      doc = JSON.parse(await file.text()) as TemplateDoc;
      if (doc.format !== DOC_FORMAT) throw new Error('format');
    } catch {
      message.error(t('templates.importInvalid', { format: DOC_FORMAT }));
      return;
    }
    try {
      imported(await importDoc.mutateAsync({ doc, mode: 'upsert' }));
    } catch {
      // reported by rpc
    }
  };

  const runPresets = async () => {
    try {
      imported(await importPresets.mutateAsync(undefined));
    } catch {
      // reported by rpc
    }
  };

  const columns = [
    { title: t('templates.fields.name'), dataIndex: 'name', key: 'name' },
    { title: t('templates.fields.type'), dataIndex: 'type', key: 'type', render: (v: PanelType) => t(`panelTypes.${v}`) },
    { title: t('templates.fields.face'), dataIndex: 'face', key: 'face', render: (v: PanelFace) => t(`faces.${v}`) },
    {
      title: t('templates.fields.deviceModel'),
      key: 'deviceModel',
      render: (_: unknown, r: PanelTemplateDto) => (r.deviceModel ? `${r.deviceModel.vendor} ${r.deviceModel.name}`.trim() : '-'),
    },
    {
      title: t('templates.fields.size'),
      key: 'size',
      render: (_: unknown, r: PanelTemplateDto) => `${r.widthMm} x ${r.heightMm} mm (${uOf(r.heightMm)}U)`,
    },
    {
      title: t('templates.fields.source'),
      key: 'source',
      render: (_: unknown, r: PanelTemplateDto) => <Tag color={r.generator ? 'blue' : 'default'}>{t(r.generator ? 'templates.modeGenerator' : 'templates.modeManual')}</Tag>,
    },
    { title: t('templates.fields.portCount'), dataIndex: 'portCount', key: 'portCount', width: 90 },
    { title: t('templates.fields.panelCount'), dataIndex: 'panelCount', key: 'panelCount', width: 100 },
    { title: t('templates.fields.revision'), dataIndex: 'revision', key: 'revision', width: 80, render: (v: number) => <Tag>r{v}</Tag> },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, r: PanelTemplateDto) => (
        <Space size={0} wrap>
          <Button type="link" icon={<EyeOutlined />} onClick={() => setViewId(r.id)}>
            {t('templates.actions.view')}
          </Button>
          <Button type="link" icon={<EditOutlined />} onClick={() => setEditId(r.id)} data-testid={`template-edit-${r.name}`}>
            {t('templates.actions.edit')}
          </Button>
          <Button type="link" icon={<ThunderboltOutlined />} disabled={!r.deviceModelId} onClick={() => setBatch(r)}>
            {t('templates.actions.batchApply')}
          </Button>
          <Popconfirm
            title={t('templates.deleteConfirm')}
            description={t('templates.deleteConfirmDescription', { count: r.panelCount })}
            onConfirm={() => remove.mutateAsync({ id: r.id }).then(() => message.success(t('templates.deleted')), () => undefined)}
            okText={t('buttons.confirm')}
            cancelText={t('buttons.cancel')}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t('templates.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const view = viewing.data;

  return (
    <div>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <Title level={3}>{t('templates.title')}</Title>
              <Paragraph type="secondary">{t('templates.description')}</Paragraph>
            </div>
            <Space wrap>
              <Button icon={<AppstoreAddOutlined />} onClick={runPresets} loading={importPresets.isPending} data-testid="template-import-presets">
                {t('templates.actions.importPresets')}
              </Button>
              <Button icon={<UploadOutlined />} onClick={() => fileRef.current?.click()}>
                {t('templates.actions.import')}
              </Button>
              <Button icon={<DownloadOutlined />} onClick={exportSelected}>
                {t('templates.actions.export')}
                {selected.length ? ` (${selected.length})` : ''}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) importFile(file);
                }}
              />
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)} data-testid="template-create">
                {t('templates.actions.create')}
              </Button>
            </Space>
          </div>
          <Table
            dataSource={list.data ?? []}
            columns={columns}
            rowKey="id"
            loading={list.isLoading}
            rowSelection={{ selectedRowKeys: selected, onChange: (keys) => setSelected(keys as string[]) }}
            pagination={{ pageSize: 20 }}
            scroll={{ x: true }}
          />
        </Space>
      </Card>

      <Modal title={t('templates.viewTitle')} open={!!viewId} onCancel={() => setViewId(null)} footer={null} width={1000}>
        {view && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Paragraph>
              <strong>{view.name}</strong> · {t(`panelTypes.${view.type}`)} · {t(`faces.${view.face}`)} · {view.widthMm} x {view.heightMm} mm · r{view.revision}
            </Paragraph>
            {view.description && <Paragraph type="secondary">{view.description}</Paragraph>}
            <div style={{ overflowX: 'auto' }}>
              <PanelView panel={{ name: view.name, widthMm: view.widthMm, heightMm: view.heightMm }} ports={view.ports ?? []} showLegend={false} labelMode="always" scale={1.8} />
            </div>
            <Paragraph type="secondary">{t('templates.panelCount', { count: view.panelCount })}</Paragraph>
          </Space>
        )}
      </Modal>

      <TemplateEditorDrawer
        open={creating || (!!editId && !!editing.data)}
        template={creating ? null : editing.data ?? null}
        onClose={() => {
          setCreating(false);
          setEditId(null);
        }}
      />
      <BatchApplyModal open={!!batch} template={batch} onClose={() => setBatch(null)} />
    </div>
  );
}
