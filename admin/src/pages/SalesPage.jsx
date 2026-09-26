import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { salesAPI, meetingsAPI, productsAPI } from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Pagination, Modal } from '../components/common';
import { fmtINR, fmtDate, apiError } from '../utils/helpers';
import { useForm, useFieldArray } from 'react-hook-form';
import toast from 'react-hot-toast';

export default function SalesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addModal, setAddModal] = useState(false);

  const { data, isLoading } = useQuery(
    ['sales', page],
    () => salesAPI.list({ page, limit: 20 }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: summary }      = useQuery('sales-summary', () => salesAPI.summary().then(r => r.data.data));
  const { data: doctorsData }  = useQuery('doctors', () => meetingsAPI.listDoctors({ limit: 100 }).then(r => r.data));
  const { data: productsData } = useQuery('products-active', () => productsAPI.list({ active: '1' }).then(r => r.data.data), { staleTime: 60000 });

  const { register, handleSubmit, control, watch, reset } = useForm({
    defaultValues: { items: [{ product_id: '', quantity: 1 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const products   = productsData || [];
  const watchItems = watch('items');
  const orderTotal = watchItems.reduce((sum, item) => {
    const prod = products.find(p => p.id === parseInt(item.product_id));
    return sum + (prod ? parseFloat(prod.unit_price) * (parseInt(item.quantity) || 0) : 0);
  }, 0);

  const addMutation = useMutation(
    (vals) => salesAPI.add({
      ...vals,
      items: vals.items.map(i => ({ product_id: parseInt(i.product_id), quantity: parseInt(i.quantity) })),
    }),
    {
      onSuccess: () => {
        toast.success('Sale recorded');
        qc.invalidateQueries('sales');
        qc.invalidateQueries('sales-summary');
        setAddModal(false);
        reset();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const sales   = data?.data        || [];
  const total   = data?.meta?.total || 0;
  const doctors = doctorsData?.data || [];
  const trend   = summary?.trend?.slice(-14) || [];

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sales Tracking</h1>
          <p className="text-sm text-surface-500 mt-0.5">Record and monitor field sales</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">+ Add Sale</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="MTD Revenue"  value={fmtINR(summary?.totals?.total_revenue)} icon={<span>💰</span>} iconBg="bg-emerald-50" subVariant="up" sub="This month" />
        <StatCard label="MTD Orders"   value={summary?.totals?.total_orders}          icon={<span>📦</span>} iconBg="bg-brand-50" />
        <StatCard label="Top Product"
          value={summary?.top_products?.[0]?.name?.split('(')[0].trim() || '—'}
          icon={<span>⭐</span>} iconBg="bg-amber-50"
          sub={summary?.top_products?.[0] ? fmtINR(summary.top_products[0].revenue) : ''} />
        <StatCard label="Avg Order"
          value={summary?.totals?.total_orders ? fmtINR(summary.totals.total_revenue / summary.totals.total_orders) : '—'}
          icon={<span>📊</span>} iconBg="bg-purple-50" />
      </div>

      {/* Chart */}
      {trend.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-surface-900 mb-4">Daily Revenue</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={trend} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false}
                tickFormatter={v => fmtINR(v)} width={52} />
              <Tooltip formatter={(v) => [fmtINR(v), 'Revenue']}
                contentStyle={{ borderRadius: 10, border: '1px solid #E0E2E9', fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#2E6BE6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sales table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th>Date</th><th>Employee</th><th>Doctor</th>
              <th>Products</th><th>Amount</th><th>Payment</th><th>Location</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="py-12 text-center"><PageLoader /></td></tr>
              ) : sales.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon="💰" title="No sales yet" description="Record your first sale" /></td></tr>
              ) : sales.map((s) => (
                <tr key={s.id}>
                  <td className="text-xs font-medium">{fmtDate(s.sale_date)}</td>
                  <td className="text-sm">{s.employee_name}</td>
                  <td className="text-xs text-surface-600">{s.doctor_name || s.hospital || '—'}</td>
                  <td>
                    <div className="space-y-0.5">
                      {(s.items || []).map((item, i) => (
                        <p key={i} className="text-xs text-surface-700">
                          {item.product_name} ×{item.quantity}
                        </p>
                      ))}
                    </div>
                  </td>
                  <td><span className="font-semibold text-emerald-700">{fmtINR(s.total_amount)}</span></td>
                  <td><Badge variant="gray">{s.payment_mode || 'cash'}</Badge></td>
                  <td className="text-xs text-surface-500 max-w-[120px] truncate">{s.location_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={20} onChange={setPage} />
      </div>

      {/* Add Sale Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Record Sale" width="max-w-xl">
        <form onSubmit={handleSubmit((v) => addMutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Doctor</label>
              <select {...register('doctor_id')} className="select">
                <option value="">Select doctor...</option>
                {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Sale Date</label>
              <input type="date" {...register('sale_date')} className="input"
                defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Hospital</label>
              <input {...register('hospital')} className="input" placeholder="Hospital / Clinic" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Payment Mode</label>
              <select {...register('payment_mode')} className="select">
                {['cash','upi','neft','cheque','credit'].map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-surface-700">Products *</label>
              <button type="button" onClick={() => append({ product_id: '', quantity: 1 })}
                className="text-xs text-brand-500 hover:text-brand-700">+ Add item</button>
            </div>
            {products.length === 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
                No products found. Ask your admin to add products first.
              </p>
            )}
            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="flex gap-2 items-center">
                  <select {...register(`items.${idx}.product_id`, { required: true })} className="select flex-1 text-xs">
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{parseFloat(p.unit_price).toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                  <input type="number" min="1" {...register(`items.${idx}.quantity`)}
                    className="input w-20 text-center text-sm" placeholder="Qty" />
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(idx)}
                      className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Order total */}
          {orderTotal > 0 && (
            <div className="bg-emerald-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-emerald-700 font-medium">Order Total</span>
              <span className="text-lg font-semibold text-emerald-700">{fmtINR(orderTotal)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Optional notes..." />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isLoading} className="btn-primary">
              {addMutation.isLoading ? 'Saving...' : 'Record Sale'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
