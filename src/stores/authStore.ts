// 认证状态管理
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

// 用户响应类型
interface UserResponse {
  id: number;
  username: string;
  display_name: string;
  role: string;
  role_label: string;
  created_at: string;
}

// 登录响应类型
interface LoginResponse {
  user: UserResponse;
  session_token: string;
}

// 认证状态
interface AuthState {
  user: UserResponse | null;
  sessionToken: string | null;
  isLoading: boolean;
  error: string | null;
  
  // 操作
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkSession: () => Promise<boolean>;
  clearError: () => void;
  setUser: (user: UserResponse) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionToken: null,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await invoke<LoginResponse>('login', { username, password });
          set({
            user: response.user,
            sessionToken: response.session_token,
            isLoading: false,
          });
          return true;
        } catch (e) {
          set({ error: e as string, isLoading: false });
          return false;
        }
      },

      logout: async () => {
        const { sessionToken } = get();
        if (sessionToken) {
          try {
            await invoke('logout', { sessionToken });
          } catch (e) {
            console.error('退出登录失败:', e);
          }
        }
        // 清除状态并强制跳转到登录页
        set({ user: null, sessionToken: null, error: null });
        // 使用 window.location 确保页面刷新并跳转
        window.location.href = '/login';
      },

      checkSession: async () => {
        const { sessionToken } = get();
        if (!sessionToken) return false;
        
        try {
          const user = await invoke<UserResponse>('get_current_user', { sessionToken });
          set({ user });
          return true;
        } catch (e) {
          set({ user: null, sessionToken: null });
          return false;
        }
      },

      clearError: () => set({ error: null }),
      
      setUser: (user: UserResponse) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ sessionToken: state.sessionToken }),
    }
  )
);
