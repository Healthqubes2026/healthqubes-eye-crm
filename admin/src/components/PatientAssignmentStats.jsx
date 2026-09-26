/**
 * Dashboard Patient Assignment Stats Component
 * Add this to DashboardPage.jsx to show patient management metrics
 */

import React from 'react';
import { useQuery } from 'react-query';
import { Link } from 'react-router-dom';
import { patientsAPI } from '../api';
import { TrendingUp, Users, Building2, Stethoscope, FileText, AlertCircle } from 'lucide-react';

export function PatientAssignmentStats() {
  const { data: patientsStats, isLoading } = useQuery(
    'patient-stats',
    () => patientsAPI.list({ limit: 1000 }).then(r => {
      const patients = r.data.data || [];
      return {
        total: patients.length,
        withHospital: patients.filter(p => p.assigned_hospital_id).length,
        withDoctor: patients.filter(p => p.assigned_doctor_id).length,
        withDocuments: patients.filter(p => p.documents_count > 0).length,
        pendingAssignment: patients.filter(p => !p.assigned_hospital_id || !p.assigned_doctor_id).length,
        completed: patients.filter(p => p.completion_status === 'completed').length,
      };
    }),
    { staleTime: 60000 }
  );

  if (isLoading || !patientsStats) {
    return <div className="h-32 bg-surface-100 rounded-lg animate-pulse" />;
  }

  const stats = patientsStats;
  const assignmentPercentage = stats.total > 0 
    ? Math.round(((stats.withHospital + stats.withDoctor) / (stats.total * 2)) * 100)
    : 0;

  return (
    <div className="bg-white rounded-lg border border-surface-200 p-6 shadow-sm">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-surface-900">Patient Assignment Pipeline</h3>
          <p className="text-sm text-surface-600 mt-1">Medical tourism patient tracking</p>
        </div>
        <Link 
          to="/patients"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {/* Total Patients */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-blue-600" size={18} />
            <p className="text-xs font-semibold text-blue-700 uppercase">Total Patients</p>
          </div>
          <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
        </div>

        {/* Hospital Assigned */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="text-green-600" size={18} />
            <p className="text-xs font-semibold text-green-700 uppercase">Hospital</p>
          </div>
          <p className="text-2xl font-bold text-green-900">{stats.withHospital}</p>
          <p className="text-xs text-green-700 mt-1">
            {stats.total > 0 ? Math.round((stats.withHospital / stats.total) * 100) : 0}%
          </p>
        </div>

        {/* Doctor Assigned */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="text-purple-600" size={18} />
            <p className="text-xs font-semibold text-purple-700 uppercase">Doctor</p>
          </div>
          <p className="text-2xl font-bold text-purple-900">{stats.withDoctor}</p>
          <p className="text-xs text-purple-700 mt-1">
            {stats.total > 0 ? Math.round((stats.withDoctor / stats.total) * 100) : 0}%
          </p>
        </div>

        {/* Documents */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="text-orange-600" size={18} />
            <p className="text-xs font-semibold text-orange-700 uppercase">Documents</p>
          </div>
          <p className="text-2xl font-bold text-orange-900">{stats.withDocuments}</p>
          <p className="text-xs text-orange-700 mt-1">
            {stats.total > 0 ? Math.round((stats.withDocuments / stats.total) * 100) : 0}%
          </p>
        </div>

        {/* Completed */}
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-emerald-600" size={18} />
            <p className="text-xs font-semibold text-emerald-700 uppercase">Completed</p>
          </div>
          <p className="text-2xl font-bold text-emerald-900">{stats.completed}</p>
          <p className="text-xs text-emerald-700 mt-1">
            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
          </p>
        </div>

        {/* Pending */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-600" size={18} />
            <p className="text-xs font-semibold text-red-700 uppercase">Pending</p>
          </div>
          <p className="text-2xl font-bold text-red-900">{stats.pendingAssignment}</p>
          <p className="text-xs text-red-700 mt-1">
            {stats.total > 0 ? Math.round((stats.pendingAssignment / stats.total) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* Overall Progress */}
      <div className="bg-surface-50 rounded-lg p-4 border border-surface-200">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-semibold text-surface-900">Assignment Completion Rate</p>
          <p className="text-sm font-bold text-blue-600">{assignmentPercentage}%</p>
        </div>
        <div className="w-full h-2 bg-surface-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
            style={{ width: `${assignmentPercentage}%` }}
          />
        </div>
        <p className="text-xs text-surface-600 mt-2">
          {stats.total > 0 
            ? `${stats.withHospital + stats.withDoctor} assignments out of ${stats.total * 2} required`
            : 'No patients yet'}
        </p>
      </div>
    </div>
  );
}

export default PatientAssignmentStats;
