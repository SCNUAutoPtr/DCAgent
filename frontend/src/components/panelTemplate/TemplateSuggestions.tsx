import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Checkbox, Space, Typography } from 'antd';
import { usePanelTemplates } from '@/api/hooks/panelTemplates';

const { Text } = Typography;

interface TemplateSuggestionsProps {
  deviceModelId?: string | null;
  /** chosen template ids (Form.Item value) */
  value?: string[];
  onChange?: (ids: string[]) => void;
}

/**
 * Shown while creating a device: the templates of its model. All are pre-selected;
 * the chosen ones become panels right after the device is created.
 */
export function TemplateSuggestions({ deviceModelId, value = [], onChange }: TemplateSuggestionsProps) {
  const { t } = useTranslation('panel');
  const { data } = usePanelTemplates({ deviceModelId: deviceModelId ?? undefined }, { enabled: !!deviceModelId });
  const templates = deviceModelId ? data ?? [] : [];

  useEffect(() => {
    onChange?.(templates.map((x) => x.id));
    // re-select only when the model's template list changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceModelId, data]);

  if (!templates.length) return null;
  return (
    <Alert
      type="info"
      showIcon
      data-testid="template-suggestions"
      style={{ marginBottom: 16 }}
      message={t('suggest.title', { count: templates.length })}
      description={
        <Space direction="vertical" size={4}>
          <Checkbox.Group
            value={value}
            onChange={(v) => onChange?.(v as string[])}
            options={templates.map((x) => ({
              value: x.id,
              label: `${x.name} (${t(`faces.${x.face}`)}, ${t('editor.templateInfo', { count: x.portCount, revision: x.revision })})`,
            }))}
          />
          <Text type="secondary">{t('suggest.hint')}</Text>
        </Space>
      }
    />
  );
}
