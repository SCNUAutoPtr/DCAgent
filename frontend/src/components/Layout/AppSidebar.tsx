import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import { DatabaseOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDeckMode } from '../../stores/deckMode';
import { useUiPrefs } from '../../stores/uiPrefs';
import { MENU_GROUPS, ROUTES, activeMenuPath, menuGroupOf, paths } from '../../routes';

const { Sider } = Layout;

export default function AppSidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const deckEnabled = useDeckMode((state) => state.enabled);
  const deckCollapsed = useDeckMode((state) => state.sidebarCollapsed);
  const toggleDeckSidebar = useDeckMode((state) => state.toggleSidebar);
  const desktopCollapsed = useUiPrefs((s) => s.siderCollapsed);
  const toggleDesktop = useUiPrefs((s) => s.toggleSider);
  const { t } = useTranslation('menu');
  const { t: tc } = useTranslation('common');

  const items = useMemo<MenuProps['items']>(() => {
    // the title shows the full text when a long label (en/ja) is cut off by the sider width
    const entry = (r: (typeof ROUTES)[number]) => ({ key: r.path, icon: r.icon, label: <span title={t(r.labelKey!)}>{t(r.labelKey!)}</span> });
    const top = ROUTES.filter((r) => r.labelKey && !r.menuGroup).map(entry);
    const groups = MENU_GROUPS.map((g) => ({
      key: g.key,
      icon: g.icon,
      label: <span title={t(g.labelKey)}>{t(g.labelKey)}</span>,
      children: ROUTES.filter((r) => r.labelKey && r.menuGroup === g.key).map(entry),
    })).filter((g) => g.children.length);
    return [...top, ...groups];
  }, [t]);

  const selected = activeMenuPath(pathname);
  const group = menuGroupOf(selected);
  // the Deck keeps its own (header-driven) state; desktop collapses from the sider footer
  const collapsed = deckEnabled ? deckCollapsed : desktopCollapsed;
  const toggle = deckEnabled ? toggleDeckSidebar : toggleDesktop;

  return (
    <Sider
      className="app-sider"
      width={deckEnabled ? 200 : 232}
      collapsible
      collapsed={collapsed}
      onCollapse={toggle}
      collapsedWidth={deckEnabled ? 48 : 64}
      trigger={deckEnabled ? null : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
    >
      <div
        className="app-logo"
        role="link"
        tabIndex={0}
        onClick={() => navigate(paths.dashboard())}
        onKeyDown={(e) => e.key === 'Enter' && navigate(paths.dashboard())}
        style={{ height: deckEnabled ? 40 : 60, justifyContent: collapsed ? 'center' : 'flex-start' }}
      >
        <span className="app-logo-mark">
          <DatabaseOutlined />
        </span>
        {!collapsed && (
          <span className="app-logo-text">
            <strong>DCAgent</strong>
            {!deckEnabled && <small>{tc('tagline')}</small>}
          </span>
        )}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={selected ? [selected] : []}
        defaultOpenKeys={group ? [group] : []}
        key={group ?? 'none'}
        style={{ borderRight: 0, paddingBottom: 56 }}
        items={items}
        onClick={({ key }) => navigate(key)}
      />
    </Sider>
  );
}
