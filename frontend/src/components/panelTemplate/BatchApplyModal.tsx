import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Space, Table, Tag, Typography, message } from 'antd';
import type { BatchTarget } from '@contracts/panelTemplates';
import { ApiError, errorText } from '@/services/api';
import { useBatchApplyTemplate, useBatchPreview } from '@/api/hooks/panelTemplates';
import { ApplyDiffView } from './ApplyDiffView';

const { Text } = Typography;

interface BatchApplyModalProps {
  open: boolean;
  template: { id: string; name: string; deviceModel: { vendor: string; name: string } | null } | null;
  onClose: (changed: boolean) => void;
}

const conflicted = (x: BatchTarget) => !!x.diff?.conflicts.length;

/** Apply one template to every device of its model in a single transaction. */
export function BatchApplyModal({ open, template, onClose }: BatchApplyModalProps) {
  const { t } = useTranslation('panel');
  const preview = useBatchPreview(open && template ? template.id : null);
  const apply = useBatchApplyTemplate();
  const [selected, setSelected] = useState<string[]>([]);
  const targets = preview.data?.targets ?? [];

  // every target without conflicts is selected whenever a new preview arrives
  useEffect(() => {
    setSelected((preview.data?.targets ?? []).filter((x) => !conflicted(x)).map((x) => x.deviceId));
  }, [preview.data]);

  const confirm = async () => {
    if (!preview.data || !template) return;
    const chosen = targets.filter((x) => selected.includes(x.deviceId));
    try {
      const r = await apply.mutateAsync({
        templateId: template.id,
        expectedRevision: preview.data.revision,
        targets: chosen.map((x) => ({ deviceId: x.deviceId, panelId: x.panelId })),
      });
      message.success(t('batch.done', { count: r.applied.length }));
      onClose(true);
    } catch (e) {
      message.error(errorText(e));
      if (e instanceof ApiError && (e.code === 'TEMPLATE_CONFLICT' || e.code === 'TEMPLATE_REVISION_MISMATCH')) preview.refetch();
    }
  };

  const model = template?.deviceModel ? `${template.deviceModel.vendor} ${template.deviceModel.name}`.trim() : '';

  return (
    <Modal
      title={t('batch.title', { name: template?.name ?? '' })}
      open={open}
      onCancel={() => onClose(false)}
      onOk={confirm}
      okText={t('batch.confirm', { count: selected.length })}
      okButtonProps={{ disabled: !selected.length, loading: apply.isPending, 'data-testid': 'batch-apply-confirm' }}
      width={900}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        {template && !template.deviceModel ? (
          <Alert type="warning" showIcon message={t('batch.noModel')} />
        ) : (
          <Text type="secondary">{t('batch.hint', { model, count: targets.length })}</Text>
        )}
        <Table<BatchTarget>
          size="small"
          rowKey="deviceId"
          loading={preview.isFetching}
          dataSource={targets}
          pagination={false}
          rowSelection={{
            selectedRowKeys: selected,
            onChange: (keys) => setSelected(keys as string[]),
            getCheckboxProps: (x) => ({ disabled: conflicted(x) }),
          }}
          expandable={{ expandedRowRender: (x) => (x.diff ? <ApplyDiffView diff={x.diff} /> : <Text>{t('batch.newPanelDetail')}</Text>) }}
          columns={[
            { title: t('batch.device'), dataIndex: 'deviceName' },
            {
              title: t('batch.panel'),
              render: (_, x) => (x.panelId ? x.panelName : <Tag color="green">{t('batch.newPanel')}</Tag>),
            },
            {
              title: t('batch.summary'),
              render: (_, x) =>
                x.diff ? (
                  <Space size={4} wrap>
                    <Tag color="green">+{x.diff.create.length}</Tag>
                    <Tag color="blue">~{x.diff.update.length}</Tag>
                    <Tag color="red">-{x.diff.delete.length}</Tag>
                    {x.diff.kept.length > 0 && <Tag color="orange">{t('apply.kept', { count: x.diff.kept.length })}</Tag>}
                    {conflicted(x) && <Tag color="error">{t('batch.conflicts', { count: x.diff.conflicts.length })}</Tag>}
                  </Space>
                ) : (
                  '-'
                ),
            },
          ]}
        />
      </Space>
    </Modal>
  );
}
