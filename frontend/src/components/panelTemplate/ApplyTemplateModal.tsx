import { useTranslation } from 'react-i18next';
import { Modal, Skeleton, message } from 'antd';
import { ApiError, errorText } from '@/services/api';
import { useApplyPreview, useApplyTemplate } from '@/api/hooks/panelTemplates';
import { ApplyDiffView } from './ApplyDiffView';

interface ApplyTemplateModalProps {
  open: boolean;
  templateId: string | null;
  panelId: string | null;
  onClose: (changed: boolean) => void;
}

/** Diff preview first, then one transactional apply pinned to the previewed revision. */
export function ApplyTemplateModal({ open, templateId, panelId, onClose }: ApplyTemplateModalProps) {
  const { t } = useTranslation('panel');
  const preview = useApplyPreview(open ? templateId : null, open ? panelId : null);
  const apply = useApplyTemplate();
  const diff = preview.data;
  const blocked = !diff || diff.conflicts.length > 0;

  const confirm = async () => {
    if (!diff) return;
    try {
      await apply.mutateAsync({ templateId: diff.templateId, panelId: diff.panelId, expectedRevision: diff.revision });
      message.success(t('apply.done'));
      onClose(true);
    } catch (e) {
      message.error(errorText(e));
      // the template or the panel changed under us: show the current diff
      if (e instanceof ApiError && (e.code === 'TEMPLATE_CONFLICT' || e.code === 'TEMPLATE_REVISION_MISMATCH')) preview.refetch();
    }
  };

  return (
    <Modal
      title={t('apply.title')}
      open={open}
      onCancel={() => onClose(false)}
      onOk={confirm}
      okText={t('apply.confirm')}
      okButtonProps={{ disabled: blocked, loading: apply.isPending, 'data-testid': 'apply-template-confirm' }}
      width={760}
      destroyOnHidden
    >
      {diff ? <ApplyDiffView diff={diff} /> : <Skeleton active />}
    </Modal>
  );
}
