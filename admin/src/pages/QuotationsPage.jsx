import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { quotationsAPI } from '../api';
import { PageLoader, Badge, EmptyState, Pagination, Modal } from '../components/common';
import { fmtDate, fmtCurrency, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['draft','sent','awaiting_response','received','follow_up','accepted','rejected','closed'];

export default function QuotationsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [leadFilter, setLeadFilter] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();
  const { register: regStatus, handleSubmit: handleStatus } = useForm();

  const { data, isLoading } = useQuery(
    ['quotations', page, statusFilter, leadFilter],
    () => quotationsAPI.list({
      page,
      limit: 20,
      status: statusFilter || undefined,
      lead_id: leadFilter || undefined
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const addMutation = useMutation(
    (data) => quotationsAPI.add(data),
    {
      onSuccess: () => {
        toast.success('Quotation added');
        qc.invalidateQueries('quotations');
        setAddModal(false); reset();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const sendMutation = useMutation(
    (id) => quotationsAPI.send(id, {}),
    {
      onSuccess: () => {
        toast.success('Quotation sent');
        qc.invalidateQueries('quotations');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const statusMutation = useMutation(
    ({ id, ...vals }) => quotationsAPI.updateStatus(id, vals),
    {
      onSuccess: () => {
        toast.success('Quotation status updated');
        qc.invalidateQueries('quotations');
        setStatusModal(null);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Quotation Management</h1>
        <button
          onClick={() => setAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Quotation
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map(status => (
              <option key={status} value={status}>{status.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Lead ID</label>
          <input
            type="number"
            placeholder="Filter by Lead ID"
            value={leadFilter}
            onChange={(e) => setLeadFilter(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="table-container">
          <table className="table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3 text-left">Hospital</th>
              <th className="px-4 py-3 text-left">Doctor</th>
              <th className="px-4 py-3 text-left">Treatment</th>
              <th className="px-4 py-3 text-left">Total Cost</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Valid Until</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map(quotation => (
              <tr key={quotation.id} className="border-t">
                <td className="px-4 py-3">{quotation.patient_name}</td>
                <td className="px-4 py-3">{quotation.hospital_name || 'N/A'}</td>
                <td className="px-4 py-3">{quotation.doctor_name || 'N/A'}</td>
                <td className="px-4 py-3">{quotation.treatment_name || 'N/A'}</td>
                <td className="px-4 py-3 font-medium">
                  {fmtCurrency(quotation.total_cost, quotation.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={
                    quotation.status === 'accepted' ? 'success' :
                    quotation.status === 'rejected' ? 'danger' :
                    quotation.status === 'sent' ? 'info' :
                    quotation.status === 'awaiting_response' ? 'warning' :
                    quotation.status === 'follow_up' ? 'primary' :
                    quotation.status === 'received' ? 'secondary' : 'default'
                  }>
                    {quotation.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {quotation.valid_until ? fmtDate(quotation.valid_until) : 'N/A'}
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button
                    onClick={() => setDetailModal(quotation)}
                    className="text-purple-600 hover:text-purple-800 text-sm"
                  >
                    View Details
                  </button>
                  {quotation.status === 'draft' && (
                    <button
                      onClick={() => sendMutation.mutate(quotation.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Send
                    </button>
                  )}
                  <button
                    onClick={() => setStatusModal(quotation)}
                    className="text-green-600 hover:text-green-800 text-sm"
                  >
                    Update Status
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {data?.meta && <Pagination page={data.meta.page} total={data.meta.total} limit={data.meta.limit} onChange={setPage} />}

      {/* Add Quotation Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Quotation" width="max-w-md">
        <form onSubmit={handleSubmit(addMutation.mutate)} className="grid gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Lead ID</label>
              <input {...register('lead_id', { required: true })} type="number" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hospital ID (Optional)</label>
              <input {...register('hospital_id')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Doctor ID (Optional)</label>
              <input {...register('doctor_id')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Treatment Category ID (Optional)</label>
              <input {...register('treatment_category_id')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Quotation Date</label>
              <input {...register('quotation_date', { required: true })} type="date" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Currency</label>
              <select {...register('currency')} className="w-full border rounded px-3 py-2">
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Base Cost</label>
              <input {...register('base_cost')} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Accommodation Cost</label>
              <input {...register('accommodation_cost')} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Transport Cost</label>
              <input {...register('transport_cost')} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Visa Support Cost</label>
              <input {...register('visa_support_cost')} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Miscellaneous Cost</label>
            <input {...register('miscellaneous_cost')} type="number" step="0.01" className="w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Add Quotation
          </button>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Quotation Status">
        <form onSubmit={handleStatus((data) => statusMutation.mutate({ id: statusModal.id, ...data }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select {...regStatus('status', { required: true })} className="w-full border rounded px-3 py-2">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Response Date</label>
            <input {...regStatus('response_date')} type="date" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Response Notes</label>
            <textarea {...regStatus('response_notes')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Update Status
          </button>
        </form>
      </Modal>

      {/* Quotation Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Quotation Details" width="max-w-4xl">
        {detailModal && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded">
              <div>
                <h3 className="font-semibold text-lg">{detailModal.patient_name}</h3>
                <p className="text-sm text-gray-600">Lead ID: {detailModal.lead_id}</p>
                <p className="text-sm text-gray-600">Created: {fmtDate(detailModal.created_at)}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  {fmtCurrency(detailModal.total_cost, detailModal.currency)}
                </div>
                <Badge variant={
                  detailModal.status === 'accepted' ? 'success' :
                  detailModal.status === 'rejected' ? 'danger' :
                  detailModal.status === 'sent' ? 'info' : 'secondary'
                } className="mt-1">
                  {detailModal.status.replace('_', ' ')}
                </Badge>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <h4 className="font-semibold mb-3">Cost Breakdown</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Base Cost:</span>
                    <span>{fmtCurrency(detailModal.base_cost || 0, detailModal.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Accommodation:</span>
                    <span>{fmtCurrency(detailModal.accommodation_cost || 0, detailModal.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transport:</span>
                    <span>{fmtCurrency(detailModal.transport_cost || 0, detailModal.currency)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Visa Support:</span>
                    <span>{fmtCurrency(detailModal.visa_support_cost || 0, detailModal.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Miscellaneous:</span>
                    <span>{fmtCurrency(detailModal.miscellaneous_cost || 0, detailModal.currency)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Total:</span>
                    <span>{fmtCurrency(detailModal.total_cost, detailModal.currency)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Quotation Information</h4>
                <div className="space-y-2">
                  <div><strong>Quotation Date:</strong> {fmtDate(detailModal.quotation_date)}</div>
                  <div><strong>Valid Until:</strong> {detailModal.valid_until ? fmtDate(detailModal.valid_until) : 'N/A'}</div>
                  <div><strong>Currency:</strong> {detailModal.currency}</div>
                  <div><strong>Hospital:</strong> {detailModal.hospital_name || 'N/A'}</div>
                  <div><strong>Doctor:</strong> {detailModal.doctor_name || 'N/A'}</div>
                  <div><strong>Treatment:</strong> {detailModal.treatment_name || 'N/A'}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Status & Response</h4>
                <div className="space-y-2">
                  <div><strong>Current Status:</strong> {detailModal.status.replace('_', ' ')}</div>
                  {detailModal.response_date && (
                    <div><strong>Response Date:</strong> {fmtDate(detailModal.response_date)}</div>
                  )}
                  {detailModal.response_notes && (
                    <div>
                      <strong>Response Notes:</strong>
                      <p className="mt-1 text-sm text-gray-600">{detailModal.response_notes}</p>
                    </div>
                  )}
                  {detailModal.email_sent && (
                    <div><strong>Email Sent:</strong> {fmtDate(detailModal.email_sent_at)}</div>
                  )}
                  <div><strong>Created By:</strong> {detailModal.created_by_name}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}