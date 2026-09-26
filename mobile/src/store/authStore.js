import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, employeesAPI } from '../api';

const useAuthStore = create((set, get) => ({
  employee: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  isBootstrapping: true,   // true until we've checked AsyncStorage

  // ── Bootstrap: restore session from storage on app launch ─────────────────
  bootstrap: async () => {
    try {
      const [token, empStr] = await AsyncStorage.multiGet(['accessToken', 'employee']);
      const accessToken = token[1];
      const employee    = empStr[1] ? JSON.parse(empStr[1]) : null;
      if (accessToken && employee) {
        set({ accessToken, employee });
      }
    } catch (_) {}
    set({ isBootstrapping: false });
  },

  // ── Email + Password login ─────────────────────────────────────────────────
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await authAPI.login({ email, password });
      const { employee, accessToken, refreshToken } = data.data;
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['employee', JSON.stringify(employee)],
      ]);
      set({ employee, accessToken, refreshToken, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, message: err.response?.data?.message || 'Login failed' };
    }
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await authAPI.logout(get().refreshToken);
    } catch (_) {}
    await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'employee']);
    set({ employee: null, accessToken: null, refreshToken: null });
  },

  // ── Refresh employee profile ──────────────────────────────────────────────
  refreshProfile: async () => {
    try {
      const { data } = await employeesAPI.me();
      const employee = data.data;
      await AsyncStorage.setItem('employee', JSON.stringify(employee));
      set({ employee });
    } catch (_) {}
  },

  isAuthenticated: () => !!get().accessToken && !!get().employee,
}));

export default useAuthStore;
