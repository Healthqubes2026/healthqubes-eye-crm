import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import api from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Modal } from '../components/common';
import { Avatar } from '../components/common';
import { fmtDate } from '../utils/helpers';
import toast from 'react-hot-toast';

const leaveAPI = {
  list:    (params) => api.get('/attendance/leaves', { params }),
  approve: (id, data) => api.put(`/attendance/leaves/${id}/approve`, data),
  reject:  (id, data) => api.put(`/attendance/leaves/${id}/reject`, data),
};

const STATUS_OPTS = ['', 'pending', 'approved', 'rejected'];

const LEAVE_TYPE_COLOR = {
  casual: 'blue',
  sick: 'amber',
  earned: 'green',
  unpaid: 'gray',
};

export default function LeavePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionModal, setActionModal] = useState(null); // { type: 'approve'|'reject', leave }
  const [remarks, setRemarks] = useState('');

  const { data, isLoading } = useQuery(
    ['leaves', statusFilter, page],
    () => leaveAPI.list({ status: statusFilter || undefined, page, limit: 20 }).then(r => r.data),
    { keepPreviousData: true }
  );

  const rows = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = Math.ceil(total / 20);

  // Summary counts
  const pending  = rows.filter(r => r.status === 'pending').length;
  const approved = rows.filter(r => r.status === 'approved').length;
  const rejected = rows.filter(r => r.status === 'rejected').length;

  const approveMutation = useMutation(
    ({ id, remarks }) => leaveAPI.approve(id, { remarks }),
    {
      onSuccess: () => {
        toast.success('Leave approved ✅');
        qc.invalidateQueries('leaves');
        setActionModal(null);
        setRemarks('');
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
    }
  );

  const rejectMutation = useMutation(
    ({ id, remarks }) => leaveAPI.reject(id, { remarks }),
    {
      onSuccess: () => {
        toast.success('Leave rejected ❌');
        qc.invalidateQueries('leaves');
        setActionModal(null);
        setRemarks('');
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
    }
  );

  const handleAction = () => {
    if (!actionModal) return;
    const { type, leave } = actionModal;
    if (type === 'approve') approveMutation.mutate({ id: leave.id, remarks });
    else rejectMutation.mutate({ id: leave.id, remarks });
  };

  const dayCount = (from, to) => {
    const d1 = new Date(from), d2 = new Date(to);
    return Math.round((d2 - d1) / 86400000) + 1;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="text-sm text-surface-500 mt-0.5">Review and approve employee leave requests</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending"  value={pending}  icon={<span>⏳</span>} iconBg="bg-amber-50"  subVariant="neutral" />
        <StatCard label="Approved" value={approved} icon={<span>✅</span>} iconBg="bg-emerald-50" subVariant="up" />
        <StatCard label="Rejected" value={rejected} icon={<span>❌</span>} iconBg="bg-red-50"    subVariant="down" />
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-surface-600">Status</label>
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="select w-auto text-sm"
          >
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </div>
        <div className="ml-auto text-xs text-surface-500">{total} requests</div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Reason</th>
                <th>Applied On</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="text-center py-12"><PageLoader /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={9}>
                  <EmptyState icon="🏖️" title="No leave requests" description="No requests match the selected filters" />
                </td></tr>
              ) : rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.employee_name} size="sm" />
                      <div>
                        <p className="font-medium text-surface-900 text-sm">{r.employee_name}</p>
                        <p className="text-xs text-surface-500 capitalize">{r.role} · {r.zone || 'No zone'}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant={LEAVE_TYPE_COLOR[r.leave_type] || 'gray'}>
                      {r.leave_type || 'casual'}
                    </Badge>
                  </td>
                  <td className="text-sm text-surface-700">{fmtDate(r.from_date)}</td>
                  <td className="text-sm text-surface-700">{fmtDate(r.to_date)}</td>
                  <td>
                    <span className="font-semibold text-surface-900">{dayCount(r.from_date, r.to_date)}</span>
                    <span className="text-xs text-surface-500 ml-1">days</span>
                  </td>
                  <td>
                    <p className="text-sm text-surface-600 max-w-[180px] truncate" title={r.reason}>
                      {r.reason}
                    </p>
                    {r.remarks && (
                      <p className="text-xs text-surface-400 mt-0.5 italic">Note: {r.remarks}</p>
                    )}
                  </td>
                  <td className="text-xs text-surface-500">{fmtDate(r.created_at)}</td>
                  <td>
                    <Badge variant={
                      r.status === 'approved' ? 'green' :
                      r.status === 'rejected' ? 'red' : 'amber'
                    }>
                      {r.status}
                    </Badge>
                  </td>
                  <td>
                    {r.status === 'pending' ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setActionModal({ type: 'approve', leave: r }); setRemarks(''); }}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          ✅ Approve
                        </button>
                        <button
                          onClick={() => { setActionModal({ type: 'reject', leave: r }); setRemarks(''); }}
                          className="px-3 py-1 text-xs font-medium rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors"
                        >
                          ❌ Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-surface-400 italic">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            className="btn-secondary text-sm disabled:opacity-40"
          >← Prev</button>
          <span className="text-sm text-surface-500 flex items-center px-3">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => p + 1)}
            className="btn-secondary text-sm disabled:opacity-40"
          >Next →</button>
        </div>
      )}

      {/* Approve / Reject Modal */}
      <Modal
        open={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.type === 'approve' ? '✅ Approve Leave' : '❌ Reject Leave'}
      >
        {actionModal && (
          <div className="space-y-4">
            {/* Leave summary */}
            <div className="bg-surface-50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Employee</span>
                <span className="font-medium text-surface-900">{actionModal.leave.employee_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Leave Type</span>
                <span className="font-medium capitalize">{actionModal.leave.leave_type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Duration</span>
                <span className="font-medium">
                  {fmtDate(actionModal.leave.from_date)} → {fmtDate(actionModal.leave.to_date)}
                  <span className="text-surface-400 ml-1">
                    ({dayCount(actionModal.leave.from_date, actionModal.leave.to_date)} days)
                  </span>
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-500">Reason</span>
                <span className="font-medium text-right max-w-[200px]">{actionModal.leave.reason}</span>
              </div>
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">
                Remarks <span className="text-surface-400">(optional)</span>
              </label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                rows={3}
                className="input resize-none"
                placeholder={actionModal.type === 'approve' ? 'e.g. Approved. Enjoy your leave!' : 'e.g. Insufficient leave balance.'}
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={approveMutation.isLoading || rejectMutation.isLoading}
                className={actionModal.type === 'approve'
                  ? 'px-4 py-2 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50'
                  : 'px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50'
                }
              >
                {approveMutation.isLoading || rejectMutation.isLoading
                  ? 'Processing...'
                  : actionModal.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'
                }
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
