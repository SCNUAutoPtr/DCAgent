import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { ThemeMode } from './stores/uiPrefs';

/** Brand and chart colours. Chart series follow a fixed categorical order (never cycled). */
export const BRAND = {
  primary: '#2a6df4',
  siderBg: '#0d1526',
  siderBgDark: '#0a0f1c',
};

/** Categorical series, light / dark steps of the same hues (validated order). */
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
} as const;

export function seriesColors(mode: ThemeMode): readonly string[] {
  return SERIES[mode];
}

const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

/** The whole app's antd theme. `compact` is the Deck (handheld) density. */
export function buildTheme(mode: ThemeMode, compact: boolean): ThemeConfig {
  const dark = mode === 'dark';
  const algorithm = [dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm];
  if (compact) algorithm.push(antdTheme.compactAlgorithm);
  const siderBg = dark ? BRAND.siderBgDark : BRAND.siderBg;
  return {
    algorithm,
    token: {
      colorPrimary: BRAND.primary,
      colorInfo: BRAND.primary,
      borderRadius: compact ? 6 : 10,
      borderRadiusLG: compact ? 8 : 14,
      fontFamily: FONT,
      colorBgLayout: dark ? '#070b14' : '#f3f5fa',
      colorBgContainer: dark ? '#111827' : '#ffffff',
      colorBgElevated: dark ? '#162033' : '#ffffff',
      colorBorderSecondary: dark ? '#1f2a3d' : '#eaedf3',
      boxShadowTertiary: dark
        ? '0 1px 2px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.25)'
        : '0 1px 2px rgba(16,24,40,0.04), 0 4px 16px rgba(16,24,40,0.06)',
      motionDurationMid: '0.18s',
    },
    components: {
      Layout: {
        siderBg,
        triggerBg: siderBg,
        headerBg: 'transparent',
        headerHeight: compact ? 40 : 60,
        headerPadding: compact ? '0 8px' : '0 24px',
        bodyBg: dark ? '#070b14' : '#f3f5fa',
      },
      Menu: {
        darkItemBg: siderBg,
        darkSubMenuItemBg: dark ? '#070b14' : '#0a1120',
        darkItemSelectedBg: BRAND.primary,
        itemBorderRadius: 8,
        itemMarginInline: 8,
      },
      Card: { headerFontSize: 15 },
      Table: { headerBg: dark ? '#162033' : '#f7f8fb' },
      Modal: { contentBg: dark ? '#111827' : '#ffffff', headerBg: dark ? '#111827' : '#ffffff' },
    },
  };
}
