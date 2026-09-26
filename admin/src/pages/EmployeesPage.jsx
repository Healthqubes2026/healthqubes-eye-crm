// EmployeesPage.jsx
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { employeesAPI } from '../api';
import { StatCard, PageLoader, Badge, EmptyState, Modal, Avatar } from '../components/common';
import { fmtDateTime, formatEmployeeId, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

export function EmployeesPage() {
  const qc = useQueryClient();
  const [addModal, setAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active');
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading } = useQuery(
    ['employees', statusFilter],
    () => employeesAPI.list({
      limit: 100,
      ...(statusFilter !== 'all' ? { is_active: statusFilter === 'active' ? 1 : 0 } : {}),
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const addMutation = useMutation(
    (vals) => employeesAPI.add(vals),
    {
      onSuccess: () => {
        toast.success('Employee created');
        qc.invalidateQueries(['employees', statusFilter]);
        setAddModal(false); reset();
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const updateMutation = useMutation(
    ({ id, values }) => employeesAPI.update(id, values),
    {
      onSuccess: () => {
        toast.success('Employee updated');
        qc.invalidateQueries(['employees', statusFilter]);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const employees = data?.data || [];
  const roles     = { admin: 0, manager: 0, field_agent: 0 };
  employees.forEach(e => { if (roles[e.role] !== undefined) roles[e.role]++; });

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="text-sm text-surface-500 mt-0.5">Manage your field force</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary">+ Add Employee</button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm text-surface-600">
          <span>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select w-40"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Employees" value={employees.length}    icon={<span>👥</span>} iconBg="bg-brand-50" />
        <StatCard label="Managers"        value={roles.manager}       icon={<span>👔</span>} iconBg="bg-purple-50" />
        <StatCard label="Field Agents"    value={roles.field_agent}   icon={<span>🚶</span>} iconBg="bg-emerald-50" />
      </div>

      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead><tr>
              <th>ID</th><th>Employee</th><th>Role</th><th>Zone</th>
              <th>Manager</th><th>Last Login</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="py-12"><PageLoader /></td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={8}><EmptyState icon="👤" title="No employees" description="Add your first employee" /></td></tr>
              ) : employees.map((e) => (
                <tr key={e.id}>
                  <td className="text-xs text-surface-600">{formatEmployeeId(e.id)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={e.name} size="sm" photo={e.profile_photo} />
                      <div>
                        <p className="font-medium text-sm">{e.name}</p>
                        <p className="text-xs text-surface-500">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant={e.role === 'admin' ? 'red' : e.role === 'manager' ? 'blue' : 'gray'}>
                      {e.role.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="text-xs text-surface-600">{e.zone || '—'}</td>
                  <td className="text-xs text-surface-600">{e.manager_name || '—'}</td>
                  <td className="text-xs text-surface-500">{e.last_login ? fmtDateTime(e.last_login) : 'Never'}</td>
                  <td>
                    <Badge variant={e.is_active ? 'green' : 'red'}>{e.is_active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="space-x-2">
                    <button
                      type="button"
                      className="btn-secondary btn-xs"
                      onClick={() => updateMutation.mutate({ id: e.id, values: { is_active: e.is_active ? 0 : 1 } })}
                    >
                      {e.is_active ? 'Resign' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Employee">
        <form onSubmit={handleSubmit((v) => addMutation.mutate(v))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-surface-700 mb-1">Full Name *</label>
              <input {...register('name', { required: true })} className="input" placeholder="Full name" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Email *</label>
              <input {...register('email', { required: true })} type="email" className="input" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Phone *</label>
              <input {...register('phone', { required: true })} className="input" placeholder="9XXXXXXXXX" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Password *</label>
              <input {...register('password', { required: true, minLength: 8 })} type="password" className="input" placeholder="Min 8 chars" />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Role</label>
              <select {...register('role')} className="select">
                <option value="field_agent">Field Agent</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-700 mb-1">Zone</label>
              <input {...register('zone')} className="input" placeholder="e.g. South Bengaluru" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={() => setAddModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={addMutation.isLoading} className="btn-primary">
              {addMutation.isLoading ? 'Creating...' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
