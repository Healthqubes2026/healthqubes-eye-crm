import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { dashboardAPI, salesAPI, meetingsAPI } from '../api';
import { StatCard, PageLoader, LiveDot, Badge } from '../components/common';
import { fmtINR, fmtTime, leadSourceLabel, Avatar } from '../utils/helpers';
import { Avatar as AvatarComp } from '../components/common';
import { TrendingUp, TrendingDown, Users, DollarSign, Calendar, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-surface-100 rounded-xl shadow-card p-3 text-xs">
      <p className="text-surface-600 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-medium" style={{ color: p.color }}>
          {p.name}: {p.name === 'Revenue' ? fmtINR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const COLORS = ['#2E6BE6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function DashboardPage() {
  const { data: dash, isLoading } = useQuery('dashboard', () => dashboardAPI.get().then(r => r.data.data), {
    refetchInterval: 60000,
  });
  const { data: salesData } = useQuery('sales-summary', () =>
    salesAPI.summary().then(r => r.data.data), { refetchInterval: 120000 }
  );
  const { data: followUps } = useQuery('followups', () =>
    meetingsAPI.followUps().then(r => r.data.data)
  );

  if (isLoading) return <PageLoader />;

  const d = dash || {};

  // Build a simple 7-day sales trend from summary data
  const salesTrend = salesData?.trend?.slice(-7) || [];

  // Calculate additional metrics
  const totalRevenue = (d.sales?.mtd_revenue || 0) + (d.patients?.total_revenue || 0);
  const taskCompletionRate = d.tasks?.total ? Math.round((d.tasks.completed / d.tasks.total) * 100) : 0;
  const quotationConversionRate = d.quotations?.total ? Math.round((d.quotations.accepted / d.quotations.total) * 100) : 0;

  // Patient status distribution for pie chart
  const patientStatusData = [
    { name: 'Active', value: d.patients?.active || 0, color: '#2E6BE6' },
    { name: 'Completed', value: d.patients?.completed || 0, color: '#10B981' },
    { name: 'Cancelled', value: d.patients?.cancelled || 0, color: '#EF4444' },
  ].filter(item => item.value > 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-surface-500 mt-0.5">Live overview · updates every minute</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
          <LiveDot /> Live
        </div>
      </div>

      {/* Alert Section - Show critical issues */}
      {d.leads?.followups_overdue > 0 || d.attendance?.late > 0 || d.tasks?.overdue > 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5" size={20} />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-800 mb-2">Attention Required</h3>
              <div className="space-y-1 text-sm text-amber-700">
                {d.leads?.followups_overdue > 0 && (
                  <p>• {d.leads.followups_overdue} lead follow-ups are overdue</p>
                )}
                {d.attendance?.late > 0 && (
                  <p>• {d.attendance.late} employees checked in late today</p>
                )}
                {d.tasks?.overdue > 0 && (
                  <p>• {d.tasks.overdue} tasks are past their due date</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Primary KPI cards - 6 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard
          label="Present Today"
          value={d.attendance?.present ?? '—'}
          sub={`${d.attendance?.rate ?? 0}% attendance rate`}
          subVariant="up"
          icon={<Users className="text-blue-600" size={20} />}
          iconBg="bg-blue-50"
        />
        <StatCard
          label="Doctor Visits Today"
          value={d.meetings?.today_visits ?? '—'}
          sub={d.meetings?.followups_due ? `${d.meetings.followups_due} follow-ups due` : 'All caught up'}
          subVariant={d.meetings?.followups_due > 0 ? 'down' : 'up'}
          icon={<Calendar className="text-purple-600" size={20} />}
          iconBg="bg-purple-50"
        />
        <StatCard
          label="New Leads (MTD)"
          value={d.leads?.new_leads ?? '—'}
          sub={`${d.leads?.conversion_rate ?? 0}% conversion rate`}
          subVariant="up"
          icon={<TrendingUp className="text-amber-600" size={20} />}
          iconBg="bg-amber-50"
        />
        <StatCard
          label="Total Revenue (MTD)"
          value={fmtINR(totalRevenue)}
          sub={`${d.sales?.mtd_orders ?? 0} sales + ${d.patients?.total ?? 0} patients`}
          subVariant="up"
          icon={<DollarSign className="text-emerald-600" size={20} />}
          iconBg="bg-emerald-50"
        />
        <StatCard
          label="Active Patients"
          value={d.patients?.active ?? '—'}
          sub={`${d.patients?.completed ?? 0} completed this month`}
          subVariant="up"
          icon={<CheckCircle className="text-teal-600" size={20} />}
          iconBg="bg-teal-50"
        />
        <StatCard
          label="Task Completion"
          value={`${taskCompletionRate}%`}
          sub={`${d.tasks?.completed ?? 0}/${d.tasks?.total ?? 0} tasks done`}
          subVariant={taskCompletionRate >= 80 ? 'up' : 'down'}
          icon={<Clock className="text-indigo-600" size={20} />}
          iconBg="bg-indigo-50"
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active in Field Now"
          value={d.field?.active_now ?? 0}
          sub="GPS pings last 15 min"
          icon={<span className="text-lg">📍</span>}
          iconBg="bg-teal-50"
        />
        <StatCard
          label="Follow-ups Overdue"
          value={d.leads?.followups_overdue ?? 0}
          sub="Leads needing attention"
          subVariant={d.leads?.followups_overdue > 0 ? 'down' : 'neutral'}
          icon={<AlertTriangle className="text-red-600" size={20} />}
          iconBg="bg-red-50"
        />
        <StatCard
          label="Late Check-ins"
          value={d.attendance?.late ?? 0}
          sub="After 9:30 AM today"
          subVariant={d.attendance?.late > 0 ? 'down' : 'neutral'}
          icon={<Clock className="text-orange-600" size={20} />}
          iconBg="bg-orange-50"
        />
        <StatCard
          label="Quotation Success"
          value={`${quotationConversionRate}%`}
          sub={`${d.quotations?.accepted ?? 0}/${d.quotations?.total ?? 0} accepted`}
          subVariant={quotationConversionRate >= 50 ? 'up' : 'down'}
          icon={<TrendingUp className="text-green-600" size={20} />}
          iconBg="bg-green-50"
        />
      </div>

      {/* Charts and Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sales Trend Chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-900">Revenue Trend</h3>
              <p className="text-xs text-surface-500">Last 7 days combined revenue</p>
            </div>
            <Link to="/sales" className="text-xs text-brand-500 hover:text-brand-700">View all →</Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesTrend} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2E6BE6" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#2E6BE6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => fmtINR(v)} width={60} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#2E6BE6" strokeWidth={2}
                fill="url(#revenueGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Patient Status Distribution */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-900">Patient Status</h3>
              <p className="text-xs text-surface-500">Current distribution</p>
            </div>
            <Link to="/patients" className="text-xs text-brand-500 hover:text-brand-700">View all →</Link>
          </div>
          {patientStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={patientStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {patientStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [value, 'Patients']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-32 text-surface-500">
              <p className="text-sm">No patient data</p>
            </div>
          )}
          <div className="mt-3 space-y-1">
            {patientStatusData.map((item, index) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-surface-600">{item.name}</span>
                </div>
                <span className="font-medium text-surface-900">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-900">Lead Summary</h3>
              <p className="text-xs text-surface-500">Month-to-date leads overview</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-surface-200 p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">Total Leads</p>
              <p className="text-2xl font-semibold text-surface-900">{d.leads?.total ?? 0}</p>
            </div>
            <div className="rounded-lg border border-surface-200 p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">New Leads</p>
              <p className="text-2xl font-semibold text-surface-900">{d.leads?.new_leads ?? 0}</p>
            </div>
            <div className="rounded-lg border border-surface-200 p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">Converted</p>
              <p className="text-2xl font-semibold text-surface-900">{d.leads?.converted ?? 0}</p>
            </div>
            <div className="rounded-lg border border-surface-200 p-4">
              <p className="text-xs text-surface-500 uppercase tracking-wide">Lost</p>
              <p className="text-2xl font-semibold text-surface-900">{d.leads?.lost ?? 0}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-surface-500 mb-2">
              <span>Conversion Rate</span>
              <span>{d.leads?.conversion_rate ?? 0}%</span>
            </div>
            <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
              <div className={`h-full bg-emerald-500 rounded-full transition-all duration-500`}
                style={{ width: `${d.leads?.conversion_rate ?? 0}%` }} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-surface-900">Lead Sources</h3>
              <p className="text-xs text-surface-500">Counts by platform this month</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {d.leads?.sources?.length ? (
              d.leads.sources.slice(0, 5).map((source) => (
                <div key={source.source} className="flex items-center justify-between rounded-lg border border-surface-200 px-4 py-3">
                  <span className="text-sm text-surface-700">{leadSourceLabel(source.source)}</span>
                  <span className="text-sm font-semibold text-surface-900">{source.count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-surface-500">No lead source data for this period.</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Activity Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follow-ups due */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-50">
            <h3 className="text-sm font-semibold text-surface-900">Follow-ups Due</h3>
            <Link to="/meetings" className="text-xs text-brand-500 hover:text-brand-700">View all →</Link>
          </div>
          <div className="divide-y divide-surface-50">
            {followUps?.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">
                  🤝
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-900 truncate">{f.doctor_name}</p>
                  <p className="text-xs text-surface-500">{f.employee_name} · {f.hospital}</p>
                </div>
                {f.days_overdue > 0
                  ? <Badge variant="red">{f.days_overdue}d late</Badge>
                  : <Badge variant="amber">Today</Badge>
                }
              </div>
            ))}
            {!followUps?.length && (
              <p className="text-xs text-surface-500 px-5 py-6 text-center">🎉 No follow-ups overdue</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-surface-900 mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link to="/leads" className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 text-sm font-medium">
            Add New Lead
          </Link>
          <Link to="/patients" className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium">
            View Patients
          </Link>
          <Link to="/meetings" className="px-4 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 text-sm font-medium">
            Schedule Meeting
          </Link>
          <Link to="/reports" className="px-4 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 text-sm font-medium">
            View Reports
          </Link>
        </div>
      </div>
    </div>
  );
}