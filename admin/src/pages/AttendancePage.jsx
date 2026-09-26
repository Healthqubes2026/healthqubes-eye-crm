import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { attendanceAPI } from '../api';
import api from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Modal } from '../components/common';
import { Avatar } from '../components/common';
import { fmtTime, fmtDate, fmtDateTime, isoDate } from '../utils/helpers';
import toast from 'react-hot-toast';
import useAuthStore from '../hooks/useAuthStore';

const manualAPI = {
  employees: (search) => api.get('/attendance/manual/employees', { params: { search } }),
  add:       (data)   => api.post('/attendance/manual', data),
  override:  (id, d)  => api.put(`/attendance/manual/${id}`, d),
  logs:      (p)      => api.get('/attendance/manual/logs', { params: p }),
  bulk:      (rows)   => api.post('/attendance/manual/bulk', { rows }),
};

const STATUS_OPTS   = ['', 'present', 'late', 'absent', 'half_day', 'on_leave'];
const STATUS_LABELS = { present:'Present', late:'Late', absent:'Absent', half_day:'Half Day', on_leave:'On Leave' };
const STATUS_BADGE  = { present:'green', late:'amber', absent:'red', half_day:'amber', on_leave:'blue' };

const toTimeInput = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
};

// ── Attendance Form Modal ─────────────────────────────────────────────────────
function AttendanceFormModal({ open, onClose, editRecord, defaultDate, onSaved }) {
  const isEdit = !!editRecord;
  const qc = useQueryClient();
  const [empSearch, setEmpSearch]     = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [form, setForm] = useState({
    date:'', checkin_time:'', checkout_time:'', location:'', status:'present', notes:'', reason:'',
  });

  React.useEffect(() => {
    if (!open) return;
    if (isEdit) {
      setSelectedEmp({ id: editRecord.employee_id, name: editRecord.name, zone: editRecord.zone });
      setForm({
        date: editRecord.date ? String(editRecord.date).split('T')[0] : isoDate(),
        checkin_time:  toTimeInput(editRecord.checkin_time),
        checkout_time: toTimeInput(editRecord.checkout_time),
        location: editRecord.checkin_address || '',
        status:   editRecord.status || 'present',
        notes:    editRecord.notes || '',
        reason:   '',
      });
    } else {
      setSelectedEmp(null); setEmpSearch('');
      setForm({ date: defaultDate || isoDate(), checkin_time:'', checkout_time:'', location:'', status:'present', notes:'', reason:'' });
    }
  }, [open]);

  const { data: empData } = useQuery(
    ['manual-employees', empSearch],
    () => manualAPI.employees(empSearch).then(r => r.data.data),
    { enabled: open && !isEdit, keepPreviousData: true }
  );

  const saveMut = useMutation(
    () => isEdit
      ? manualAPI.override(editRecord.id, { ...form })
      : manualAPI.add({ employee_id: selectedEmp?.id, ...form }),
    {
      onSuccess: () => {
        toast.success(isEdit ? 'Attendance updated ✅' : 'Attendance added ✅');
        qc.invalidateQueries('team-attendance');
        onSaved?.(); onClose();
      },
      onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
    }
  );

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isEdit && !selectedEmp) return toast.error('Please select an employee');
    if (isEdit && (!form.reason || form.reason.trim().length < 3)) return toast.error('Reason for change is required');
    saveMut.mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? '✏️ Override Attendance' : '➕ Add Attendance'} width="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit ? (
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Employee *</label>
            {selectedEmp ? (
              <div className="flex items-center gap-2 p-2.5 border border-surface-200 rounded-xl bg-surface-50">
                <Avatar name={selectedEmp.name} size="sm" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedEmp.name}</p>
                  <p className="text-xs text-surface-500">{selectedEmp.zone || 'No zone'}</p>
                </div>
                <button type="button" onClick={() => setSelectedEmp(null)}
                  className="text-xs text-surface-400 hover:text-red-500">✕ Change</button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" value={empSearch} onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search employee name..." className="input pr-8" />
                {empData?.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-surface-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {empData.map(e => (
                      <button key={e.id} type="button" onClick={() => { setSelectedEmp(e); setEmpSearch(''); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-50 text-left">
                        <Avatar name={e.name} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{e.name}</p>
                          <p className="text-xs text-surface-500">{e.zone || 'No zone'} · {e.role}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2.5 border border-surface-200 rounded-xl bg-surface-50">
            <Avatar name={editRecord.name} size="sm" />
            <div>
              <p className="text-sm font-medium">{editRecord.name}</p>
              <p className="text-xs text-surface-500">{editRecord.zone || 'No zone'}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              disabled={isEdit} className="input disabled:bg-surface-50 disabled:text-surface-500" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className="select">
              {Object.entries(STATUS_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Check-in Time</label>
            <input type="time" value={form.checkin_time} onChange={e => set('checkin_time', e.target.value)} className="input" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Check-out Time</label>
            <input type="time" value={form.checkout_time} onChange={e => set('checkout_time', e.target.value)} className="input" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Location / Address</label>
          <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
            placeholder="e.g. Andheri Office, Mumbai" className="input" />
        </div>

        <div>
          <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
            rows={2} className="input resize-none" placeholder="Optional notes..." />
        </div>

        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea value={form.reason} onChange={e => set('reason', e.target.value)}
              rows={2} className="input resize-none border-amber-300"
              placeholder="Why is this attendance being overridden?" required />
          </div>
        )}

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saveMut.isLoading} className="btn-primary disabled:opacity-50">
            {saveMut.isLoading ? 'Saving...' : isEdit ? 'Update Attendance' : 'Add Attendance'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Bulk Upload Modal ─────────────────────────────────────────────────────────
function BulkUploadModal({ open, onClose }) {
  const [rows, setRows]     = useState([]);
  const [result, setResult] = useState(null);
  const fileRef = useRef();
  const qc = useQueryClient();

  const parseCsv = (text) => {
    const lines   = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split(',').map(v => v.trim());
      return headers.reduce((obj, h, i) => { obj[h] = vals[i] || ''; return obj; }, {});
    });
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try { setRows(parseCsv(ev.target.result)); setResult(null); }
      catch { toast.error('Invalid CSV format'); }
    };
    reader.readAsText(file);
  };

  const bulkMut = useMutation(() => manualAPI.bulk(rows), {
    onSuccess: (res) => {
      setResult(res.data.data);
      qc.invalidateQueries('team-attendance');
      toast.success(`Uploaded: ${res.data.data.success} records`);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Bulk upload failed'),
  });

  return (
    <Modal open={open} onClose={onClose} title="📤 Bulk Upload Attendance" width="max-w-lg">
      <div className="space-y-4">
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
          <p className="font-medium mb-1">CSV Format Required (columns):</p>
          <code className="block font-mono">employee_id, date, check_in, check_out</code>
          <code className="block font-mono text-surface-400 mt-0.5">101, 2024-01-15, 09:00, 18:00</code>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-700 mb-2">Upload CSV File</label>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile}
            className="block w-full text-sm text-surface-600 file:mr-3 file:py-1.5 file:px-3
              file:rounded-lg file:border-0 file:text-xs file:font-medium
              file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer" />
        </div>
        {rows.length > 0 && !result && (
          <div className="bg-surface-50 rounded-xl p-3">
            <p className="text-xs font-medium text-surface-600 mb-2">{rows.length} rows detected — preview:</p>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {rows.slice(0,5).map((r,i) => (
                <p key={i} className="text-xs font-mono text-surface-500">
                  {r.employee_id} | {r.date} | {r.check_in} → {r.check_out}
                </p>
              ))}
              {rows.length > 5 && <p className="text-xs text-surface-400">...and {rows.length-5} more</p>}
            </div>
          </div>
        )}
        {result && (
          <div className="space-y-2">
            <div className="flex gap-3">
              <div className="flex-1 bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-emerald-600">{result.success}</p>
                <p className="text-xs text-emerald-700">Uploaded</p>
              </div>
              <div className="flex-1 bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                <p className="text-xs text-amber-700">Skipped</p>
              </div>
              <div className="flex-1 bg-red-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-red-600">{result.failed?.length || 0}</p>
                <p className="text-xs text-red-700">Failed</p>
              </div>
            </div>
            {result.failed?.length > 0 && (
              <div className="bg-red-50 rounded-xl p-3 text-xs text-red-700 max-h-28 overflow-y-auto space-y-1">
                {result.failed.map((f,i) => (
                  <p key={i}>{f.row?.employee_id} / {f.row?.date} — {f.reason}</p>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
          {rows.length > 0 && !result && (
            <button onClick={() => bulkMut.mutate()} disabled={bulkMut.isLoading}
              className="btn-primary disabled:opacity-50">
              {bulkMut.isLoading ? 'Uploading...' : `Upload ${rows.length} Rows`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Logs Modal ────────────────────────────────────────────────────────────────
function LogsModal({ open, onClose }) {
  const { data, isLoading } = useQuery(
    'attendance-logs',
    () => manualAPI.logs({ limit: 50 }).then(r => r.data.data),
    { enabled: open }
  );
  return (
    <Modal open={open} onClose={onClose} title="📋 Attendance Change Log" width="max-w-2xl">
      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        {isLoading ? <PageLoader /> :
         !data?.length ? <EmptyState icon="📋" title="No changes logged" description="Manual changes will appear here" /> :
         data.map(log => {
           let oldV = {}, newV = {};
           try { oldV = log.old_value ? JSON.parse(log.old_value) : {}; } catch(e) {}
           try { newV = log.new_value ? JSON.parse(log.new_value) : {}; } catch(e) {}
           return (
             <div key={log.id} className="border border-surface-100 rounded-xl p-3 hover:bg-surface-50">
               <div className="flex items-start gap-2">
                 <div className="flex-1">
                   <div className="flex items-center gap-2 flex-wrap">
                     <span className="font-medium text-sm">{log.employee_name}</span>
                     <Badge variant={log.change_type === 'manual_add' ? 'green' : log.change_type === 'bulk_upload' ? 'blue' : 'amber'}>
                       {log.change_type === 'manual_add' ? 'Added' : log.change_type === 'bulk_upload' ? 'Bulk' : 'Override'}
                     </Badge>
                     <span className="text-xs text-surface-500">{fmtDate(log.date)}</span>
                   </div>
                   <p className="text-xs text-surface-500 mt-0.5">
                     By <span className="font-medium text-surface-700">{log.changed_by_name}</span>
                     <span className="capitalize"> ({log.changed_by_role})</span>
                     {' · '}{fmtDateTime(log.created_at)}
                   </p>
                   <p className="text-xs text-surface-600 mt-1 italic">"{log.reason}"</p>
                 </div>
               </div>
               {oldV.status && (
                 <div className="mt-2 flex gap-2 text-xs">
                   <div className="flex-1 bg-red-50 rounded-lg p-2">
                     <p className="font-medium text-red-700 mb-1">Before</p>
                     <p className="text-red-600 capitalize">{oldV.status}</p>
                   </div>
                   <div className="flex items-center text-surface-400">→</div>
                   <div className="flex-1 bg-green-50 rounded-lg p-2">
                     <p className="font-medium text-green-700 mb-1">After</p>
                     <p className="text-green-600 capitalize">{newV.status}</p>
                   </div>
                 </div>
               )}
             </div>
           );
         })}
      </div>
    </Modal>
  );
}

// ── Leave Modal ───────────────────────────────────────────────────────────────
// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AttendancePage() {
  const { employee } = useAuthStore();
  const isAdmin = employee?.role === 'admin';

  const [date, setDate]                 = useState(isoDate());
  const [statusFilter, setStatusFilter] = useState('');
  const [zoneFilter, setZoneFilter]     = useState('');
  const [empSearch, setEmpSearch]       = useState('');
  const [page, setPage]                 = useState(1);
  const [addModal, setAddModal]         = useState(false);
  const [editRecord, setEditRecord]     = useState(null);
  const [bulkModal, setBulkModal]       = useState(false);
  const [logsModal, setLogsModal]       = useState(false);

  const { data, isLoading, refetch } = useQuery(
    ['team-attendance', date, statusFilter, page],
    () => attendanceAPI.getTeam({ date, status: statusFilter || undefined, page, limit: 20 }).then(r => r.data),
    { keepPreviousData: true }
  );

  const rows     = data?.data || [];
  const zones    = [...new Set(rows.map(r => r.zone).filter(Boolean))];
  const filtered = rows.filter(r => {
    if (zoneFilter && r.zone !== zoneFilter) return false;
    if (empSearch && !r.name?.toLowerCase().includes(empSearch.toLowerCase())) return false;
    return true;
  });
  const counts = rows.reduce((acc, r) => {
    acc[r.status || 'absent'] = (acc[r.status || 'absent'] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="text-sm text-surface-500 mt-0.5">Track daily field employee attendance</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setLogsModal(true)} className="btn-secondary text-sm">📋 Change Log</button>
          {isAdmin && (
            <button onClick={() => setBulkModal(true)} className="btn-secondary text-sm">📤 Bulk Upload</button>
          )}
          <button onClick={() => setAddModal(true)} className="btn-primary">+ Add Attendance</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Present"  value={counts.present  || 0} subVariant="up"      icon={<span>✅</span>} iconBg="bg-emerald-50" />
        <StatCard label="Late"     value={counts.late     || 0} subVariant="down"    icon={<span>🕐</span>} iconBg="bg-amber-50" />
        <StatCard label="Absent"   value={counts.absent   || 0} subVariant="down"    icon={<span>❌</span>} iconBg="bg-red-50" />
        <StatCard label="On Leave" value={counts.on_leave || 0} subVariant="neutral" icon={<span>🏖</span>} iconBg="bg-blue-50" />
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-surface-600">Date</label>
          <input type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }}
            className="input w-auto text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-surface-600">Status</label>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="select w-auto text-sm">
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s ? STATUS_LABELS[s] : 'All'}</option>)}
          </select>
        </div>
        {zones.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-surface-600">Zone</label>
            <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)} className="select w-auto text-sm">
              <option value="">All Zones</option>
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
        )}
        <input type="text" placeholder="Search employee..." value={empSearch}
          onChange={e => setEmpSearch(e.target.value)} className="input w-44 text-sm" />
        <div className="ml-auto text-xs text-surface-500">{filtered.length} records</div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th><th>Zone</th><th>Check-in</th><th>Location</th>
                <th>Check-out</th><th>Hours</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12"><PageLoader /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}>
                  <EmptyState icon="📅" title="No attendance records" description="No records match the selected filters" />
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id || r.employee_id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <div>
                        <p className="font-medium text-surface-900 text-sm">{r.name}</p>
                        <p className="text-xs text-surface-500">{r.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-surface-600">{r.zone || '—'}</td>
                  <td>
                    {r.checkin_time
                      ? <div>
                          <p className="font-medium">{fmtTime(r.checkin_time)}</p>
                          {r.is_late && <span className="text-xs text-amber-600">Late</span>}
                        </div>
                      : <span className="text-surface-400">—</span>}
                  </td>
                  <td>
                    <p className="text-xs text-surface-600 max-w-[140px] truncate">
                      {r.checkin_address || '—'}
                    </p>
                  </td>
                  <td>{r.checkout_time ? fmtTime(r.checkout_time) : <span className="text-surface-400">—</span>}</td>
                  <td>
                    {r.working_hours
                      ? <span className="font-medium">{r.working_hours}h</span>
                      : <span className="text-surface-400">—</span>}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <Badge variant={STATUS_BADGE[r.status] || 'gray'}>
                        {STATUS_LABELS[r.status] || 'No record'}
                      </Badge>
                      {r.is_manual && (
                        <span className="text-[10px] text-surface-400">
                          ✏️ {r.modified_by_role === 'admin' ? 'Admin' : 'Manager'} override
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {r.id && (
                      <button onClick={() => setEditRecord(r)}
                        className="px-2.5 py-1 text-xs font-medium rounded-lg bg-surface-100 text-surface-700 hover:bg-brand-50 hover:text-brand-700 transition-colors">
                        ✏️ Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <AttendanceFormModal open={addModal} onClose={() => setAddModal(false)} defaultDate={date} onSaved={refetch} />
      <AttendanceFormModal open={!!editRecord} onClose={() => setEditRecord(null)} editRecord={editRecord} onSaved={refetch} />
      {isAdmin && <BulkUploadModal open={bulkModal} onClose={() => setBulkModal(false)} />}
      <LogsModal   open={logsModal}  onClose={() => setLogsModal(false)} />
    </div>
  );
}
