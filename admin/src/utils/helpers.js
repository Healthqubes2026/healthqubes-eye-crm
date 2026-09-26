import { format, formatDistanceToNow, isToday, parseISO } from 'date-fns';
import clsx from 'clsx';

// ── Date / Time ───────────────────────────────────────────────────────────────
export const fmtDate    = (d) => d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM yyyy') : '—';
export const fmtTime    = (d) => d ? format(typeof d === 'string' ? parseISO(d) : d, 'hh:mm a') : '—';
export const fmtDateTime = (d) => d ? format(typeof d === 'string' ? parseISO(d) : d, 'dd MMM, hh:mm a') : '—';
export const fmtRelative = (d) => d ? formatDistanceToNow(typeof d === 'string' ? parseISO(d) : d, { addSuffix: true }) : '—';
export const isDateToday = (d) => d ? isToday(typeof d === 'string' ? parseISO(d) : d) : false;
export const isoDate     = (d = new Date()) => format(d, 'yyyy-MM-dd');

// ── Currency ─────────────────────────────────────────────────────────────────
export const fmtINR = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000)   return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
};
export const fmtCurrency = fmtINR;

// ── Status helpers ────────────────────────────────────────────────────────────
export const attendanceBadge = (status) => {
  const map = {
    present:  'badge-green',
    late:     'badge-amber',
    absent:   'badge-red',
    half_day: 'badge-amber',
    on_leave: 'badge-blue',
  };
  return map[status] || 'badge-gray';
};

export const leadStatusBadge = (status) => {
  const map = {
    new_lead:            'badge-blue',
    attempted:           'badge-cyan',
    connected:           'badge-teal',
    requirement_captured:'badge-indigo',
    docs_requested:      'badge-violet',
    docs_received:       'badge-purple',
    hospital_shortlisted:'badge-amber',
    quotation_requested: 'badge-orange',
    quotation_received:  'badge-yellow',
    treatment_plan_shared:'badge-green',
    negotiation:         'badge-amber',
    decision_pending:    'badge-pink',
    converted:           'badge-green',
    lost:                'badge-red',
    closed:              'badge-gray',
  };
  return map[status] || 'badge-gray';
};

export const leadSourceLabel = (source) => {
  const map = {
    field: 'Field Visit',
    referral: 'Referral',
    online: 'Online',
    camp: 'Medical Camp',
    other: 'Other',
    google_leads: 'Google Leads',
    facebook: 'Facebook',
    instagram: 'Instagram',
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    whatsapp: 'WhatsApp',
  };
  return map[source] || source || 'Unknown';
};

export const outcomeLabel = (o) => {
  const map = { positive: '✓ Positive', neutral: '~ Neutral', negative: '✗ Negative', no_meet: 'No Meet' };
  return map[o] || o;
};

export const outcomeBadge = (o) => {
  const map = { positive: 'badge-green', neutral: 'badge-blue', negative: 'badge-red', no_meet: 'badge-gray' };
  return map[o] || 'badge-gray';
};

export const formatEmployeeId = (id) => {
  const numericId = Number(id) || 0;
  return `EMP${String(numericId).padStart(5, '0')}`;
};

// ── Avatar initials ───────────────────────────────────────────────────────────
export const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

const avatarColors = [
  'bg-brand-100 text-brand-700',
  'bg-teal-50 text-teal-600',
  'bg-amber-50 text-amber-700',
  'bg-purple-50 text-purple-700',
  'bg-rose-50 text-rose-700',
];
export const avatarColor = (name = '') =>
  avatarColors[name.charCodeAt(0) % avatarColors.length];

// ── Class merge ───────────────────────────────────────────────────────────────
export { clsx as cx };

// ── Paginator helper ─────────────────────────────────────────────────────────
export const totalPages = (total, limit) => Math.ceil(total / limit);

// ── Error extractor ───────────────────────────────────────────────────────────
export const apiError = (err) =>
  err?.response?.data?.message || err?.message || 'Something went wrong';
