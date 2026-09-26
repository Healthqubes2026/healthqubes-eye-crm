import React, { useEffect, useMemo, useState } from 'react';
import { ROLES, TABS, getTabsByGroup } from '../utils/tabsConfig';
import useTabAccessStore from '../hooks/useTabAccessStore';
import useAuthStore from '../hooks/useAuthStore';
import toast from 'react-hot-toast';

const RoleCard = ({ role, selected, tabCount, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full rounded-3xl border px-4 py-4 text-left transition-all group ${
      selected
        ? 'border-brand-400 bg-brand-50 shadow-sm'
        : 'border-surface-200 bg-white hover:border-surface-300 hover:bg-surface-50'
    }`}
  >
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-surface-900 capitalize">{role.replace(/_/g, ' ')}</p>
        <p className="text-xs text-surface-500 mt-1">Configurable role permissions</p>
      </div>
      <div className="rounded-full bg-surface-100 px-3 py-1 text-[11px] font-semibold text-surface-600">
        {tabCount}/{TABS.length}
      </div>
    </div>
    <div className="mt-3 text-xs text-surface-500">Tap to configure visible tabs for this role.</div>
  </button>
);

const TabRow = ({ tab, enabled, onToggle }) => {
  const Icon = tab.icon;

  return (
    <div className="group flex flex-col gap-3 rounded-3xl border border-surface-200 bg-white p-4 shadow-sm transition hover:border-brand-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 shrink-0 rounded-2xl bg-brand-50 text-brand-600 grid place-items-center">
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">{tab.label}</p>
            <p className="text-xs text-surface-500 mt-1">{tab.description}</p>
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <span className={`text-xs font-semibold ${enabled ? 'text-emerald-700' : 'text-surface-500'}`}>
            {enabled ? 'Enabled' : 'Disabled'}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={onToggle}
            className="h-5 w-5 accent-brand-500"
          />
        </label>
      </div>
    </div>
  );
};

const getDefaultAccessForRole = (role) => {
  return TABS.reduce((acc, tab) => {
    acc[tab.id] = tab.defaultRoles.includes(role);
    return acc;
  }, {});
};

export default function TabAccessControlPage() {
  const { isAdmin } = useAuthStore();
  const { tabAccess, setRoleTabAccess, resetToDefaults } = useTabAccessStore();
  const [selectedRole, setSelectedRole] = useState('admin');
  const [draftAccess, setDraftAccess] = useState(getDefaultAccessForRole('admin'));
  const tabsByGroup = getTabsByGroup();

  useEffect(() => {
    const savedAccess = tabAccess[selectedRole] || getDefaultAccessForRole(selectedRole);
    setDraftAccess(savedAccess);
  }, [selectedRole, tabAccess]);

  if (!isAdmin()) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 text-sm">Only admins can manage tab access.</p>
      </div>
    );
  }

  const currentRoleAccess = tabAccess[selectedRole] || getDefaultAccessForRole(selectedRole);

  const changedCount = useMemo(
    () => TABS.filter(tab => Boolean(draftAccess[tab.id]) !== Boolean(currentRoleAccess[tab.id])).length,
    [draftAccess, currentRoleAccess]
  );

  const enabledCount = useMemo(
    () => TABS.filter(tab => Boolean(draftAccess[tab.id])).length,
    [draftAccess]
  );

  const handleToggle = (tabId) => {
    setDraftAccess((prev) => ({ ...prev, [tabId]: !prev[tabId] }));
  };

  const handleSave = () => {
    setRoleTabAccess(selectedRole, draftAccess);
    toast.success('Permissions saved successfully');
  };

  const handleResetRole = () => {
    if (!window.confirm(`Reset permissions for ${selectedRole.replace(/_/g, ' ')} to defaults?`)) return;
    const defaultAccess = getDefaultAccessForRole(selectedRole);
    setDraftAccess(defaultAccess);
    setRoleTabAccess(selectedRole, defaultAccess);
    toast.success('Role permissions reset to defaults');
  };

  const handleResetAll = () => {
    if (!window.confirm('Reset all tab access settings to defaults?')) return;
    resetToDefaults();
    toast.success('All permissions reset to defaults');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-surface-500">Role permissions</p>
            <h1 className="mt-3 text-3xl font-semibold text-surface-900">Tab Access Control</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-surface-500">
              Configure which admin tabs each role can see. Changes are saved under the current role and apply immediately after saving.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleResetAll}
              className="rounded-full border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 transition hover:bg-surface-100"
            >
              Reset all defaults
            </button>
            <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {selectedRole.replace(/_/g, ' ')} has {enabledCount}/{TABS.length} tabs enabled
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-6">
          <div className="rounded-3xl border border-surface-200 bg-surface-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Choose role</p>
            <div className="mt-4 space-y-3">
              {ROLES.map((role) => {
                const savedCount = Object.values(tabAccess[role] || getDefaultAccessForRole(role)).filter(Boolean).length;
                return (
                  <RoleCard
                    key={role}
                    role={role}
                    selected={selectedRole === role}
                    tabCount={savedCount}
                    onClick={() => setSelectedRole(role)}
                  />
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Current role summary</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4 text-sm text-surface-600">
                <span>Selected role</span>
                <span className="font-semibold text-surface-900 capitalize">{selectedRole.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm text-surface-600">
                <span>Enabled tabs</span>
                <span className="font-semibold text-surface-900">{enabledCount}</span>
              </div>
              <div className="flex items-center justify-between gap-4 text-sm text-surface-600">
                <span>Status</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${changedCount ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {changedCount ? 'Unsaved changes' : 'Saved'}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-3xl border border-surface-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-surface-500">Manage tabs</p>
                <h2 className="mt-2 text-xl font-semibold text-surface-900 capitalize">{selectedRole.replace(/_/g, ' ')} permissions</h2>
                <p className="mt-2 text-sm text-surface-500">Use the toggles below to control which tabs this role can see in the sidebar.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleResetRole}
                  className="rounded-full border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 transition hover:bg-surface-100"
                >
                  Reset role defaults
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!changedCount}
                  className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Save changes
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            {Object.entries(tabsByGroup).map(([group, tabs]) => (
              <div key={group} className="rounded-3xl border border-surface-200 bg-surface-50 p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">{group}</p>
                    <p className="text-sm text-surface-500">{tabs.length} tabs in this category</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-surface-500 border border-surface-200">
                    {tabs.length} items
                  </div>
                </div>
                <div className="mt-5 grid gap-4">
                  {tabs.map((tab) => (
                    <TabRow
                      key={tab.id}
                      tab={tab}
                      enabled={Boolean(draftAccess[tab.id])}
                      onToggle={() => handleToggle(tab.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
