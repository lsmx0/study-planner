// 主题状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeType = 'dark' | 'light' | 'eye-care';

interface ThemeConfig {
  name: string;
  icon: string;
  bg: string;
  bgSecondary: string;
  text: string;
  textSecondary: string;
  border: string;
  accent: string;
}

export const THEMES: Record<ThemeType, ThemeConfig> = {
  dark: {
    name: '深夜模式',
    icon: '🌙',
    bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    bgSecondary: 'bg-slate-800/50',
    text: 'text-white',
    textSecondary: 'text-slate-400',
    border: 'border-white/5',
    accent: 'from-violet-500 to-purple-500',
  },
  light: {
    name: '白天模式',
    icon: '☀️',
    bg: 'bg-gradient-to-br from-slate-50 via-white to-blue-50',
    bgSecondary: 'bg-white shadow-sm',
    text: 'text-slate-800',
    textSecondary: 'text-slate-500',
    border: 'border-slate-200',
    accent: 'from-indigo-500 to-purple-500',
  },
  'eye-care': {
    name: '护眼模式',
    icon: '🌿',
    bg: 'bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950',
    bgSecondary: 'bg-emerald-900/30',
    text: 'text-emerald-100',
    textSecondary: 'text-emerald-300/70',
    border: 'border-emerald-800/30',
    accent: 'from-emerald-500 to-teal-500',
  },
};

interface ThemeState {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  getConfig: () => ThemeConfig;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      getConfig: () => THEMES[get().theme],
    }),
    { name: 'theme-storage' }
  )
);
