import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      employee:     null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authAPI.login({ email, password });
          const { employee, accessToken, refreshToken } = data.data;
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          set({ employee, accessToken, refreshToken, isLoading: false });
          return { success: true };
        } catch (err) {
          const msg = err.response?.data?.message || 'Login failed';
          set({ error: msg, isLoading: false });
          return { success: false, message: msg };
        }
      },

      logout: async () => {
        try {
          await authAPI.logout(get().refreshToken);
        } catch (_) {}
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ employee: null, accessToken: null, refreshToken: null });
      },

      clearError: () => set({ error: null }),

      isAuthenticated: () => !!get().accessToken && !!get().employee,
      isAdmin:         () => get().employee?.role === 'admin',
      isManagement:    () => ['admin', 'management', 'manager'].includes(get().employee?.role),
      isSalesCoordinator: () => ['admin', 'management', 'manager', 'sales_coordinator'].includes(get().employee?.role),
      isCaseManager:   () => ['admin', 'management', 'manager', 'case_manager'].includes(get().employee?.role),
      isAgent:         () => ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'].includes(get().employee?.role),
    }),
    {
      name: 'healthqubes-auth',
      partialize: (s) => ({ employee: s.employee, accessToken: s.accessToken, refreshToken: s.refreshToken }),
    }
  )
);

export default useAuthStore;
