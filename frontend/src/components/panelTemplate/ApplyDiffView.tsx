import { useTranslation } from 'react-i18next';
import { Alert, Descriptions, Space, Tag, Typography } from 'antd';
import type { ApplyDiff } from '@contracts/panelTemplates';

const { Text } = Typography;

const LIMIT = 60;

function Numbers({ items, color }: { items: string[]; color?: string }) {
  if (!items.length) return <Text type="secondary">-</Text>;
  return (
    <Space size={[4, 4]} wrap>
      {items.slice(0, LIMIT).map((n) => (
        <Tag key={n} color={color} style={{ marginInlineEnd: 0 }}>
          {n}
        </Tag>
      ))}
      {items.length > LIMIT && <Text type="secondary">+{items.length - LIMIT}</Text>}
    </Space>
  );
}

/** What an apply will do to one panel: new / updated / deleted / kept ports and conflicts that block it. */
export function ApplyDiffView({ diff }: { diff: ApplyDiff }) {
  const { t } = useTranslation('panel');
  return (
    <Space direction="vertical" style={{ width: '100%' }} data-testid="apply-diff">
      {diff.conflicts.length > 0 && (
        <Alert
          type="error"
          showIcon
          data-testid="apply-conflicts"
          message={t('apply.conflictsTitle')}
          description={diff.conflicts.map((c) => (
            <div key={`${c.kind}-${c.portId}`}>{t(`apply.conflicts.${c.kind}`, { number: c.number, value: c.value })}</div>
          ))}
        />
      )}
      <Descriptions column={1} size="small" bordered labelStyle={{ width: 160 }}>
        <Descriptions.Item label={t('apply.create', { count: diff.create.length })}>
          <Numbers items={diff.create.map((c) => c.number)} color="green" />
        </Descriptions.Item>
        <Descriptions.Item label={t('apply.update', { count: diff.update.length })}>
          <Numbers items={diff.update.map((u) => u.number)} color="blue" />
        </Descriptions.Item>
        <Descriptions.Item label={t('apply.delete', { count: diff.delete.length })}>
          <Numbers items={diff.delete.map((d) => d.number)} color="red" />
        </Descriptions.Item>
        <Descriptions.Item label={t('apply.kept', { count: diff.kept.length })}>
          {diff.kept.length ? (
            <Space size={[4, 4]} wrap>
              {diff.kept.map((k) => (
                <Tag key={k.portId} color="orange" style={{ marginInlineEnd: 0 }}>
                  {k.number}: {k.reasons.map((r) => t(`apply.reasons.${r}`)).join(', ')}
                </Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">-</Text>
          )}
        </Descriptions.Item>
      </Descriptions>
      <Text type="secondary">{t('apply.untouched')}</Text>
    </Space>
  );
}
