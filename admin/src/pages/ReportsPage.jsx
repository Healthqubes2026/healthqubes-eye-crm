import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { reportsAPI } from '../api';
import { StatCard, PageLoader, Avatar } from '../components/common';
import { fmtINR, fmtDate, isoDate, leadSourceLabel } from '../utils/helpers';

const REPORT_TABS = [
  { key: 'attendance',  label: 'Attendance' },
  { key: 'sales',       label: 'Sales' },
  { key: 'leads',       label: 'Leads' },
  { key: 'performance', label: 'Performance' },
];

const PIE_COLORS = ['#2E6BE6', '#0F8C6A', '#D97706', '#7C3AED', '#6B7280'];
const RADIAN = Math.PI / 180;

const getContrastColor = (hexColor) => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#111' : '#fff';
};

const renderPipelineLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill={getContrastColor(PIE_COLORS[index % PIE_COLORS.length])}
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {`${Math.round(percent * 100)}%`}
    </text>
  );
};

export default function ReportsPage() {
  const [tab, setTab] = useState('performance');
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`);
  const [to, setTo]     = useState(isoDate());

  const { data: attData, isLoading: attLoading }   = useQuery(['report-att', from, to],
    () => reportsAPI.attendance({ from, to }).then(r => r.data), { enabled: tab === 'attendance' }
  );
  const { data: salesData, isLoading: salesLoading } = useQuery(['report-sales', from, to],
    () => reportsAPI.sales({ from, to, group_by: 'day' }).then(r => r.data), { enabled: tab === 'sales' }
  );
  const { data: leadsData, isLoading: leadsLoading } = useQuery(['report-leads', from, to],
    () => reportsAPI.leads({ from, to }).then(r => r.data), { enabled: tab === 'leads' }
  );
  const { data: perfData, isLoading: perfLoading }   = useQuery(['report-perf'],
    () => reportsAPI.performance().then(r => r.data), { enabled: tab === 'performance' }
  );

  const isLoading = attLoading || salesLoading || leadsLoading || perfLoading;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="text-sm text-surface-500 mt-0.5">Analytics across all modules</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="input w-auto text-sm" />
          <span className="text-surface-400 text-sm">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="input w-auto text-sm" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
        {REPORT_TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-brand-600 shadow-card' : 'text-surface-600 hover:text-surface-900'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading && <PageLoader />}

      {/* Attendance Report */}
      {tab === 'attendance' && !attLoading && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-50">
              <h3 className="text-sm font-semibold">Attendance Summary</h3>
            </div>
            <div className="table-container">
              <table className="table">
                <thead><tr>
                  <th>Employee</th><th>Zone</th><th>Present</th><th>Absent</th>
                  <th>Late</th><th>Half Day</th><th>Total Hrs</th><th>Avg Hrs</th>
                </tr></thead>
                <tbody>
                  {(attData?.data || []).map((r) => (
                    <tr key={r.id}>
                      <td><div className="flex items-center gap-2"><Avatar name={r.name} size="sm" /><span>{r.name}</span></div></td>
                      <td className="text-xs text-surface-500">{r.zone}</td>
                      <td><span className="font-medium text-emerald-700">{r.present_days}</span></td>
                      <td><span className="font-medium text-red-600">{r.absent_days}</span></td>
                      <td><span className="text-amber-600">{r.late_days}</span></td>
                      <td>{r.half_days}</td>
                      <td className="font-medium">{r.total_hours}h</td>
                      <td className="text-surface-600">{r.avg_hours}h</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sales Report */}
      {tab === 'sales' && !salesLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Total Revenue" value={fmtINR(salesData?.data?.totals?.total_revenue)} icon={<span>💰</span>} iconBg="bg-emerald-50" />
            <StatCard label="Total Orders"  value={salesData?.data?.totals?.total_orders}           icon={<span>📦</span>} iconBg="bg-brand-50" />
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">Daily Revenue</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={salesData?.data?.trend || []} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => fmtINR(v)} width={52} />
                <Tooltip formatter={v => [fmtINR(v), 'Revenue']} />
                <Bar dataKey="revenue" fill="#2E6BE6" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">Top Products</h3>
            <div className="space-y-2">
              {(salesData?.data?.by_product || []).slice(0,8).map((p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-surface-600 w-48 truncate">{p.name}</span>
                  <div className="flex-1 h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-400 rounded-full" style={{
                      width: `${Math.round((p.revenue / (salesData?.data?.by_product?.[0]?.revenue || 1)) * 100)}%`
                    }} />
                  </div>
                  <span className="text-xs font-medium w-16 text-right">{fmtINR(p.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Leads Report */}
      {tab === 'leads' && !leadsLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4">Pipeline Status</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                      <Pie
                    data={leadsData?.data?.pipeline || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label={renderPipelineLabel}
                    labelLine={false}
                  >
                    {(leadsData?.data?.pipeline || []).map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: 10, marginTop: 10 }} />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-4">By Condition</h3>
              <div className="space-y-2">
                {(leadsData?.data?.by_condition || []).map((c, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs text-surface-600 w-36 truncate">{c.eye_condition}</span>
                    <div className="flex-1 h-2 bg-surface-100 rounded-full">
                      <div className="h-full bg-teal-400 rounded-full" style={{
                        width: `${Math.round((c.count / (leadsData?.data?.by_condition?.[0]?.count || 1)) * 100)}%`
                      }}/>
                    </div>
                    <span className="text-xs font-medium w-8 text-right">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-4">By Source</h3>
            <div className="space-y-2">
              {(leadsData?.data?.by_source || []).map((s, i) => (
                <div key={s.source || i} className="flex items-center gap-3">
                  <span className="text-xs text-surface-600 w-36 truncate">{leadSourceLabel(s.source)}</span>
                  <div className="flex-1 h-2 bg-surface-100 rounded-full">
                    <div className="h-full bg-brand-400 rounded-full" style={{
                      width: `${Math.round((s.count / (leadsData?.data?.by_source?.[0]?.count || 1)) * 100)}%`
                    }}/>
                  </div>
                  <span className="text-xs font-medium w-8 text-right">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-50"><h3 className="text-sm font-semibold">By Employee</h3></div>
            <div className="table-container">
              <table className="table">
                <thead><tr><th>Employee</th><th>Total Leads</th><th>Converted</th><th>Conversion Rate</th></tr></thead>
                <tbody>
                  {(leadsData?.data?.by_employee || []).map((e) => (
                    <tr key={e.name}>
                      <td>{e.name}</td>
                      <td className="font-medium">{e.total}</td>
                      <td className="text-emerald-700 font-medium">{e.converted}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-surface-100 rounded-full w-20">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${e.conversion_rate}%` }} />
                          </div>
                          <span className="text-xs font-medium">{e.conversion_rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Performance Report */}
      {tab === 'performance' && !perfLoading && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-surface-50">
            <h3 className="text-sm font-semibold">Employee Performance — This Month</h3>
          </div>
          <div className="table-container">
            <table className="table">
              <thead><tr>
                <th>Employee</th><th>Zone</th><th>Days Present</th><th>Doctor Visits</th>
                <th>Leads Added</th><th>Leads Converted</th><th>Sales Revenue</th><th>Orders</th>
              </tr></thead>
              <tbody>
                {(perfData?.data || []).map((e) => (
                  <tr key={e.id}>
                    <td><div className="flex items-center gap-2"><Avatar name={e.name} size="sm" /><span className="text-sm font-medium">{e.name}</span></div></td>
                    <td className="text-xs text-surface-500">{e.zone || '—'}</td>
                    <td><span className="font-medium">{e.present_days}</span></td>
                    <td><span className="font-medium">{e.doctor_visits}</span></td>
                    <td>{e.leads_added}</td>
                    <td><span className="text-emerald-700 font-medium">{e.leads_converted}</span></td>
                    <td><span className="font-semibold text-emerald-700">{fmtINR(e.sales_revenue)}</span></td>
                    <td>{e.sales_orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
