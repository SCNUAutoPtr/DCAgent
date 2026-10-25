import { Form, Input, Space } from 'antd';
import type { Rule } from 'antd/es/form';
import { ScanOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { LabelKind } from '@contracts/enums';
import { labelService } from '@/services/labelService';
import { parseLabelInput } from '@/utils/labels';

interface LabelFieldProps {
  name: string;
  /** the entity being edited: its own current label is not "bound elsewhere" */
  self?: { kind: LabelKind; id: string };
  /** empty is allowed and means "allocate one automatically" (cabinets, panels, cable ends) */
  autoAllocate?: boolean;
  required?: boolean;
  label?: React.ReactNode;
  testId?: string;
  disabled?: boolean;
}

/**
 * Form item for a scanned or typed label number. Checks the format locally and, on blur,
 * asks labels/resolve whether the number is void or bound to another entity.
 */
export function LabelField({ name, self, autoAllocate, required, label, testId, disabled }: LabelFieldProps) {
  const { t } = useTranslation('common');

  const rules: Rule[] = [
    ...(required ? [{ required: true, message: t('label.invalid') }] : []),
    {
      validator: async (_rule, value) => {
        let shortId: number | undefined;
        try {
          shortId = parseLabelInput(value);
        } catch {
          throw new Error(t('label.invalid'));
        }
        if (shortId === undefined) return;
        const r = await labelService.resolve({ shortId }, { silent: true });
        if (r.state === 'VOID') throw new Error(t('label.void'));
        if (r.bound && !(self && r.bound.kind === self.kind && r.bound.id === self.id)) {
          const last = r.bound.path[r.bound.path.length - 1];
          const where = r.bound.path
            .filter((n) => n.kind !== 'DATACENTER')
            .map((n) => n.name)
            .join(' / ');
          throw new Error(t('label.bound', { name: where || last?.name || r.display }));
        }
      },
    },
  ];

  return (
    <Form.Item
      name={name}
      label={
        label ?? (
          <Space>
            <ScanOutlined />
            {t('label.field')}
          </Space>
        )
      }
      rules={rules}
      validateTrigger="onBlur"
    >
      <Input placeholder={t(autoAllocate ? 'label.placeholderAuto' : 'label.placeholder')} data-testid={testId} disabled={disabled} allowClear />
    </Form.Item>
  );
}
