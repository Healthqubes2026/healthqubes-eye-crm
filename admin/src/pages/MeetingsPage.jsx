import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { meetingsAPI } from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Pagination, Modal, Avatar } from '../components/common';
import { fmtDate, fmtDateTime, fmtTime, outcomeBadge, outcomeLabel, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export default function MeetingsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addModal, setAddModal]     = useState(false);
  const [doctorModal, setDoctorModal] = useState(false);
  const [tab, setTab] = useState('visits'); // 'visits' | 'followups' | 'doctors'

  const { data, isLoading } = useQuery(
    ['meetings', page],
    () => meetingsAPI.list({ page, limit: 20 }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: followUpsData } = useQuery('meeting-followups',
    () => meetingsAPI.followUps().then(r => r.data)
  );
  const { data: doctorsData } = useQuery('doctors',
    () => meetingsAPI.listDoctors({ limit: 50 }).then(r => r.data)
  );

  const { register: regVisit, handleSubmit: handleVisit, reset: resetVisit } = useForm();
  const { register: regDoc,   handleSubmit: handleDoc,   reset: resetDoc   } = useForm();

  const addMutation = useMutation(
    (fd) => meetingsAPI.add(fd),
    {
      onSuccess: () => {
        toast.success('Meeting recorded');
        qc.invalidateQueries('meetings');
        setAddModal(false); resetVisit();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const addDoctorMutation = useMutation(
    (data) => meetingsAPI.addDoctor(data),
    {
      onSuccess: () => {
        toast.success('Doctor added');
        qc.invalidateQueries('doctors');
        setDoctorModal(false); resetDoc();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const onAddVisit = (vals) => {
    const fd = new FormData();
    Object.entries(vals).forEach(([k, v]) => v && fd.append(k, v));
    addMutation.mutate(fd);
  };

  const meetings   = data?.data       || [];
  const followUps  = followUpsData?.data || [];
  const doctors    = doctorsData?.data   || [];
  const total      = data?.meta?.total   || 0;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Doctor Meetings</h1>
          <p className="text-sm text-surface-500 mt-0.5">Field visit tracking &amp; follow-ups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setDoctorModal(true)} className="btn-secondary">+ Add Doctor</button>
          <button onClick={() => setAddModal(true)} className="btn-primary">+ Log Visit</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Visits"       value={total}                      icon={<span>🤝</span>} iconBg="bg-purple-50" />
        <StatCard label="Follow-ups Due"     value={followUps.length}           icon={<span>📆</span>} iconBg="bg-amber-50"
          subVariant={followUps.filter(f => f.days_overdue > 0).length > 0 ? 'down' : 'up'}
          sub={`${followUps.filter(f => f.days_overdue > 0).length} overdue`} />
        <StatCard label="Doctors in System"  value={doctors.length}             icon={<span>🏥</span>} iconBg="bg-brand-50" />
        <StatCard label="Visits Today"       value={meetings.filter(m => {
            try { return new Date(m.checkin_time).toDateString() === new Date().toDateString(); }
            catch { return false; }
          }).length} icon={<span>📍</span>} iconBg="bg-teal-50" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
        {[['visits','Visits'], ['followups','Follow-ups'], ['doctors','Doctors']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === key ? 'bg-white text-brand-600 shadow-card' : 'text-surface-600 hover:text-surface-900'
            }`}>
            {label}
            {key === 'followups' && followUps.length > 0 &&
              <span className="ml-1.5 bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 rounded-full">
                {followUps.length}
              </span>
            }
          </button>
        ))}
      </div>

      {/* Visits table */}
      {tab === 'visits' && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead><tr>
                <th>Employee</th><th>Doctor</th><th>Hospital</th>
                <th>Date</th><th>Duration</th><th>Products</th><th>Outcome</th>
              </tr></thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="py-12 text-center"><PageLoader /></td></tr>
                ) : meetings.length === 0 ? (
                  <tr><td colSpan={7}><EmptyState icon="🤝" title="No meetings yet" description="Log your first doctor visit" /></td></tr>
                ) : meetings.map((m) => (
                  <tr key={m.id}>
                    <td><div className="flex items-center gap-2"><Avatar name={m.employee_name} size="sm" /><span className="text-sm">{m.employee_name}</span></div></td>
                    <td><div><p className="font-medium text-sm">{m.doctor_name}</p><p className="text-xs text-surface-500">{m.city}</p></div></td>
                    <td className="text-xs text-surface-600 max-w-[120px] truncate">{m.hospital}</td>
                    <td className="text-xs">{fmtDate(m.visit_date)}<br/><span className="text-surface-500">{fmtTime(m.checkin_time)}</span></td>
                    <td className="text-sm">{m.duration_minutes ? `${m.duration_minutes} min` : '—'}</td>
                    <td>
                      {(() => {
                        try {
                          const p = typeof m.products_discussed === 'string' ? JSON.parse(m.products_discussed) : m.products_discussed;
                          return <span className="text-xs text-surface-600">{Array.isArray(p) ? p.join(', ') : '—'}</span>;
                        } catch { return '—'; }
                      })()}
                    </td>
                    <td><Badge variant={outcomeBadge(m.outcome).replace('badge-', '')}>{outcomeLabel(m.outcome)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} total={total} limit={20} onChange={setPage} />
        </div>
      )}

      {/* Follow-ups */}
      {tab === 'followups' && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Doctor</th><th>Hospital</th><th>Employee</th><th>Follow-up Date</th><th>Overdue</th></tr></thead>
              <tbody>
                {followUps.length === 0 ? (
                  <tr><td colSpan={5}><EmptyState icon="🎉" title="No follow-ups overdue" description="All follow-ups are on track" /></td></tr>
                ) : followUps.map((f) => (
                  <tr key={f.id}>
                    <td className="font-medium">{f.doctor_name}</td>
                    <td className="text-xs text-surface-600">{f.hospital}</td>
                    <td>{f.employee_name}</td>
                    <td>{fmtDate(f.follow_up_date)}</td>
                    <td>{f.days_overdue > 0 ? <Badge variant="red">{f.days_overdue} days late</Badge> : <Badge variant="amber">Due today</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Doctors */}
      {tab === 'doctors' && (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Doctor</th><th>Specialization</th><th>Hospital</th><th>City</th><th>Phone</th><th>Visits</th><th>Last Visit</th></tr></thead>
              <tbody>
                {doctors.map((d) => (
                  <tr key={d.id}>
                    <td className="font-medium">{d.name}</td>
                    <td className="text-xs text-surface-600">{d.specialization || '—'}</td>
                    <td className="text-xs">{d.hospital}</td>
                    <td className="text-xs text-surface-600">{d.city}</td>
                    <td className="text-xs font-mono">{d.phone || '—'}</td>
                    <td><span className="font-medium">{d.total_visits || 0}</span></td>
                    <td className="text-xs text-surface-500">{d.last_visit ? fmtDate(d.last_visit) : 'Never'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Visit Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Log Doctor Visit" width="max-w-xl">
        <form onSubmit={handleVisit(onAddVisit)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Doctor *</label>
            <select {...regVisit('doctor_id', { required: true })} className="select">
              <option value="">Select doctor...</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name} — {d.hospital}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Visit Date</label>
              <input type="date" {...regVisit('visit_date')} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Follow-up Date</label>
              <input type="date" {...regVisit('follow_up_date')} className="input" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Products Discussed</label>
            <input {...regVisit('products_discussed')} className="input" placeholder="e.g. Cataract IOL Lens, Dry Eye Drops" />
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Outcome</label>
            <select {...regVisit('outcome')} className="select">
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
              <option value="no_meet">No Meet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-surface-700 mb-1">Meeting Notes</label>
            <textarea {...regVisit('meeting_notes')} rows={3} className="input resize-none"
              placeholder="What was discussed, next steps..." />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isLoading} className="btn-primary">
              {addMutation.isLoading ? 'Saving...' : 'Save Visit'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Doctor Modal */}
      <Modal open={doctorModal} onClose={() => setDoctorModal(false)} title="Add Doctor">
        <form onSubmit={handleDoc((v) => addDoctorMutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-surface-700 mb-1">Doctor Name *</label>
              <input {...regDoc('name', { required: true })} className="input" placeholder="Dr. Full Name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Specialization</label>
              <input {...regDoc('specialization')} className="input" placeholder="e.g. Cataract Surgery" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Phone</label>
              <input {...regDoc('phone')} className="input" placeholder="9800000000" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-surface-700 mb-1">Hospital / Clinic</label>
              <input {...regDoc('hospital')} className="input" placeholder="Hospital name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">City</label>
              <input {...regDoc('city')} className="input" placeholder="Bengaluru" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Category</label>
              <select {...regDoc('category')} className="select">
                <option value="A">A — High Value</option>
                <option value="B">B — Medium</option>
                <option value="C">C — Low</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setDoctorModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addDoctorMutation.isLoading} className="btn-primary">
              {addDoctorMutation.isLoading ? 'Adding...' : 'Add Doctor'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
