import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { leadsAPI, tasksAPI } from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Pagination, Modal } from '../components/common';
import { fmtDate, leadStatusBadge, leadSourceLabel, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const STATUSES = ['new_lead','attempted','connected','requirement_captured','docs_requested','docs_received','hospital_shortlisted','quotation_requested','quotation_received','treatment_plan_shared','negotiation','decision_pending','converted','lost','closed'];
const PRIORITIES = ['high', 'medium', 'low'];
const LEAD_SOURCES = ['field','referral','online','camp','other','google_leads','facebook','instagram','linkedin','twitter','whatsapp'];
const SEVERITIES = ['mild','moderate','severe','critical'];
const ACTIVITY_CHANNELS = ['note','call','email','whatsapp','meeting'];

export default function LeadsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]   = useState('');
  const [addModal, setAddModal] = useState(false);
  const [statusModal, setStatusModal] = useState(null); // lead object
  const [statusModalStatus, setStatusModalStatus] = useState('new_lead');
  const [convertModal, setConvertModal] = useState(null); // lead object
  const [editModal, setEditModal] = useState(false);
  const [editLead, setEditLead] = useState(null);
  const [detailLeadId, setDetailLeadId] = useState(null);
  const [activityNote, setActivityNote] = useState('');
  const [activityChannel, setActivityChannel] = useState('note');
  const [activityTags, setActivityTags] = useState('');
  const { register, handleSubmit, reset } = useForm();
  const { register: regStatus, handleSubmit: handleStatus } = useForm();
  const { register: regConvert, handleSubmit: handleConvert } = useForm();
  const { register: regEdit, handleSubmit: handleEdit, reset: resetEdit } = useForm();

  const { data: leadDetailData, isLoading: leadDetailLoading } = useQuery(
    ['lead-detail', detailLeadId],
    () => leadsAPI.get(detailLeadId).then((r) => r.data.data),
    { enabled: !!detailLeadId }
  );

  const { data: leadTasksData } = useQuery(
    ['lead-tasks', detailLeadId],
    () => tasksAPI.list({ lead_id: detailLeadId, limit: 10 }).then((r) => r.data),
    { enabled: !!detailLeadId }
  );

  const { data, isLoading } = useQuery(
    ['leads', page, statusFilter, search],
    () => leadsAPI.list({ page, limit: 20, status: statusFilter || undefined, search: search || undefined }).then(r => r.data),
    { keepPreviousData: true }
  );
  const { data: pipelineData } = useQuery('lead-pipeline', () => leadsAPI.pipeline().then(r => r.data.data));

  const addMutation = useMutation(
    (fd) => leadsAPI.add(fd),
    {
      onSuccess: () => {
        toast.success('Lead added');
        qc.invalidateQueries('leads');
        qc.invalidateQueries('lead-pipeline');
        setAddModal(false); reset();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const statusMutation = useMutation(
    ({ id, ...vals }) => leadsAPI.updateStatus(id, vals),
    {
      onSuccess: () => {
        toast.success('Status updated');
        qc.invalidateQueries('leads');
        qc.invalidateQueries('lead-pipeline');
        setStatusModal(null);
        setStatusModalStatus('new_lead');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const convertMutation = useMutation(
    ({ id, ...vals }) => leadsAPI.convert(id, vals),
    {
      onSuccess: () => {
        toast.success('Lead converted to patient');
        qc.invalidateQueries('leads');
        qc.invalidateQueries('lead-pipeline');
        setConvertModal(null);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const editMutation = useMutation(
    ({ id, ...vals }) => leadsAPI.update(id, vals),
    {
      onSuccess: () => {
        toast.success('Lead updated');
        qc.invalidateQueries('leads');
        qc.invalidateQueries('lead-pipeline');
        setEditModal(false);
        setEditLead(null);
        resetEdit();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const activityMutation = useMutation(
    (data) => leadsAPI.addActivity(detailLeadId, data),
    {
      onSuccess: () => {
        toast.success('Activity logged');
        qc.invalidateQueries(['lead-detail', detailLeadId]);
        setActivityNote('');
        setActivityChannel('note');
        setActivityTags('');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const submitActivity = () => {
    if (!activityNote.trim()) {
      return toast.error('Please enter a note to save.');
    }

    activityMutation.mutate({
      action: 'conversation_note',
      notes: activityNote.trim(),
      channel: activityChannel,
      tags: activityTags.trim() || null,
    });
  };

  const onAdd = (vals) => {
    const fd = new FormData();
    Object.entries(vals).forEach(([k, v]) => v && fd.append(k, v));
    addMutation.mutate(fd);
  };

  const onConvert = (vals) => {
    convertMutation.mutate({ id: convertModal.id, ...vals });
  };

  useEffect(() => {
    if (!statusModal) return;
    setStatusModalStatus(statusModal.status || 'new_lead');
  }, [statusModal]);

  useEffect(() => {
    if (!editLead) return;

    resetEdit({
      patient_name: editLead.patient_name || '',
      phone: editLead.phone || '',
      whatsapp: editLead.whatsapp || '',
      email: editLead.email || '',
      country: editLead.country || '',
      city: editLead.city || '',
      state: editLead.state || '',
      relationship_to_patient: editLead.relationship_to_patient || '',
      language: editLead.language || '',
      nationality: editLead.nationality || '',
      preferred_country: editLead.preferred_country || '',
      eye_condition: editLead.eye_condition || '',
      treatment: editLead.treatment || '',
      hospital: editLead.hospital || '',
      doctor_id: editLead.doctor_id || '',
      follow_up_date: editLead.follow_up_date || '',
      priority: editLead.priority || 'medium',
      source: editLead.source || 'field',
      notes: editLead.notes || '',
      utm_source: editLead.utm_source || '',
      utm_medium: editLead.utm_medium || '',
      utm_campaign: editLead.utm_campaign || '',
      referral_source: editLead.referral_source || '',
      landing_page: editLead.landing_page || '',
      medical_category: editLead.medical_category || '',
      diagnosis: editLead.diagnosis || '',
      severity: editLead.severity || 'moderate',
      budget: editLead.budget || '',
      estimated_revenue: editLead.estimated_revenue || '',
      timeline_days: editLead.timeline_days || '',
    });
  }, [editLead, resetEdit]);

  const leads  = data?.data       || [];
  const total  = data?.meta?.total || 0;
  const pipe   = pipelineData     || {};

  const PIPELINE_COLORS = {
    new_lead: 'bg-brand-400', attempted: 'bg-cyan-400', connected: 'bg-teal-400',
    requirement_captured: 'bg-indigo-400', docs_requested: 'bg-violet-400', docs_received: 'bg-purple-400',
    hospital_shortlisted: 'bg-amber-400', quotation_requested: 'bg-orange-400', quotation_received: 'bg-yellow-400',
    treatment_plan_shared: 'bg-green-400', negotiation: 'bg-amber-400', decision_pending: 'bg-pink-400',
    converted: 'bg-emerald-500', lost: 'bg-red-500', closed: 'bg-slate-400',
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Lead Tracking</h1>
          <p className="text-sm text-surface-500 mt-0.5">Patient lead pipeline &amp; follow-up management</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">+ Add Lead</button>
      </div>

      {/* Pipeline mini-board */}
      <div className="grid grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`card p-4 text-left transition-all hover:shadow-card-hover ${statusFilter === s ? 'ring-2 ring-brand-500' : ''}`}>
            <div className={`w-2 h-2 rounded-full mb-2 ${PIPELINE_COLORS[s]}`} />
            <p className="text-lg font-semibold text-surface-900">{pipe[s] || 0}</p>
            <p className="text-xs text-surface-500 capitalize mt-0.5">{s.replace('_', ' ')}</p>
          </button>
        ))}
      </div>

      {/* Search & filter */}
      <div className="card p-4 flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input w-64" placeholder="Search patient, phone, condition..." />
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="select w-auto">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <div className="ml-auto text-xs text-surface-500">{total} leads</div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th>Patient</th><th>Condition</th><th>Treatment</th>
              <th>Doctor</th><th>Assigned To</th><th>Follow-up</th>
              <th>Priority</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="py-12 text-center"><PageLoader /></td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9}><EmptyState icon="👥" title="No leads found" description="Add your first patient lead" /></td></tr>
              ) : leads.map((l) => (
                <tr key={l.id}>
                  <td>
                    <div>
                      <p className="font-medium text-sm">{l.patient_name}</p>
                      <p className="text-xs text-surface-500 font-mono">{l.phone || l.email || '—'}</p>
                    </div>
                  </td>
                  <td className="text-xs text-surface-700">{l.eye_condition || '—'}</td>
                  <td className="text-xs text-surface-600">{l.treatment || '—'}</td>
                  <td className="text-xs">{l.doctor_name || '—'}</td>
                  <td className="text-xs">{l.assigned_to_name || '—'}</td>
                  <td className="text-xs">
                    {l.follow_up_date
                      ? <span className={new Date(l.follow_up_date) < new Date() && l.status !== 'converted' && l.status !== 'closed' ? 'text-red-600 font-medium' : ''}>
                          {fmtDate(l.follow_up_date)}
                        </span>
                      : '—'
                    }
                  </td>
                  <td>
                    <Badge variant={l.priority === 'high' ? 'red' : l.priority === 'medium' ? 'amber' : 'gray'}>
                      {l.priority}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={leadStatusBadge(l.status).replace('badge-', '')}>
                      {l.status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="space-x-2">
                    <button onClick={() => setDetailLeadId(l.id)}
                      className="text-xs text-surface-600 hover:text-surface-900 font-medium">
                      View
                    </button>
                    <button onClick={() => { setEditLead(l); setEditModal(true); }}
                      className="text-xs text-surface-600 hover:text-surface-900 font-medium">
                      Edit
                    </button>
                    <button onClick={() => setStatusModal(l)}
                      className="text-xs text-brand-500 hover:text-brand-700 font-medium">
                      Update
                    </button>
                    {l.status !== 'converted' && (
                      <button onClick={() => setConvertModal(l)}
                        className="text-xs text-green-500 hover:text-green-700 font-medium">
                        Convert
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={20} onChange={setPage} />
      </div>

      {/* Add Lead Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Patient Lead" width="max-w-2xl">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-surface-700 mb-1">Patient Name *</label>
              <input {...register('patient_name', { required: true })} className="input" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Phone</label>
              <input {...register('phone')} className="input" placeholder="9XXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">WhatsApp</label>
              <input {...register('whatsapp')} className="input" placeholder="WhatsApp number" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="patient@email.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Relationship to Patient</label>
              <input {...register('relationship_to_patient')} className="input" placeholder="Self / Relative / Friend" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Language</label>
              <input {...register('language')} className="input" placeholder="Preferred language" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Nationality</label>
              <input {...register('nationality')} className="input" placeholder="Nationality" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Country</label>
              <input {...register('country')} className="input" placeholder="Country" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">State</label>
              <input {...register('state')} className="input" placeholder="State" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">City / Residence</label>
              <input {...register('city')} className="input" placeholder="City or residence" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Preferred Country</label>
              <input {...register('preferred_country')} className="input" placeholder="Preferred treatment country" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Landing Page</label>
              <input {...register('landing_page')} className="input" placeholder="Landing page URL" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Source</label>
              <select {...register('source')} className="select">
                {LEAD_SOURCES.map(s => (
                  <option key={s} value={s}>{leadSourceLabel(s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">UTM Source</label>
              <input {...register('utm_source')} className="input" placeholder="utm_source" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">UTM Medium</label>
              <input {...register('utm_medium')} className="input" placeholder="utm_medium" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">UTM Campaign</label>
              <input {...register('utm_campaign')} className="input" placeholder="utm_campaign" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Referral</label>
              <input {...register('referral_source')} className="input" placeholder="Referral source" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Current Condition</label>
              <input {...register('eye_condition')} className="input" placeholder="e.g. Cataract, Glaucoma" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Treatment Requirement</label>
              <input {...register('treatment')} className="input" placeholder="e.g. IOL Surgery" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Medical Category</label>
              <input {...register('medical_category')} className="input" placeholder="Treatment category" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Diagnosis Summary</label>
              <input {...register('diagnosis')} className="input" placeholder="Diagnosis summary" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Severity</label>
              <select {...register('severity')} className="select">
                {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Estimated Revenue</label>
              <input {...register('estimated_revenue')} type="number" step="0.01" className="input" placeholder="Estimated revenue" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Budget</label>
              <input {...register('budget')} type="number" step="0.01" className="input" placeholder="Budget" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Expected Timeline (days)</label>
              <input {...register('timeline_days')} type="number" className="input" placeholder="Timeline in days" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Hospital</label>
              <input {...register('hospital')} className="input" placeholder="Hospital name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Doctor ID</label>
              <input {...register('doctor_id')} type="number" className="input" placeholder="Doctor ID" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Follow-up Date</label>
              <input type="date" {...register('follow_up_date')} className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Priority</label>
              <select {...register('priority')} className="select">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
              <textarea {...register('notes')} rows={2} className="input resize-none" placeholder="Any additional notes..." />
            </div>
          </div>
          <div className="modal-footer flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isLoading} className="btn-primary">
              {addMutation.isLoading ? 'Adding...' : 'Add Lead'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Modal */}
      {editModal && editLead && (
        <Modal open={!!editModal} onClose={() => { setEditModal(false); setEditLead(null); }} title={`Edit Lead: ${editLead?.patient_name || 'Lead'}`} width="max-w-2xl">
          <form onSubmit={handleEdit((data) => editMutation.mutate({ id: editLead?.id, ...data }))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-surface-700 mb-1">Patient Name *</label>
                <input {...regEdit('patient_name', { required: true })} className="input" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Phone</label>
                <input {...regEdit('phone')} className="input" placeholder="9XXXXXXXXX" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">WhatsApp</label>
                <input {...regEdit('whatsapp')} className="input" placeholder="WhatsApp number" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Email</label>
                <input {...regEdit('email')} type="email" className="input" placeholder="patient@email.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Relationship to Patient</label>
                <input {...regEdit('relationship_to_patient')} className="input" placeholder="Self / Relative / Friend" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Language</label>
                <input {...regEdit('language')} className="input" placeholder="Preferred language" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Nationality</label>
                <input {...regEdit('nationality')} className="input" placeholder="Nationality" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Country</label>
                <input {...regEdit('country')} className="input" placeholder="Country" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">State</label>
                <input {...regEdit('state')} className="input" placeholder="State" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">City / Residence</label>
                <input {...regEdit('city')} className="input" placeholder="City or residence" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Preferred Country</label>
                <input {...regEdit('preferred_country')} className="input" placeholder="Preferred treatment country" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Landing Page</label>
                <input {...regEdit('landing_page')} className="input" placeholder="Landing page URL" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Source</label>
                <select {...regEdit('source')} className="select">
                  {LEAD_SOURCES.map(s => (
                    <option key={s} value={s}>{leadSourceLabel(s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">UTM Source</label>
                <input {...regEdit('utm_source')} className="input" placeholder="utm_source" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">UTM Medium</label>
                <input {...regEdit('utm_medium')} className="input" placeholder="utm_medium" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">UTM Campaign</label>
                <input {...regEdit('utm_campaign')} className="input" placeholder="utm_campaign" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Referral</label>
                <input {...regEdit('referral_source')} className="input" placeholder="Referral source" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Current Condition</label>
                <input {...regEdit('eye_condition')} className="input" placeholder="e.g. Cataract, Glaucoma" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Treatment Requirement</label>
                <input {...regEdit('treatment')} className="input" placeholder="e.g. IOL Surgery" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Medical Category</label>
                <input {...regEdit('medical_category')} className="input" placeholder="Treatment category" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Diagnosis Summary</label>
                <input {...regEdit('diagnosis')} className="input" placeholder="Diagnosis summary" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Severity</label>
                <select {...regEdit('severity')} className="select">
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Estimated Revenue</label>
                <input {...regEdit('estimated_revenue')} type="number" step="0.01" className="input" placeholder="Estimated revenue" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Budget</label>
                <input {...regEdit('budget')} type="number" step="0.01" className="input" placeholder="Budget" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Expected Timeline (days)</label>
                <input {...regEdit('timeline_days')} type="number" className="input" placeholder="Timeline in days" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Hospital</label>
                <input {...regEdit('hospital')} className="input" placeholder="Hospital name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Doctor ID</label>
                <input {...regEdit('doctor_id')} type="number" className="input" placeholder="Doctor ID" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Follow-up Date</label>
                <input type="date" {...regEdit('follow_up_date')} className="input" />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Priority</label>
                <select {...regEdit('priority')} className="select">
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
                <textarea {...regEdit('notes')} rows={2} className="input resize-none" placeholder="Any additional notes..." />
              </div>
            </div>
            <div className="modal-footer flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => { setEditModal(false); setEditLead(null); }} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={editMutation.isLoading} className="btn-primary">
                {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Update Status Modal */}
      {statusModal && (
        <Modal open={!!statusModal} onClose={() => setStatusModal(null)}
          title={`Update: ${statusModal?.patient_name || 'Lead'}`}>
          <form onSubmit={handleStatus((v) => statusMutation.mutate({ id: statusModal.id, ...v }))}
            className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">New Status</label>
              <select
                {...regStatus('status', { required: true })}
                defaultValue={statusModal.status}
                className="select"
                onChange={(e) => setStatusModalStatus(e.target.value)}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Follow-up Date</label>
              <input type="date" {...regStatus('follow_up_date')} defaultValue={statusModal.follow_up_date || ''} className="input" />
            </div>
            {statusModalStatus === 'lost' && (
              <div>
                <label className="block text-xs font-medium text-surface-700 mb-1">Loss Reason *</label>
                <input {...regStatus('loss_reason', { required: true })} className="input" placeholder="Reason for lost lead" />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Notes</label>
              <textarea {...regStatus('notes')} rows={2} className="input resize-none" placeholder="Update notes..." />
            </div>
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setStatusModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={statusMutation.isLoading} className="btn-primary">
                {statusMutation.isLoading ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {convertModal && (
        <Modal open={!!convertModal} onClose={() => setConvertModal(null)}
          title={`Convert to Patient: ${convertModal?.patient_name || 'Lead'}`} width="max-w-4xl">
          <form onSubmit={handleConvert(onConvert)} className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Personal Information Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-100">
              <h3 className="text-sm font-bold text-blue-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-blue-600 rounded"></span>
                Personal Information
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Date of Birth *</label>
                  <input type="date" {...regConvert('date_of_birth')} className="input text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Gender *</label>
                  <select {...regConvert('gender')} className="select text-sm">
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Blood Group</label>
                  <select {...regConvert('blood_group')} className="select text-sm">
                    <option value="">Select blood group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact & Address Section */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-100">
              <h3 className="text-sm font-bold text-emerald-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-emerald-600 rounded"></span>
                Contact & Address
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Address</label>
                  <textarea {...regConvert('address')} rows={2} className="input text-sm resize-none" placeholder="Enter full residential address" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Emergency Contact Name</label>
                    <input {...regConvert('emergency_contact_name')} className="input text-sm" placeholder="Full name" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Emergency Contact Phone</label>
                    <input {...regConvert('emergency_contact_phone')} className="input text-sm" placeholder="Contact number" />
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Information Section */}
            <div className="bg-gradient-to-r from-rose-50 to-red-50 rounded-lg p-4 border border-rose-100">
              <h3 className="text-sm font-bold text-rose-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-rose-600 rounded"></span>
                Medical Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Medical History</label>
                  <textarea {...regConvert('medical_history')} rows={2} className="input text-sm resize-none" placeholder="List any past surgeries, chronic conditions, etc." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Allergies</label>
                    <input {...regConvert('allergies')} className="input text-sm" placeholder="Drug allergies, food allergies, etc." />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Current Medications</label>
                    <input {...regConvert('current_medications')} className="input text-sm" placeholder="List medications currently taking" />
                  </div>
                </div>
              </div>
            </div>

            {/* Travel & Visa Section */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-100">
              <h3 className="text-sm font-bold text-purple-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-purple-600 rounded"></span>
                Travel & Visa Information
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Passport Number</label>
                    <input {...regConvert('passport_no')} className="input text-sm" placeholder="Passport number" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Passport Expiry</label>
                    <input type="date" {...regConvert('passport_expiry')} className="input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Visa Status</label>
                    <select {...regConvert('visa_status')} className="select text-sm">
                      <option value="not_applied">Not Applied</option>
                      <option value="applied">Applied</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                      <option value="extension_needed">Extension Needed</option>
                      <option value="visa_on_arrival">Visa on Arrival</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Visa Number</label>
                    <input {...regConvert('visa_number')} className="input text-sm" placeholder="Visa number" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Visa Expiry</label>
                    <input type="date" {...regConvert('visa_expiry')} className="input text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Arrival Date</label>
                    <input type="date" {...regConvert('arrival_date')} className="input text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Departure Date</label>
                  <input type="date" {...regConvert('departure_date')} className="input text-sm" />
                </div>
              </div>
            </div>

            {/* Accommodation & Transport Section */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-4 border border-amber-100">
              <h3 className="text-sm font-bold text-amber-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-amber-600 rounded"></span>
                Accommodation & Transport
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Accommodation</label>
                  <input {...regConvert('accommodation')} className="input text-sm" placeholder="Hotel name / Hospital accommodation" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Transport</label>
                  <input {...regConvert('transport')} className="input text-sm" placeholder="Transportation arrangements (flight, taxi, etc.)" />
                </div>
              </div>
            </div>

            {/* Payment & Status Section */}
            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-lg p-4 border border-cyan-100">
              <h3 className="text-sm font-bold text-cyan-900 mb-4 flex items-center gap-2">
                <span className="inline-block w-1 h-5 bg-cyan-600 rounded"></span>
                Payment & Visit Status
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Package Value</label>
                    <input {...regConvert('package_value')} type="number" step="0.01" className="input text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Payment Amount</label>
                    <input {...regConvert('payment_amount')} type="number" step="0.01" className="input text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-surface-700 mb-2">Payment Status</label>
                    <select {...regConvert('payment_status')} className="select text-sm">
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Completion Status</label>
                  <select {...regConvert('completion_status')} className="select text-sm">
                    <option value="confirmation">Confirmation</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="docs_complete">Docs Complete</option>
                    <option value="travel_planning">Travel Planning</option>
                    <option value="appointment">Appointment</option>
                    <option value="treatment">Treatment</option>
                    <option value="recovery">Recovery</option>
                    <option value="completed">Completed</option>
                    <option value="on_hold">On Hold</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-surface-700 mb-2">Feedback</label>
                  <textarea {...regConvert('feedback')} rows={2} className="input text-sm resize-none" placeholder="Patient feedback and comments" />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-surface-100 -mx-6 px-6 py-4 -mb-4 sticky bottom-0 bg-white">
              <button type="button" onClick={() => setConvertModal(null)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={convertMutation.isLoading} className="btn-primary">
                {convertMutation.isLoading ? 'Converting...' : 'Convert to Patient'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detailLeadId && (
        <Modal open={!!detailLeadId} onClose={() => setDetailLeadId(null)}
          title={`Lead Details: ${leadDetailData?.patient_name || ''}`} width="max-w-3xl">
          {leadDetailLoading ? (
            <div className="py-12"><PageLoader /></div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Contact</p>
                  <p className="text-sm font-semibold">{leadDetailData?.patient_name || '—'}</p>
                  <p className="text-xs text-surface-600">Phone: {leadDetailData?.phone || '—'}</p>
                  <p className="text-xs text-surface-600">WhatsApp: {leadDetailData?.whatsapp || '—'}</p>
                  <p className="text-xs text-surface-600">Email: {leadDetailData?.email || '—'}</p>
                </div>
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Lead Info</p>
                  <p className="text-xs text-surface-600">Source: {leadSourceLabel(leadDetailData?.source)}</p>
                  <p className="text-xs text-surface-600">Priority: {leadDetailData?.priority || '—'}</p>
                  <p className="text-xs text-surface-600">Status: {leadDetailData?.status?.replace('_', ' ') || '—'}</p>
                  <p className="text-xs text-surface-600">Follow-up: {leadDetailData?.follow_up_date ? fmtDate(leadDetailData.follow_up_date) : '—'}</p>
                </div>
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Location</p>
                  <p className="text-xs text-surface-600">Country: {leadDetailData?.country || '—'}</p>
                  <p className="text-xs text-surface-600">State: {leadDetailData?.state || '—'}</p>
                  <p className="text-xs text-surface-600">City: {leadDetailData?.city || '—'}</p>
                  <p className="text-xs text-surface-600">Preferred Country: {leadDetailData?.preferred_country || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Patient Context</p>
                  <p className="text-xs text-surface-600">Relationship: {leadDetailData?.relationship_to_patient || '—'}</p>
                  <p className="text-xs text-surface-600">Language: {leadDetailData?.language || '—'}</p>
                  <p className="text-xs text-surface-600">Nationality: {leadDetailData?.nationality || '—'}</p>
                  <p className="text-xs text-surface-600">Landing Page: {leadDetailData?.landing_page || '—'}</p>
                </div>
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Medical Details</p>
                  <p className="text-xs text-surface-600">Condition: {leadDetailData?.eye_condition || '—'}</p>
                  <p className="text-xs text-surface-600">Treatment: {leadDetailData?.treatment || '—'}</p>
                  <p className="text-xs text-surface-600">Category: {leadDetailData?.medical_category || '—'}</p>
                  <p className="text-xs text-surface-600">Severity: {leadDetailData?.severity || '—'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Financial & Timeline</p>
                  <p className="text-xs text-surface-600">Estimated Revenue: {leadDetailData?.estimated_revenue ?? '—'}</p>
                  <p className="text-xs text-surface-600">Budget: {leadDetailData?.budget ?? '—'}</p>
                  <p className="text-xs text-surface-600">Timeline: {leadDetailData?.timeline_days ? `${leadDetailData.timeline_days} days` : '—'}</p>
                </div>
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Assigned</p>
                  <p className="text-xs text-surface-600">Hospital: {leadDetailData?.hospital || '—'}</p>
                  <p className="text-xs text-surface-600">Doctor: {leadDetailData?.doctor_name || '—'}</p>
                  <p className="text-xs text-surface-600">Assigned To: {leadDetailData?.assigned_to_name || '—'}</p>
                  <p className="text-xs text-surface-600">Created: {leadDetailData?.created_at ? fmtDate(leadDetailData.created_at) : '—'}</p>
                </div>
              </div>

              <div className="card p-4 bg-surface-50">
                <p className="text-xs text-surface-500 uppercase mb-2">Notes</p>
                <p className="text-sm text-surface-700 whitespace-pre-line">{leadDetailData?.notes || 'No notes added.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Stage History</p>
                  {leadDetailData?.stage_history?.length ? (
                    <ul className="space-y-2 text-xs text-surface-700">
                      {leadDetailData.stage_history.map((change) => (
                        <li key={change.id} className="border-b border-surface-200 pb-2">
                          <p className="font-medium">{change.from_stage ? `${change.from_stage.replace(/_/g, ' ')} → ${change.to_stage.replace(/_/g, ' ')}` : change.to_stage.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-surface-500">Updated by {change.employee_name} • {fmtDate(change.changed_at)}</p>
                          <p className="text-surface-600 mt-1">{change.change_reason || 'No reason provided.'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-surface-500">No stage history available.</p>
                  )}
                </div>

                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Activities</p>
                  {leadDetailData?.activities?.length ? (
                    <ul className="space-y-2 text-xs text-surface-700">
                      {leadDetailData.activities.map((activity) => (
                        <li key={activity.id} className="border-b border-surface-200 pb-2">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium">{activity.action.replace(/_/g, ' ')}</p>
                            <div className="text-xs text-surface-500">{activity.channel ? activity.channel.toUpperCase() : 'NOTE'}</div>
                          </div>
                          <p>{activity.notes || 'No details.'}</p>
                          {activity.tags && <p className="text-xs text-surface-500">Tags: {activity.tags}</p>}
                          <p className="text-surface-500">{activity.employee_name} • {fmtDate(activity.created_at)}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-surface-500">No lead activities yet.</p>
                  )}
                  <div className="mt-4 border-t border-surface-200 pt-4">
                    <p className="text-xs text-surface-500 uppercase mb-2">Add Conversation Note</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-surface-700 mb-1">Channel</label>
                        <select value={activityChannel} onChange={(e) => setActivityChannel(e.target.value)} className="select w-full">
                          {ACTIVITY_CHANNELS.map((channel) => (
                            <option key={channel} value={channel}>{channel.charAt(0).toUpperCase() + channel.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-surface-700 mb-1">Tags</label>
                        <input value={activityTags} onChange={(e) => setActivityTags(e.target.value)} className="input w-full" placeholder="e.g. follow-up, quotation, docs" />
                      </div>
                    </div>
                    <textarea
                      value={activityNote}
                      onChange={(e) => setActivityNote(e.target.value)}
                      rows={3}
                      className="input w-full resize-none"
                      placeholder="Add a call/email/meeting note to capture the next steps..."
                    />
                    <div className="flex justify-end gap-3 pt-3">
                      <button type="button" onClick={submitActivity} disabled={activityMutation.isLoading} className="btn-primary">
                        {activityMutation.isLoading ? 'Saving...' : 'Log Activity'}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="card p-4 bg-surface-50">
                  <p className="text-xs text-surface-500 uppercase mb-2">Tasks</p>
                  {leadTasksData?.data?.length ? (
                    <ul className="space-y-2 text-xs text-surface-700">
                      {leadTasksData.data.map((task) => (
                        <li key={task.id} className="border-b border-surface-200 pb-2">
                          <p className="font-medium">{task.title}</p>
                          <p>{task.status} • {task.priority}</p>
                          <p className="text-surface-500">Due: {task.due_date ? fmtDate(task.due_date) : 'No due date'}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-surface-500">No tasks attached to this lead.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
