import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TABS, ROLES } from '../utils/tabsConfig';

const createDefaultConfig = () => {
  const config = {};
  ROLES.forEach(role => {
    config[role] = {};
    TABS.forEach(tab => {
      config[role][tab.id] = tab.defaultRoles.includes(role);
    });
  });
  return config;
};

const useTabAccessStore = create(
  persist(
    (set, get) => ({
      // tabAccess structure: { role: { tabId: boolean, ... }, ... }
      tabAccess: createDefaultConfig(),

      // Get allowed tabs for a specific role
      getTabsForRole: (role) => {
        const config = get().tabAccess[role] || {};
        return TABS.filter(tab => config[tab.id] !== false);
      },

      // Check if role has access to a specific tab
      hasAccessToTab: (role, tabId) => {
        const config = get().tabAccess[role];
        if (!config) return false;
        return config[tabId] !== false;
      },

      // Toggle access to a tab for a role
      toggleTabAccess: (role, tabId) => {
        set(state => ({
          tabAccess: {
            ...state.tabAccess,
            [role]: {
              ...state.tabAccess[role],
              [tabId]: !state.tabAccess[role][tabId],
            },
          },
        }));
      },

      // Set access to a tab for a role
      setTabAccess: (role, tabId, hasAccess) => {
        set(state => ({
          tabAccess: {
            ...state.tabAccess,
            [role]: {
              ...state.tabAccess[role],
              [tabId]: hasAccess,
            },
          },
        }));
      },

      // Reset to defaults
      resetToDefaults: () => {
        set({ tabAccess: createDefaultConfig() });
      },

      // Bulk update for a role
      setRoleTabAccess: (role, tabAccessMap) => {
        set(state => ({
          tabAccess: {
            ...state.tabAccess,
            [role]: tabAccessMap,
          },
        }));
      },
    }),
    {
      name: 'healthqubes-tab-access',
    }
  )
);

export default useTabAccessStore;
