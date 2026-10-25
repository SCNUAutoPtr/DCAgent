import { useTranslation } from 'react-i18next';

/** "U5-U6, 2U" / "U5, 1U" / "U5, height unknown" for a racked device. */
export function useUText() {
  const { t } = useTranslation('datacenter3d');
  return (from: number, uHeight: number | null) =>
    uHeight === null
      ? t('tooltip.uUnknownHeight', { from })
      : uHeight > 1
        ? t('tooltip.uRange', { from, to: from + uHeight - 1, height: uHeight })
        : t('tooltip.uSingle', { from });
}
