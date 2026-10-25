import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 页面缩放档位。Deck 是 5.5 寸 1080P，如果系统 density 设成 1.0，
// 浏览器会把视口报成 1920 CSS px，媒体查询根本不触发，字却小到看不清，
// 所以缩放必须是可手动调的，不能只靠断点。
export const DECK_SCALES = [1, 1.25, 1.5, 1.75, 2] as const;
export type DeckScale = (typeof DECK_SCALES)[number];

// 视口窄到这个宽度以下时自动进入 Deck 模式（density 正常的设备走这条）
const AUTO_ENABLE_WIDTH = 900;

interface DeckModeState {
  enabled: boolean;
  scale: DeckScale;
  /** 侧栏是否收起为图标条 */
  sidebarCollapsed: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
  setScale: (scale: DeckScale) => void;
  toggleSidebar: () => void;
  /** 首次加载时按视口宽度猜一次，用户手动切换过就不再干预 */
  autoDetect: () => void;
}

export const useDeckMode = create<DeckModeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      scale: 1,
      sidebarCollapsed: true,

      toggle: () => set({ enabled: !get().enabled }),
      setEnabled: (enabled) => set({ enabled }),
      setScale: (scale) => set({ scale }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

      autoDetect: () => {
        if (typeof window === 'undefined') return;
        if (window.innerWidth < AUTO_ENABLE_WIDTH) {
          set({ enabled: true });
        }
      },
    }),
    {
      name: 'dcagent-deck-mode',
      // 只持久化用户的选择，行为函数不进 localStorage
      partialize: (state) => ({
        enabled: state.enabled,
        scale: state.scale,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
