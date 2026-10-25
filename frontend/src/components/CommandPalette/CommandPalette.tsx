import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { Empty, Input, Modal, Spin, Typography, theme } from 'antd';
import type { InputRef } from 'antd';
import {
  ApiOutlined,
  AppstoreOutlined,
  BgColorsOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  GlobalOutlined,
  HomeOutlined,
  InboxOutlined,
  LinkOutlined,
  SearchOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PathNode } from '@contracts/common';
import type { PathKind } from '@contracts/enums';
import type { SearchKind } from '@contracts/search';
import { parseShortId } from '@contracts/shortId';
import { useGlobalSearch, useLabelResolve } from '@/api/hooks/search';
import { ROUTES, pathForEntity } from '@/routes';
import { useUiPrefs } from '@/stores/uiPrefs';

const { Text } = Typography;

type Group = 'pages' | 'assets' | 'actions';

interface Item {
  key: string;
  group: Group;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  to?: string;
  run?: () => void;
}

const KIND_ICONS: Record<SearchKind | PathKind, ReactNode> = {
  DATACENTER: <DatabaseOutlined />,
  ROOM: <HomeOutlined />,
  CABINET: <InboxOutlined />,
  DEVICE: <CloudServerOutlined />,
  PANEL: <AppstoreOutlined />,
  PORT: <ApiOutlined />,
  CABLE: <LinkOutlined />,
  CABLE_ENDPOINT: <TagOutlined />,
  WORKSTATION: <DesktopOutlined />,
  IP_ADDRESS: <GlobalOutlined />,
};

const SEARCH_TAKE = 8;
const DEBOUNCE_MS = 150;
const GROUPS: Group[] = ['assets', 'pages', 'actions'];

/** "E-00012" or "12" -> 12; anything else is free text. */
function shortIdOf(q: string): number | null {
  if (!/^(?:E-)?\d+$/i.test(q)) return null;
  try {
    return parseShortId(q);
  } catch {
    return null;
  }
}

const pathText = (path: PathNode[]) =>
  path
    .filter((n) => n.kind !== 'DATACENTER')
    .map((n) => n.name)
    .join(' / ');

