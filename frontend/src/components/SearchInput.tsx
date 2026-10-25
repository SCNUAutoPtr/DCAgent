import { useState } from 'react';
import { Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';

interface SearchInputProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  style?: CSSProperties;
  testId?: string;
}

/** Search box: Enter searches, clearing searches for everything again. */
export function SearchInput({ placeholder, onSearch, style, testId }: SearchInputProps) {
  const [value, setValue] = useState('');
  return (
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      value={value}
      style={style}
      data-testid={testId}
      onChange={(e) => {
        setValue(e.target.value);
        if (!e.target.value) onSearch('');
      }}
      onPressEnter={() => onSearch(value.trim())}
    />
  );
}
