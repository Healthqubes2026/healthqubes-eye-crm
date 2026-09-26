import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { cx } from '../../utils/helpers';
import useAuthStore from '../../hooks/useAuthStore';
import useTabAccessStore from '../../hooks/useTabAccessStore';
import { getTabsByGroup } from '../../utils/tabsConfig';
import { Avatar, LiveDot } from '../common';
import toast from 'react-hot-toast';
import { LogOut, Settings } from 'lucide-react';

const NavItem = ({ to, label, icon: Icon, badge, exact }) => (
  <NavLink
    to={to}
    end={exact}
    className={({ isActive }) =>
      cx('flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all group',
        isActive
          ? 'bg-brand-50 text-brand-600 font-medium'
          : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50')
    }
  >
    <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    <span className="flex-1">{label}</span>
    {badge === 'live' && <LiveDot />}
  </NavLink>
);

export default function AppLayout() {
  const { employee, logout, isAdmin } = useAuthStore();
  const { tabAccess } = useTabAccessStore();
  const navigate = useNavigate();
  const tabsByGroup = getTabsByGroup();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  // Build navigation dynamically based on tab access
  const buildNav = () => {
    const nav = [];
    Object.entries(tabsByGroup).forEach(([group, tabs]) => {
      const items = tabs
        .filter(tab => {
          const config = tabAccess[employee?.role];
          return config && config[tab.id] !== false;
        })
        .map(tab => ({
          to: tab.route,
          label: tab.label,
          icon: tab.icon,
          badge: tab.badge,
          exact: tab.route === '/',
        }));

      if (items.length > 0) {
        nav.push({ group, items });
      }
    });

    // Add Tab Access Control for admins
    if (isAdmin()) {
      nav.push({
        group: 'admin',
        items: [
          { to: '/tab-access-control', label: 'Tab Access Control', icon: Settings, exact: false },
        ],
      });
    }

    return nav;
  };

  const nav = buildNav();

  return (
    <div className="min-h-screen flex bg-surface-50">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 flex flex-col bg-white border-r border-surface-100 w-64">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-100">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900 leading-none">Healthqube Eyes</p>
            <p className="text-[10px] text-surface-500 mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {nav.map(({ group, items }) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-widest px-3 mb-2">
                {group === 'admin' ? 'Settings' : group}
              </p>
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="p-3 border-t border-surface-100">
          <div className="flex items-center gap-2.5 px-2 py-2">
            <Avatar name={employee?.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-surface-900 truncate">{employee?.name}</p>
              <p className="text-[10px] text-surface-500 capitalize">{employee?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} title="Logout" aria-label="Log out"
              className="text-surface-400 hover:text-red-500 transition-colors">
              <LogOut size={17} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden ml-64">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-surface-100 flex items-center px-6 gap-4 flex-shrink-0">
          <div className="flex-1" />
          <span className="text-xs text-surface-500">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <div className="w-px h-5 bg-surface-200" />
          <span className="text-xs font-medium text-surface-700 capitalize">
            {employee?.role?.replace('_', ' ')} · {employee?.zone || 'All Zones'}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-screen-xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
