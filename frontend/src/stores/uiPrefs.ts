import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'dcagent-theme';
const SIDER_KEY = 'dcagent-sider-collapsed';

// Storage can be missing or throw (private window, blocked site data): every access is guarded
// and the app falls back to defaults.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // not remembered, still applied for this session
  }
}

function initialTheme(): ThemeMode {
  const saved = read(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

interface UiPrefsState {
  theme: ThemeMode;
  siderCollapsed: boolean;
  paletteOpen: boolean;
  toggleTheme: () => void;
  toggleSider: () => void;
  setPaletteOpen: (open: boolean) => void;
}

export const useUiPrefs = create<UiPrefsState>()((set, get) => ({
  theme: initialTheme(),
  siderCollapsed: read(SIDER_KEY) === '1',
  paletteOpen: false,
  toggleTheme: () => {
    const theme: ThemeMode = get().theme === 'dark' ? 'light' : 'dark';
    write(THEME_KEY, theme);
    set({ theme });
  },
  toggleSider: () => {
    const siderCollapsed = !get().siderCollapsed;
    write(SIDER_KEY, siderCollapsed ? '1' : '0');
    set({ siderCollapsed });
  },
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
