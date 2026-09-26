import React from 'react';
import { cx, initials, avatarColor } from '../../utils/helpers';

// ── Avatar ────────────────────────────────────────────────────────────────────
export const Avatar = ({ name = '', size = 'md', photo, className }) => {
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  if (photo) return (
    <img src={photo} alt={name}
      className={cx('rounded-full object-cover flex-shrink-0', sizes[size], className)} />
  );
  return (
    <div className={cx('rounded-full flex items-center justify-center font-medium flex-shrink-0',
      sizes[size], avatarColor(name), className)}>
      {initials(name)}
    </div>
  );
};

// ── Badge ─────────────────────────────────────────────────────────────────────
export const Badge = ({ children, variant = 'gray', className }) => (
  <span className={cx('badge', `badge-${variant}`, className)}>{children}</span>
);

// ── Spinner ───────────────────────────────────────────────────────────────────
export const Spinner = ({ size = 'md', className }) => {
  const s = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  return (
    <svg className={cx('animate-spin text-brand-500', s[size], className)}
      viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z"/>
    </svg>
  );
};

// ── Page loader ───────────────────────────────────────────────────────────────
export const PageLoader = () => (
  <div className="flex items-center justify-center h-48">
    <Spinner size="lg" />
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
export const EmptyState = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    {icon && <div className="text-4xl mb-3 opacity-40">{icon}</div>}
    <p className="text-sm font-medium text-surface-800 mb-1">{title}</p>
    {description && <p className="text-xs text-surface-600 mb-4 max-w-xs">{description}</p>}
    {action}
  </div>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
export const StatCard = ({ label, value, sub, subVariant = 'up', icon, iconBg = 'bg-brand-50' }) => (
  <div className="stat-card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs text-surface-600 font-medium mb-1.5">{label}</p>
        <p className="text-2xl font-semibold text-surface-900 leading-none">{value ?? '—'}</p>
        {sub && (
          <p className={cx('text-xs mt-1.5', subVariant === 'up' ? 'text-emerald-600' : subVariant === 'down' ? 'text-red-500' : 'text-surface-500')}>
            {sub}
          </p>
        )}
      </div>
      {icon && (
        <div className={cx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', iconBg)}>
          {icon}
        </div>
      )}
    </div>
  </div>
);

// ── Modal ─────────────────────────────────────────────────────────────────────
export const Modal = ({ open, onClose, title, children, width = 'max-w-lg' }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className={cx('relative bg-white rounded-2xl shadow-modal w-full max-w-[900px] max-h-[90vh] overflow-hidden animate-slide-up flex flex-col', width)}>
        <div className="modal-header flex items-center justify-between px-6 py-4 flex-shrink-0 border-b border-surface-100">
          <h3 className="font-semibold text-surface-900">{title}</h3>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-100 text-surface-600 transition-colors">
            ✕
          </button>
        </div>
        <div className="modal-body flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// ── Pagination ────────────────────────────────────────────────────────────────
export const Pagination = ({ page, total, limit, onChange }) => {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-surface-100">
      <p className="text-xs text-surface-600">
        {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex gap-1">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-3 py-1.5 text-xs rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40 transition-colors">
          ← Prev
        </button>
        {Array.from({ length: Math.min(5, pages) }, (_, i) => {
          const p = page <= 3 ? i + 1 : page - 2 + i;
          if (p < 1 || p > pages) return null;
          return (
            <button key={p} onClick={() => onChange(p)}
              className={cx('px-3 py-1.5 text-xs rounded-lg border transition-colors',
                p === page ? 'bg-brand-500 text-white border-brand-500' : 'border-surface-200 hover:bg-surface-50')}>
              {p}
            </button>
          );
        })}
        <button onClick={() => onChange(page + 1)} disabled={page === pages}
          className="px-3 py-1.5 text-xs rounded-lg border border-surface-200 hover:bg-surface-50 disabled:opacity-40 transition-colors">
          Next →
        </button>
      </div>
    </div>
  );
};

// ── Section header ────────────────────────────────────────────────────────────
export const SectionHeader = ({ title, action, meta }) => (
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-sm font-semibold text-surface-900">{title}</h2>
      {meta && <p className="text-xs text-surface-500 mt-0.5">{meta}</p>}
    </div>
    {action}
  </div>
);

// ── Live dot ──────────────────────────────────────────────────────────────────
export const LiveDot = ({ className }) => (
  <span className={cx('relative flex h-2 w-2', className)}>
    <span className="animate-pulse-dot absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
  </span>
);

// ── Tabs ──────────────────────────────────────────────────────────────────────
export const Tabs = ({ activeTab, onTabChange, children }) => (
  <div>
    <div className="flex border-b border-surface-200 mb-4">
      {React.Children.map(children, (child) => (
        <button
          key={child.props.id}
          onClick={() => onTabChange(child.props.id)}
          className={cx(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === child.props.id
              ? 'border-brand-500 text-brand-600'
              : 'border-transparent text-surface-500 hover:text-surface-700'
          )}
        >
          {child.props.title}
        </button>
      ))}
    </div>
    <div>
      {React.Children.map(children, (child) =>
        activeTab === child.props.id ? child : null
      )}
    </div>
  </div>
);

Tabs.Tab = ({ children }) => children;
