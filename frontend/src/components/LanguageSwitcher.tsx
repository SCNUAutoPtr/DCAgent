import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';
import { SUPPORTED_LANGUAGES } from '../locales/languages';

const options = SUPPORTED_LANGUAGES.map((l) => ({ label: l.nativeName, value: l.code }));

/** The language detector caches the choice in localStorage. The globe sits in front of the label, the select is as wide as its text. */
export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <Select
      value={i18n.language}
      onChange={(value: string) => i18n.changeLanguage(value)}
      options={options}
      prefix={<GlobalOutlined />}
      popupMatchSelectWidth={false}
      style={{ width: 'auto' }}
      variant="borderless"
      data-testid="language-switcher"
    />
  );
}
