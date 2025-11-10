import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { GlobalOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import { SUPPORTED_LANGUAGES } from '../locales/languages';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  // 动态生成语言选项（从配置中读取）
  const languageOptions: SelectProps['options'] = SUPPORTED_LANGUAGES.map((lang) => ({
    label: `${lang.flag || ''} ${lang.nativeName}`.trim(),
    value: lang.code,
  }));

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
    // 手动保存到 localStorage（i18n 的 LanguageDetector 已配置自动保存）
    localStorage.setItem('i18nextLng', value);
  };

  return (
    <Select
      value={i18n.language}
      onChange={handleLanguageChange}
      options={languageOptions}
      suffixIcon={<GlobalOutlined />}
      style={{
        width: 150,
      }}
      variant="borderless"
    />
  );
};

export default LanguageSwitcher;
