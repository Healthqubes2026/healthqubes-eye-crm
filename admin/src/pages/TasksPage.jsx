import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { tasksAPI } from '../api';
import { PageLoader, Badge, EmptyState, Pagination, Modal } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = ['pending', 'in_progress', 'completed', 'cancelled'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];

export default function TasksPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [statusModal, setStatusModal] = useState(null);
  const [detailModal, setDetailModal] = useState(null);
  const { register, handleSubmit, reset } = useForm();
  const { register: regStatus, handleSubmit: handleStatus } = useForm();

  const { data, isLoading } = useQuery(
    ['tasks', page, statusFilter],
    () => tasksAPI.list({ page, limit: 20, status: statusFilter || undefined }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: overdueData } = useQuery('tasks-overdue', () => tasksAPI.getOverdue().then(r => r.data));

  const addMutation = useMutation(
    (data) => tasksAPI.add(data),
    {
      onSuccess: () => {
        toast.success('Task added');
        qc.invalidateQueries('tasks');
        setAddModal(false); reset();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const statusMutation = useMutation(
    ({ id, ...vals }) => tasksAPI.updateStatus(id, vals),
    {
      onSuccess: () => {
        toast.success('Task status updated');
        qc.invalidateQueries('tasks');
        qc.invalidateQueries('tasks-overdue');
        setStatusModal(null);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Task Management</h1>
        <button
          onClick={() => setAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      {/* Overdue Tasks Alert */}
      {overdueData?.data?.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-6">
          <h3 className="text-red-800 font-medium">Overdue Tasks ({overdueData.data.length})</h3>
          <div className="mt-2 space-y-1">
            {overdueData.data.slice(0, 3).map(task => (
              <div key={task.id} className="text-sm text-red-700">
                {task.title} - {task.patient_name} ({task.days_overdue} days overdue)
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6">
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

      {/* Tasks Table */}
      <div className="bg-white rounded shadow overflow-hidden">
        <div className="table-container">
          <table className="table">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Task</th>
              <th className="px-4 py-3 text-left">Lead</th>
              <th className="px-4 py-3 text-left">Assigned To</th>
              <th className="px-4 py-3 text-left">Priority</th>
              <th className="px-4 py-3 text-left">Due Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data?.data?.map(task => (
              <tr key={task.id} className="border-t">
                <td className="px-4 py-3">
                  <div>
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-gray-600 truncate max-w-xs">
                        {task.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">{task.patient_name}</td>
                <td className="px-4 py-3">{task.assigned_to_name}</td>
                <td className="px-4 py-3">
                  <Badge variant={
                    task.priority === 'urgent' ? 'danger' :
                    task.priority === 'high' ? 'warning' : 'info'
                  }>
                    {task.priority}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {task.due_date ? fmtDate(task.due_date) : 'No due date'}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={
                    task.status === 'completed' ? 'success' :
                    task.status === 'in_progress' ? 'info' :
                    task.status === 'cancelled' ? 'danger' : 'secondary'
                  }>
                    {task.status.replace('_', ' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setDetailModal(task)}
                    className="text-purple-600 hover:text-purple-800 text-sm mr-2"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => setStatusModal(task)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
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

      {/* Add Task Modal */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Task">
        <form onSubmit={handleSubmit(addMutation.mutate)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Lead ID</label>
            <input {...register('lead_id', { required: true })} type="number" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input {...register('title', { required: true })} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea {...register('description')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Assigned To (Employee ID)</label>
            <input {...register('assigned_to', { required: true })} type="number" className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Priority</label>
            <select {...register('priority')} className="w-full border rounded px-3 py-2">
              {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <input {...register('due_date')} type="date" className="w-full border rounded px-3 py-2" />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Add Task
          </button>
        </form>
      </Modal>

      {/* Update Status Modal */}
      <Modal open={!!statusModal} onClose={() => setStatusModal(null)} title="Update Task Status">
        <form onSubmit={handleStatus((data) => statusMutation.mutate({ id: statusModal.id, ...data }))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select {...regStatus('status', { required: true })} className="w-full border rounded px-3 py-2">
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea {...regStatus('notes')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Update Status
          </button>
        </form>
      </Modal>

      {/* Task Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Task Details" width="max-w-2xl">
        {detailModal && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="p-4 bg-gray-50 rounded">
              <h3 className="text-xl font-bold mb-2">{detailModal.title}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Lead</p>
                  <p className="font-medium">{detailModal.patient_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Lead ID</p>
                  <p className="font-medium">#{detailModal.lead_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Priority</p>
                  <Badge variant={
                    detailModal.priority === 'urgent' ? 'danger' :
                    detailModal.priority === 'high' ? 'warning' : 'info'
                  }>
                    {detailModal.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <Badge variant={
                    detailModal.status === 'completed' ? 'success' :
                    detailModal.status === 'in_progress' ? 'info' :
                    detailModal.status === 'cancelled' ? 'danger' : 'secondary'
                  }>
                    {detailModal.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Description */}
            {detailModal.description && (
              <div>
                <h4 className="font-semibold mb-2">Description</h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded text-sm leading-relaxed">
                  {detailModal.description}
                </p>
              </div>
            )}

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Assignment</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Assigned To:</strong> {detailModal.assigned_to_name}</div>
                  <div><strong>Created By:</strong> {detailModal.created_by_name}</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Created:</strong> {fmtDate(detailModal.created_at)}</div>
                  <div><strong>Due Date:</strong> {detailModal.due_date ? fmtDate(detailModal.due_date) : 'No due date'}</div>
                  {detailModal.completed_at && (
                    <div><strong>Completed:</strong> {fmtDate(detailModal.completed_at)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}