import { useCallback, useEffect, useRef, useState } from 'react';
import { AutoComplete, Button, Input, Layout, Select, Space, Tooltip, message, theme } from 'antd';
import type { InputRef } from 'antd';
import { BarcodeOutlined, LoadingOutlined, MenuOutlined, MobileOutlined, MoonOutlined, SunOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PathNode } from '@contracts/common';
import type { PathKind } from '@contracts/enums';
import type { SearchKind } from '@contracts/search';
import { parseShortId } from '@contracts/shortId';
import LanguageSwitcher from '../LanguageSwitcher';
import AppBreadcrumb from './AppBreadcrumb';
import { useUiPrefs } from '../../stores/uiPrefs';
import { paletteShortcut } from '../CommandPalette/shortcut';
import { labelService } from '@/services/labelService';
import { searchService } from '@/services/searchService';
import { pathForEntity } from '@/routes';
import { DECK_SCALES, useDeckMode, type DeckScale } from '../../stores/deckMode';

const { Header } = Layout;

interface Hit {
  key: string;
  kind: SearchKind | PathKind;
  id: string;
  name: string;
  path: PathNode[];
  description: string | null;
}

const toShortId = (text: string): number | null => {
  try {
    return parseShortId(text);
  } catch {
    return null;
  }
};

const pathText = (path: PathNode[]) =>
  path
    .filter((n) => n.kind !== 'DATACENTER')
    .map((n) => n.name)
    .join(' / ');

export default function AppHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const deckEnabled = useDeckMode((s) => s.enabled);
  const deckScale = useDeckMode((s) => s.scale);
  const setScale = useDeckMode((s) => s.setScale);
  const toggleDeck = useDeckMode((s) => s.toggle);
  const toggleSidebar = useDeckMode((s) => s.toggleSidebar);
  const mode = useUiPrefs((s) => s.theme);
  const toggleTheme = useUiPrefs((s) => s.toggleTheme);
  const openPalette = useUiPrefs((s) => s.setPaletteOpen);
  const { token } = theme.useToken();

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const seq = useRef(0);

  // Tab outside an input jumps to the search box (scanner workflow)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const el = document.activeElement;
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.getAttribute('contenteditable') === 'true';
      if (!typing) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleSearch = useCallback(
    async (value: string) => {
      setQuery(value);
      const q = value.trim();
      const mine = ++seq.current;
      if (!q) {
        setHits([]);
        setNotice(null);
        return;
      }
      setSearching(true);
      try {
        const shortId = /^e-\d+$/i.test(q) ? toShortId(q) : null;
        if (shortId !== null) {
          // a scanned label: one call, the answer carries the full location path
          const r = await labelService.resolve({ shortId }, { silent: true });
          if (mine !== seq.current) return;
          if (r.bound) {
            const last = r.bound.path[r.bound.path.length - 1];
            setHits([{ key: `${r.bound.kind}-${r.bound.id}`, kind: r.bound.kind, id: r.bound.id, name: last?.name ?? r.display, path: r.bound.path, description: r.display }]);
            setNotice(null);
          } else {
            setHits([]);
            setNotice(t(r.state === null ? 'scan.unknown' : r.state === 'VOID' ? 'scan.void' : 'scan.unbound', { display: r.display }));
          }
          return;
        }
        // free text (pure digits also resolve a label on the server)
        const rows = await searchService.global({ q, take: 10 }, { silent: true });
        if (mine !== seq.current) return;
        setHits(rows.map((h) => ({ key: `${h.kind}-${h.id}`, kind: h.kind, id: h.id, name: h.name, path: h.path, description: h.description })));
        setNotice(null);
      } catch {
        if (mine === seq.current) {
          setHits([]);
          setNotice(t('searchFailed'));
        }
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    },
    [t],
  );

  const go = useCallback(
    (hit: Hit) => {
      navigate(pathForEntity(hit.kind, hit.id, hit.path));
      setQuery('');
      setHits([]);
      setNotice(null);
    },
    [navigate],
  );

  const handlePressEnter = () => {
    if (hits.length) go(hits[0]);
    else if (notice) {
      message.warning(notice);
      setQuery('');
      setNotice(null);
    }
  };

  const options = hits.map((h) => {
    const where = pathText(h.path.slice(0, -1));
    return {
      value: h.key,
      label: `[${t(`entityKinds.${h.kind}`)}] ${h.name}${h.description ? ` (${h.description})` : ''}${where ? ` - ${where}` : ''}`,
    };
  });

  return (
    <Header
      className="app-header"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: deckEnabled ? 6 : 12,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {deckEnabled && <Button type="text" icon={<MenuOutlined />} onClick={toggleSidebar} />}
      {!deckEnabled && <AppBreadcrumb />}

      {/* search box: where the barcode scanner types */}
      <div style={{ marginLeft: 'auto', width: deckEnabled ? 240 : 340 }}>
        <AutoComplete
          value={query}
          options={options}
          onSearch={handleSearch}
          onSelect={(key: string) => {
            const hit = hits.find((h) => h.key === key);
            if (hit) go(hit);
          }}
          notFoundContent={notice}
          style={{ width: '100%' }}
          placeholder={t('searchPlaceholder')}
        >
          <Input
            ref={inputRef}
            data-testid="global-search"
            suffix={searching ? <LoadingOutlined style={{ color: token.colorTextTertiary }} /> : <BarcodeOutlined style={{ color: token.colorTextTertiary }} />}
            allowClear
            onPressEnter={handlePressEnter}
          />
        </AutoComplete>
      </div>

      <Space size={4}>
        {!deckEnabled && (
          <Tooltip title={t('palette.open')}>
            <Button className="app-kbd-button" icon={<ThunderboltOutlined />} onClick={() => openPalette(true)} data-testid="command-palette-open">
              <kbd className="app-kbd">{paletteShortcut()}</kbd>
            </Button>
          </Tooltip>
        )}
        {deckEnabled && (
          <Select<DeckScale>
            size="small"
            value={deckScale}
            onChange={setScale}
            style={{ width: 72 }}
            options={DECK_SCALES.map((s) => ({ value: s, label: `${Math.round(s * 100)}%` }))}
          />
        )}
        <Tooltip title={t(mode === 'dark' ? 'theme.toLight' : 'theme.toDark')}>
          <Button type="text" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggleTheme} data-testid="theme-toggle" />
        </Tooltip>
        <Tooltip title={t('actions.deckMode')}>
          <Button
            type="text"
            icon={<MobileOutlined />}
            onClick={() => {
              toggleDeck();
              message.info(t(deckEnabled ? 'actions.deckModeOff' : 'actions.deckModeOn'));
            }}
            style={{ color: deckEnabled ? token.colorPrimary : undefined }}
            data-testid="deck-mode-toggle"
          />
        </Tooltip>
        {!deckEnabled && <LanguageSwitcher />}
      </Space>
    </Header>
  );
}
