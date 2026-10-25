import { Suspense, useEffect, useMemo } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Layout, Spin, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useDeckMode } from './stores/deckMode';
import { useUiPrefs } from './stores/uiPrefs';
import { getAntdLocale } from './locales/languages';
import { buildTheme } from './theme';
import AppHeader from './components/Layout/AppHeader';
import AppSidebar from './components/Layout/AppSidebar';
import CommandPalette from './components/CommandPalette/CommandPalette';
import { ROUTES, paths } from './routes';

const { Content } = Layout;

/** Pages that lay out their own cards on the layout background instead of one surface. */
const BARE_PAGES = new Set([paths.dashboard()]);

function Shell() {
  const { token } = theme.useToken();
  const { pathname } = useLocation();
  const deckEnabled = useDeckMode((state) => state.enabled);
  const deckScale = useDeckMode((state) => state.scale);
  const bare = BARE_PAGES.has(pathname);

  return (
    <Layout
      className="app-shell"
      style={{
        minHeight: '100vh',
        // the Deck reports a 1080p viewport as 1920 CSS px: scale the whole page
        zoom: deckEnabled && deckScale !== 1 ? deckScale : undefined,
      }}
    >
      <AppSidebar />
      <Layout className="app-main">
        <AppHeader />
        <Content className="deck-content-wrapper app-content" style={{ padding: deckEnabled ? 8 : '16px 24px 24px' }}>
          <div
            className={bare ? 'app-page app-page--bare' : 'app-page'}
            style={
              bare
                ? undefined
                : {
                    padding: deckEnabled ? 8 : 24,
                    minHeight: 280,
                    background: token.colorBgContainer,
                    borderRadius: deckEnabled ? 4 : token.borderRadiusLG,
                    boxShadow: token.boxShadowTertiary,
                  }
            }
          >
            <Suspense fallback={<Spin style={{ display: 'block', margin: '80px auto' }} />}>
              <Routes>
                {ROUTES.map((r) => (
                  <Route key={r.path} path={r.path} element={r.element} />
                ))}
              </Routes>
            </Suspense>
          </div>
        </Content>
      </Layout>
      <CommandPalette />
    </Layout>
  );
}

export default function App() {
  const { i18n } = useTranslation();
  const deckEnabled = useDeckMode((state) => state.enabled);
  const autoDetect = useDeckMode((state) => state.autoDetect);
  const mode = useUiPrefs((s) => s.theme);
  const themeConfig = useMemo(() => buildTheme(mode, deckEnabled), [mode, deckEnabled]);

  // guess once from the viewport width; a manual switch is remembered in localStorage
  useEffect(() => {
    autoDetect();
  }, [autoDetect]);

  // the class sits on body so modals (mounted under body) get the deck styles too
  useEffect(() => {
    document.body.classList.toggle('deck-mode', deckEnabled);
  }, [deckEnabled]);

  // static message/notification/modal calls (rpc error toasts) render outside the tree: give them the theme too
  useEffect(() => {
    ConfigProvider.config({
      holderRender: (children) => (
        <ConfigProvider locale={getAntdLocale(i18n.language)} theme={themeConfig}>
          {children}
        </ConfigProvider>
      ),
    });
  }, [themeConfig, i18n.language]);

  // plain CSS (index.css, scrollbars, native controls) follows the antd theme
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  return (
    <ConfigProvider locale={getAntdLocale(i18n.language)} componentSize={deckEnabled ? 'small' : 'middle'} theme={themeConfig}>
      <AntApp>
        <Shell />
      </AntApp>
    </ConfigProvider>
  );
}