function useDebounced(value: string, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

/** Ctrl/Cmd+K: jump to any page or asset. Asset hits come from search/global; label numbers from labels/resolve. */
export default function CommandPalette() {
  const open = useUiPrefs((s) => s.paletteOpen);
  const setOpen = useUiPrefs((s) => s.setPaletteOpen);
  const toggleTheme = useUiPrefs((s) => s.toggleTheme);
  const mode = useUiPrefs((s) => s.theme);
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { t: tm } = useTranslation('menu');
  const { token } = theme.useToken();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pendingEnter, setPendingEnter] = useState(false);
  const inputRef = useRef<InputRef>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // global shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(!useUiPrefs.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // focus right away so a scanner that types immediately after the shortcut loses nothing
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setActive(0);
      setPendingEnter(false);
    }
  }, [open]);

  const q = useDebounced(query.trim(), DEBOUNCE_MS);
  const shortId = shortIdOf(q);
  const search = useGlobalSearch(open ? q : '', SEARCH_TAKE);
  const resolve = useLabelResolve(open ? shortId : null);
  const typing = query.trim() !== q;
  const loading = typing || (q !== '' && search.isFetching) || (shortId !== null && resolve.isFetching);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const needle = q.toLowerCase();
    const seen = new Set<string>();

    // a label number answers first: that is what a scanner or a sticker in hand means
    const bound = shortId !== null ? resolve.data?.bound : null;
    if (bound) {
      const last = bound.path[bound.path.length - 1];
      seen.add(`${bound.kind}-${bound.id}`);
      out.push({
        key: `label-${bound.kind}-${bound.id}`,
        group: 'assets',
        icon: <TagOutlined />,
        title: `${resolve.data!.display}  ${last?.name ?? ''}`,
        subtitle: `${t(`entityKinds.${bound.kind}`)} - ${pathText(bound.path.slice(0, -1))}`,
        to: pathForEntity(bound.kind, bound.id, bound.path),
      });
    }
    if (q) {
      for (const h of search.data ?? []) {
        const key = `${h.kind}-${h.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const where = pathText(h.path.slice(0, -1));
        out.push({
          key,
          group: 'assets',
          icon: KIND_ICONS[h.kind],
          title: h.name,
          subtitle: [t(`entityKinds.${h.kind}`), h.description, where].filter(Boolean).join(' - '),
          to: pathForEntity(h.kind, h.id, h.path),
        });
      }
    }

    for (const r of ROUTES) {
      if (!r.labelKey) continue;
      const label = tm(r.labelKey);
      if (needle && !label.toLowerCase().includes(needle) && !r.path.toLowerCase().includes(needle)) continue;
      out.push({ key: `page-${r.path}`, group: 'pages', icon: r.icon, title: label, subtitle: r.path, to: r.path });
    }

    const themeLabel = t(mode === 'dark' ? 'theme.toLight' : 'theme.toDark');
    if (!needle || themeLabel.toLowerCase().includes(needle) || t('palette.themeKeywords').toLowerCase().includes(needle)) {
      out.push({ key: 'action-theme', group: 'actions', icon: <BgColorsOutlined />, title: themeLabel, run: toggleTheme });
    }
    return out;
  }, [q, shortId, resolve.data, search.data, t, tm, mode, toggleTheme]);

  const notice = useMemo(() => {
    const r = shortId !== null ? resolve.data : null;
    if (!r || r.bound) return null;
    return t(r.state === null ? 'scan.unknown' : r.state === 'VOID' ? 'scan.void' : 'scan.unbound', { display: r.display });
  }, [shortId, resolve.data, t]);

  // grouped order is the navigation order
  const ordered = useMemo(() => GROUPS.flatMap((g) => items.filter((i) => i.group === g)), [items]);

  useEffect(() => setActive(0), [q]);

  const run = useCallback(
    (item: Item | undefined) => {
      if (!item) return;
      close();
      if (item.to) navigate(item.to);
      item.run?.();
    },
    [close, navigate],
  );

  // Enter pressed before results arrived (scanner speed): take the first hit once loading ends
  useEffect(() => {
    if (pendingEnter && !loading) {
      setPendingEnter(false);
      run(ordered[0]);
    }
  }, [pendingEnter, loading, ordered, run]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, ordered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (loading && query.trim()) setPendingEnter(true);
      else run(ordered[active]);
    }
  };

  let index = -1;
  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      width={640}
      style={{ top: '12vh' }}
      className="cmdk"
      afterOpenChange={(o) => o && inputRef.current?.focus()}
      styles={{ content: { padding: 0, overflow: 'hidden' } }}
      destroyOnHidden
    >
      <div className="cmdk-input" style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
        <Input
          ref={inputRef}
          autoFocus
          size="large"
          variant="borderless"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('palette.placeholder')}
          prefix={loading ? <Spin size="small" /> : <SearchOutlined style={{ color: token.colorTextTertiary }} />}
          data-testid="command-palette-input"
        />
      </div>
      <div className="cmdk-list" ref={listRef} role="listbox">
        {notice && (
          <div className="cmdk-notice" style={{ color: token.colorWarningText, background: token.colorWarningBg }}>
            <TagOutlined /> {notice}
          </div>
        )}
        {search.isError && q && <div className="cmdk-notice" style={{ color: token.colorErrorText }}>{t('searchFailed')}</div>}
        {ordered.length === 0 && !loading && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('palette.empty')} />}
        {GROUPS.map((g) => {
          const group = ordered.filter((i) => i.group === g);
          if (!group.length) return null;
          return (
            <div key={g} className="cmdk-group">
              <div className="cmdk-group-title" style={{ color: token.colorTextTertiary }}>
                {t(`palette.groups.${g}`)}
              </div>
              {group.map((item) => {
                index += 1;
                const i = index;
                const isActive = i === active;
                return (
                  <div
                    key={item.key}
                    role="option"
                    aria-selected={isActive}
                    data-index={i}
                    className={isActive ? 'cmdk-item cmdk-item--active' : 'cmdk-item'}
                    style={isActive ? { background: token.colorPrimaryBg, color: token.colorPrimaryText } : undefined}
                    onMouseMove={() => active !== i && setActive(i)}
                    onClick={() => run(item)}
                  >
                    <span className="cmdk-item-icon" style={{ color: isActive ? token.colorPrimary : token.colorTextSecondary }}>
                      {item.icon}
                    </span>
                    <span className="cmdk-item-body">
                      <span className="cmdk-item-title">{item.title}</span>
                      {item.subtitle && (
                        <Text type="secondary" className="cmdk-item-sub" ellipsis>
                          {item.subtitle}
                        </Text>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="cmdk-footer" style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, color: token.colorTextTertiary }}>
        <span>
          <kbd className="app-kbd">{'↑'}</kbd>
          <kbd className="app-kbd">{'↓'}</kbd> {t('palette.hintMove')}
        </span>
        <span>
          <kbd className="app-kbd">Enter</kbd> {t('palette.hintOpen')}
        </span>
        <span>
          <kbd className="app-kbd">Esc</kbd> {t('palette.hintClose')}
        </span>
      </div>
    </Modal>
  );
}
