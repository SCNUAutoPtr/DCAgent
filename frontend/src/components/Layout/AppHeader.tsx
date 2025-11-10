import { useState, useCallback, useRef, useEffect } from 'react';
import { Layout, Typography, AutoComplete, Input, message, Modal } from 'antd';
import { DatabaseOutlined, SearchOutlined, BarcodeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../LanguageSwitcher';
import searchService, { SearchResult } from '../../services/searchService';
import {
  formatSearchResultLabel,
  navigateToEntity,
  navigateToCableEndpoint,
  getSearchResultKey,
} from '../../utils/navigationHelper';
import { ShortIdFormatter } from '../../utils/shortIdFormatter';

const { Header } = Layout;
const { Title } = Typography;

export default function AppHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string; data: SearchResult }[]>([]);
  const [searching, setSearching] = useState(false);
  const searchInputRef = useRef<any>(null);
  const [lastSearchWasShortId, setLastSearchWasShortId] = useState(false);

  // 全局 Tab 键监听，聚焦到搜索框
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 按下 Tab 键且不在输入框、文本域等元素中
      if (e.key === 'Tab') {
        const activeElement = document.activeElement;
        const isInInput = activeElement?.tagName === 'INPUT' ||
                         activeElement?.tagName === 'TEXTAREA' ||
                         activeElement?.getAttribute('contenteditable') === 'true';

        // 如果当前不在输入框中，阻止默认行为并聚焦到搜索框
        if (!isInInput) {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // 处理搜索
  const handleSearch = useCallback(async (value: string) => {
    setSearchQuery(value);

    if (!value || value.trim().length === 0) {
      setSearchOptions([]);
      setLastSearchWasShortId(false);
      return;
    }

    const trimmedValue = value.trim();

    // 尝试解析为 shortId（支持 E-00003 或 3 格式）
    let isShortIdFormat = false;
    try {
      const numericValue = ShortIdFormatter.toNumericFormat(trimmedValue);
      isShortIdFormat = true;

      // 如果成功解析为数字，尝试根据 shortId 查找
      setSearching(true);
      try {
        const result = await searchService.findByShortId(numericValue);
        if (result) {
          setSearchOptions([
            {
              value: getSearchResultKey(result),
              label: formatSearchResultLabel(result),
              data: result,
            },
          ]);
          setLastSearchWasShortId(true);
          return;
        } else {
          // shortId 格式正确，但未找到结果 - 只标记，不清空
          setSearchOptions([]);
          setLastSearchWasShortId(true);
          return;
        }
      } catch (error) {
        console.error('Error finding by shortId:', error);
        // 查询出错 - 只标记，不清空
        setSearchOptions([]);
        setLastSearchWasShortId(true);
        return;
      } finally {
        setSearching(false);
      }
    } catch {
      // 不是有效的 shortId 格式，继续进行文本搜索
      setLastSearchWasShortId(false);
    }

    // 全局文本搜索
    setSearching(true);
    try {
      const results = await searchService.globalSearch(trimmedValue);
      setSearchOptions(
        results.map((result) => ({
          value: getSearchResultKey(result),
          label: formatSearchResultLabel(result),
          data: result,
        }))
      );
    } catch (error) {
      console.error('Error in global search:', error);
      message.error(t('searchFailed'));
      setSearchOptions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 处理选择搜索结果
  const handleSelect = useCallback(
    async (value: string) => {
      const selectedOption = searchOptions.find((opt) => opt.value === value);
      if (!selectedOption) return;

      const result = selectedOption.data;

      // 如果是线缆，需要先查询端点信息再跳转
      if (result.type === 'Cable') {
        try {
          const endpoints = await searchService.getCableEndpointsByShortId(result.shortId);

          if (!endpoints) {
            message.warning('未找到线缆连接信息');
            return;
          }

          const { cable, endpointA, endpointB, portA, portB } = endpoints;

          // 判断连接状态
          const aConnected = !!portA;
          const bConnected = !!portB;
          const scannedEndType = result.metadata?.endType as 'A' | 'B' | undefined;
          const scannedEnd = scannedEndType || 'A';
          const scannedConnected = scannedEnd === 'A' ? aConnected : bConnected;
          const otherEnd = scannedEnd === 'A' ? 'B' : 'A';
          const otherConnected = scannedEnd === 'A' ? bConnected : aConnected;

          // 场景1: 双端都已连接 - 正常导航
          if (aConnected && bConnected) {
            navigateToCableEndpoint(endpoints, navigate, scannedEnd);
            const targetPort = scannedEnd === 'A' ? portA : portB;
            message.success(`跳转到线缆端点${scannedEnd}: ${targetPort?.label || targetPort?.number}`);
            return;
          }

          // 场景2: 扫描端未连接，但对端已连接 - 提供选项
          if (!scannedConnected && otherConnected) {
            const otherPort = scannedEnd === 'A' ? portB : portA;
            const otherEndpoint = scannedEnd === 'A' ? endpointB : endpointA;

            Modal.confirm({
              title: '线缆单端连接',
              content: (
                <div>
                  <p>扫描的{scannedEnd}端（ID={result.shortId}）尚未连接</p>
                  <p>但该线缆的{otherEnd}端{otherEndpoint?.shortId ? `（ID=${otherEndpoint.shortId}）` : ''}已连接到：</p>
                  <p style={{ marginLeft: 16, color: '#1890ff' }}>
                    {otherPort?.panel?.device?.label || '设备'} /
                    {otherPort?.panel?.label || '面板'} /
                    {otherPort?.number}
                  </p>
                  <p style={{ marginTop: 12 }}>是否查看{otherEnd}端的拓扑图？</p>
                </div>
              ),
              okText: `查看${otherEnd}端拓扑`,
              cancelText: '查看线缆详情',
              onOk: () => {
                // 跳转到对端
                navigateToCableEndpoint(endpoints, navigate, otherEnd);
              },
              onCancel: () => {
                // 跳转到线缆管理页面
                navigate('/cable-manual-inventory', {
                  state: {
                    highlightCableId: cable.id
                  }
                });
              }
            });
            return;
          }

          // 场景3: 双端都未连接 - 显示线缆信息
          if (!aConnected && !bConnected) {
            Modal.info({
              title: '线缆未连接',
              content: (
                <div>
                  <p>该线缆（{cable.label || cable.type}）的两端都尚未连接</p>
                  <p>A端 ID: {endpointA?.shortId || '无'}</p>
                  <p>B端 ID: {endpointB?.shortId || '无'}</p>
                  <p style={{ marginTop: 12 }}>点击确定查看线缆详情</p>
                </div>
              ),
              okText: '查看详情',
              onOk: () => {
                navigate('/cable-manual-inventory', {
                  state: { highlightCableId: cable.id }
                });
              }
            });
            return;
          }

          // 场景4: 扫描端已连接，对端未连接 - 正常导航并提示
          if (scannedConnected && !otherConnected) {
            navigateToCableEndpoint(endpoints, navigate, scannedEnd);
            const targetPort = scannedEnd === 'A' ? portA : portB;
            message.info(`跳转到${scannedEnd}端（${otherEnd}端尚未连接）: ${targetPort?.label || targetPort?.number}`);
            return;
          }

        } catch (error) {
          console.error('Error fetching cable endpoints:', error);
          message.error('获取线缆连接信息失败');
        }
      } else {
        // 其他实体直接跳转
        navigateToEntity(result, navigate);
        message.success(`跳转到 ${formatSearchResultLabel(result)}`);
      }

      // 清空搜索框
      setSearchQuery('');
      setSearchOptions([]);
    },
    [searchOptions, navigate]
  );

  // 处理回车键 - 自动选择第一个候选项
  const handlePressEnter = useCallback(() => {
    if (searchOptions.length > 0) {
      handleSelect(searchOptions[0].value);
    } else if (lastSearchWasShortId && searchQuery.trim()) {
      // shortId 格式但未找到 - 显示警告并清空
      message.warning(`shortID ${searchQuery.trim()} 尚未分配给任何实体`, 3);
      setSearchQuery('');
      setSearchOptions([]);
      setLastSearchWasShortId(false);
    }
  }, [searchOptions, handleSelect, lastSearchWasShortId, searchQuery]);


  return (
    <Header
      style={{
        display: 'flex',
        alignItems: 'center',
        background: '#001529',
        padding: '0 24px',
      }}
    >
      <DatabaseOutlined style={{ fontSize: '24px', color: '#fff', marginRight: '12px' }} />
      <Title level={4} style={{ color: '#fff', margin: 0 }}>
        DCAgent
      </Title>
      <span style={{ color: '#8c8c8c', marginLeft: '12px', fontSize: '14px' }}>
        見えない線を、見える化へ
      </span>

      {/* 全局搜索框 */}
      <div style={{ marginLeft: 'auto', width: '400px' }}>
        <AutoComplete
          value={searchQuery}
          options={searchOptions}
          onSearch={handleSearch}
          onSelect={handleSelect}
          style={{ width: '100%' }}
          placeholder={t('searchPlaceholder')}
        >
          <Input
            ref={searchInputRef}
            prefix={<SearchOutlined />}
            suffix={<BarcodeOutlined style={{ color: '#8c8c8c' }} />}
            loading={searching}
            allowClear
            onPressEnter={handlePressEnter}
          />
        </AutoComplete>
      </div>

      {/* 语言切换器 */}
      <div style={{ marginLeft: '16px' }}>
        <LanguageSwitcher />
      </div>
    </Header>
  );
}

