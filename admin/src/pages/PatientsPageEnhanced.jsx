import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { patientsAPI, leadsAPI, emailsAPI, employeesAPI, hospitalsAPI, meetingsAPI } from '../api';
import { PageLoader, Badge, EmptyState, Modal, Tabs } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';
import toast from 'react-hot-toast';

/**
 * Enhanced Patient Management Page with organized UI
 * Features:
 * - Step-by-step patient assignment workflow
 * - Document collection and management
 * - Hospital and doctor assignment with email notifications
 * - Patient details overview
 */

export default function PatientsPageEnhanced() {
  const qc = useQueryClient();
  
  // Pagination & filtering
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected patient and workflow state
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [workflowStep, setWorkflowStep] = useState('overview'); // overview, documents, hospital, doctor, email
  
  // Document management
  const [documents, setDocuments] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  
  // Assignment workflow
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  
  // Email to hospital
  const [hospitalEmail, setHospitalEmail] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Queries
  const { data: patientsData, isLoading: patientsLoading } = useQuery(
    ['patients', page, statusFilter, searchQuery],
    () => patientsAPI.list({ 
      page, 
      limit: 20, 
      completion_status: statusFilter || undefined,
      search: searchQuery || undefined 
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: patientDetailData, isLoading: patientDetailLoading } = useQuery(
    ['patient-detail', selectedPatient?.id],
    () => patientsAPI.get(selectedPatient.id).then(r => r.data),
    { enabled: !!selectedPatient }
  );

  const { data: hospitalsData } = useQuery('hospitals', 
    () => hospitalsAPI.list({ limit: 500 }).then(r => r.data)
  );

  const { data: doctorsData } = useQuery('doctors',
    () => meetingsAPI.listDoctors({ limit: 500 }).then(r => r.data)
  );

  // Mutations
  const assignHospitalMutation = useMutation(
    (data) => patientsAPI.assignHospital(selectedPatient.id, data),
    {
      onSuccess: () => {
        toast.success('Hospital assigned successfully');
        qc.invalidateQueries(['patient-detail', selectedPatient.id]);
        setWorkflowStep('doctor');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const assignDoctorMutation = useMutation(
    (data) => patientsAPI.assignDoctor(selectedPatient.id, data),
    {
      onSuccess: () => {
        toast.success('Doctor assigned successfully');
        qc.invalidateQueries(['patient-detail', selectedPatient.id]);
        setWorkflowStep('email');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const uploadDocMutation = useMutation(
    (formData) => patientsAPI.uploadDoc(selectedPatient.id, formData),
    {
      onSuccess: (res) => {
        toast.success('Document uploaded successfully');
        setDocuments([...documents, res.data.document]);
        qc.invalidateQueries(['patient-detail', selectedPatient.id]);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const sendEmailToHospitalMutation = useMutation(
    (data) => emailsAPI.sendToHospital(data),
    {
      onSuccess: () => {
        toast.success('Patient details sent to hospital');
        setSendingEmail(false);
        setSelectedPatient(null);
        setWorkflowStep('overview');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const currentPatient = patientDetailData?.data || selectedPatient;

  if (patientsLoading && !patientsData) return <PageLoader />;

  const handleAssignHospital = () => {
    if (!selectedHospital) {
      toast.error('Please select a hospital');
      return;
    }
    assignHospitalMutation.mutate({
      hospital_id: selectedHospital.id,
      notes: assignmentNotes,
    });
  };

  const handleAssignDoctor = () => {
    if (!selectedDoctor) {
      toast.error('Please select a doctor');
      return;
    }
    assignDoctorMutation.mutate({
      doctor_id: selectedDoctor.id,
      notes: assignmentNotes,
    });
  };

  const handleSendToHospital = async () => {
    if (!hospitalEmail || !documents.length) {
      toast.error('Please add email and at least one document');
      return;
    }
    setSendingEmail(true);
    sendEmailToHospitalMutation.mutate({
      patient_id: selectedPatient.id,
      hospital_email: hospitalEmail,
      message: emailMessage,
      attachment_ids: documents.map(d => d.id),
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('document', file);
    formData.append('document_type', 'other');
    uploadDocMutation.mutate(formData);
  };

  const getCompletionPercentage = () => {
    let percent = 0;
    if (currentPatient?.assigned_hospital_id) percent += 25;
    if (currentPatient?.assigned_doctor_id) percent += 25;
    if (documents.length > 0) percent += 25;
    if (currentPatient?.completion_status === 'completed') percent += 25;
    return percent;
  };

  // ─────────────────────────────────────────────────────────────
  // Patient List View
  // ─────────────────────────────────────────────────────────────

  if (!selectedPatient) {
    return (
      <div className="p-6 bg-gradient-to-br from-surface-50 to-surface-100 rounded-lg">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-xl font-bold text-surface-900">Patient Management</h1>
              <p className="text-sm text-surface-600 mt-1">Medical tourism patient tracking and assignment</p>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex gap-3 mb-4">
            <input
              type="text"
              placeholder="Search by name, phone, condition..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input w-48"
            >
              <option value="">All Status</option>
              <option value="confirmation">Confirmation</option>
              <option value="onboarding">Onboarding</option>
              <option value="docs_complete">Docs Complete</option>
              <option value="travel_planning">Travel Planning</option>
              <option value="appointment">Appointment</option>
              <option value="treatment">Treatment</option>
              <option value="recovery">Recovery</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Patients Table */}
        {!patientsData?.data || patientsData.data.length === 0 ? (
          <EmptyState title="No patients found" description="Create your first patient to get started" />
        ) : (
          <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-surface-50 border-b border-surface-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Patient</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Condition</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Hospital</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Doctor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-surface-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {patientsData.data.map((patient) => (
                  <tr key={patient.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-sm text-surface-900">{patient.patient_name}</p>
                        <p className="text-xs text-surface-500">{patient.phone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600">{patient.eye_condition || '—'}</td>
                    <td className="px-4 py-3">
                      {patient.hospital ? (
                        <Badge variant="success" size="sm">{patient.hospital}</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Not assigned</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {patient.doctor_name ? (
                        <Badge variant="success" size="sm">{patient.doctor_name}</Badge>
                      ) : (
                        <Badge variant="neutral" size="sm">Not assigned</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge 
                        variant={patient.completion_status === 'completed' ? 'success' : 'warning'}
                        size="sm"
                      >
                        {patient.completion_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-24">
                        <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                            style={{ width: `${patient.progress || 0}%` }}
                          />
                        </div>
                        <p className="text-xs text-surface-600 mt-1">{patient.progress || 0}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedPatient(patient);
                          setWorkflowStep('overview');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Patient Detail View with Workflow
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="p-6">
      <button
        onClick={() => {
          setSelectedPatient(null);
          setWorkflowStep('overview');
          setDocuments([]);
          setSelectedHospital(null);
          setSelectedDoctor(null);
        }}
        className="mb-6 text-blue-600 hover:text-blue-800 flex items-center gap-2"
      >
        ← Back to Patients
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Patient Overview & Progress */}
        <div className="col-span-1 space-y-4">
          {/* Patient Card */}
          <div className="bg-white rounded-lg border border-surface-200 p-6 shadow-sm">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {currentPatient?.patient_name?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="font-bold text-lg text-surface-900">{currentPatient?.patient_name}</h2>
                <p className="text-sm text-surface-600">{currentPatient?.phone}</p>
              </div>
            </div>

            <div className="space-y-2 py-4 border-y border-surface-200">
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Email:</span>
                <span className="text-surface-900 font-medium">{currentPatient?.email || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Condition:</span>
                <span className="text-surface-900 font-medium">{currentPatient?.eye_condition || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Treatment:</span>
                <span className="text-surface-900 font-medium">{currentPatient?.treatment || '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-surface-600">Status:</span>
                <Badge variant="warning" size="sm">{currentPatient?.completion_status}</Badge>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-xs font-semibold text-surface-700">Completion Progress</p>
                <p className="text-xs font-bold text-blue-600">{getCompletionPercentage()}%</p>
              </div>
              <div className="w-full h-3 bg-surface-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300"
                  style={{ width: `${getCompletionPercentage()}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-surface-600 mt-2 px-1">
                <span>Hospital {currentPatient?.assigned_hospital_id ? '✓' : '○'}</span>
                <span>Doctor {currentPatient?.assigned_doctor_id ? '✓' : '○'}</span>
                <span>Docs {documents.length > 0 ? '✓' : '○'}</span>
                <span>Complete {currentPatient?.completion_status === 'completed' ? '✓' : '○'}</span>
              </div>
            </div>
          </div>

          {/* Current Assignments */}
          <div className="bg-white rounded-lg border border-surface-200 p-4 shadow-sm">
            <h3 className="font-semibold text-surface-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🏥</span> Current Assignments
            </h3>
            <div className="space-y-2">
              {currentPatient?.assigned_hospital_id ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                  <p className="font-medium text-green-900">Hospital Assigned ✓</p>
                  <p className="text-green-700 text-xs mt-1">{hospitalsData?.data?.find(h => h.id === currentPatient.assigned_hospital_id)?.name}</p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="font-medium text-amber-900">Hospital Pending</p>
                </div>
              )}
              {currentPatient?.assigned_doctor_id ? (
                <div className="p-3 bg-green-50 border border-green-200 rounded text-sm">
                  <p className="font-medium text-green-900">Doctor Assigned ✓</p>
                  <p className="text-green-700 text-xs mt-1">{doctorsData?.data?.find(d => d.id === currentPatient.assigned_doctor_id)?.name}</p>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm">
                  <p className="font-medium text-amber-900">Doctor Pending</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Workflow Steps */}
        <div className="col-span-2">
          {/* Workflow Tabs */}
          <div className="flex gap-2 mb-6 bg-white rounded-lg p-2 border border-surface-200">
            {['overview', 'documents', 'hospital', 'doctor', 'email'].map((step, idx) => (
              <button
                key={step}
                onClick={() => setWorkflowStep(step)}
                className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-all ${
                  workflowStep === step
                    ? 'bg-blue-600 text-white'
                    : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="w-6 h-6 flex items-center justify-center bg-current bg-opacity-20 rounded-full text-xs font-bold">
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">{step.charAt(0).toUpperCase() + step.slice(1)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Step Content */}
          <div className="bg-white rounded-lg border border-surface-200 p-6">
            {/* OVERVIEW */}
            {workflowStep === 'overview' && (
              <div>
                <h3 className="text-lg font-bold text-surface-900 mb-4">Patient Overview</h3>
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-surface-600">Date of Birth</p>
                      <p className="font-medium text-surface-900">{fmtDate(currentPatient?.date_of_birth)}</p>
                    </div>
                    <div>
                      <p className="text-surface-600">Blood Group</p>
                      <p className="font-medium text-surface-900">{currentPatient?.blood_group || '—'}</p>
                    </div>
                    <div>
                      <p className="text-surface-600">Nationality</p>
                      <p className="font-medium text-surface-900">{currentPatient?.nationality || '—'}</p>
                    </div>
                    <div>
                      <p className="text-surface-600">Visa Status</p>
                      <Badge variant="info" size="sm">{currentPatient?.visa_status || '—'}</Badge>
                    </div>
                  </div>
                  <div>
                    <p className="text-surface-600">Medical History</p>
                    <p className="text-surface-900">{currentPatient?.medical_history || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="text-surface-600">Allergies</p>
                    <p className="text-surface-900">{currentPatient?.allergies || 'None'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* DOCUMENTS */}
            {workflowStep === 'documents' && (
              <div>
                <h3 className="text-lg font-bold text-surface-900 mb-4">Document Collection</h3>
                <div className="space-y-4">
                  {/* Upload Section */}
                  <div className="border-2 border-dashed border-surface-300 rounded-lg p-6 text-center">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      disabled={uploadDocMutation.isLoading}
                      className="hidden"
                      id="doc-upload"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    />
                    <label htmlFor="doc-upload" className="cursor-pointer block">
                      <p className="text-2xl mb-2">📄</p>
                      <p className="font-medium text-surface-900">Click to upload documents</p>
                      <p className="text-xs text-surface-600 mt-1">PDF, JPG, PNG, DOC supported</p>
                    </label>
                  </div>

                  {/* Documents List */}
                  {documents.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-surface-700">Uploaded Documents ({documents.length})</p>
                      {documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-surface-50 rounded">
                          <div className="flex items-center gap-2">
                            <span>📎</span>
                            <div>
                              <p className="text-sm font-medium text-surface-900">{doc.name || `Document ${idx + 1}`}</p>
                              <p className="text-xs text-surface-600">{doc.document_type}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => setDocuments(documents.filter((_, i) => i !== idx))}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-surface-600 text-center py-4">No documents uploaded yet</p>
                  )}
                </div>
              </div>
            )}

            {/* HOSPITAL ASSIGNMENT */}
            {workflowStep === 'hospital' && (
              <div>
                <h3 className="text-lg font-bold text-surface-900 mb-4">🏥 Assign Hospital</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">Select Hospital</label>
                    <select
                      value={selectedHospital?.id || ''}
                      onChange={(e) => {
                        const hospital = hospitalsData?.data?.find(h => h.id === parseInt(e.target.value));
                        setSelectedHospital(hospital);
                      }}
                      className="input w-full"
                    >
                      <option value="">-- Choose Hospital --</option>
                      {hospitalsData?.data?.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedHospital && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="font-medium text-blue-900">{selectedHospital.name}</p>
                      <p className="text-sm text-blue-700 mt-1">City: {selectedHospital.city}</p>
                      <p className="text-sm text-blue-700">Contact: {selectedHospital.phone}</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">Assignment Notes (Optional)</label>
                    <textarea
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      placeholder="Any special notes for the hospital..."
                      className="input w-full"
                      rows={3}
                    />
                  </div>

                  <button
                    onClick={handleAssignHospital}
                    disabled={assignHospitalMutation.isLoading || !selectedHospital}
                    className="w-full btn btn-primary"
                  >
                    {assignHospitalMutation.isLoading ? 'Assigning...' : 'Confirm Hospital Assignment'}
                  </button>
                </div>
              </div>
            )}

            {/* DOCTOR ASSIGNMENT */}
            {workflowStep === 'doctor' && (
              <div>
                <h3 className="text-lg font-bold text-surface-900 mb-4">👨‍⚕️ Assign Doctor</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">Select Doctor</label>
                    <select
                      value={selectedDoctor?.id || ''}
                      onChange={(e) => {
                        const doctor = doctorsData?.data?.find(d => d.id === parseInt(e.target.value));
                        setSelectedDoctor(doctor);
                      }}
                      className="input w-full"
                    >
                      <option value="">-- Choose Doctor --</option>
                      {doctorsData?.data?.map((d) => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.name} ({d.specialization})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedDoctor && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded">
                      <p className="font-medium text-green-900">Dr. {selectedDoctor.name}</p>
                      <p className="text-sm text-green-700 mt-1">Specialization: {selectedDoctor.specialization}</p>
                      <p className="text-sm text-green-700">Hospital: {selectedDoctor.hospital}</p>
                      <p className="text-sm text-green-700">Contact: {selectedDoctor.phone}</p>
                    </div>
                  )}

                  <button
                    onClick={handleAssignDoctor}
                    disabled={assignDoctorMutation.isLoading || !selectedDoctor}
                    className="w-full btn btn-primary"
                  >
                    {assignDoctorMutation.isLoading ? 'Assigning...' : 'Confirm Doctor Assignment'}
                  </button>
                </div>
              </div>
            )}

            {/* EMAIL TO HOSPITAL */}
            {workflowStep === 'email' && (
              <div>
                <h3 className="text-lg font-bold text-surface-900 mb-4">📧 Send Patient Details to Hospital</h3>
                <div className="space-y-4">
                  {documents.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                      ⚠️ No documents attached. Please upload documents before sending.
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">Hospital Email Address</label>
                    <input
                      type="email"
                      value={hospitalEmail}
                      onChange={(e) => setHospitalEmail(e.target.value)}
                      placeholder="hospital@email.com"
                      className="input w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-surface-900 mb-2">Additional Message</label>
                    <textarea
                      value={emailMessage}
                      onChange={(e) => setEmailMessage(e.target.value)}
                      placeholder="Add any special instructions or notes..."
                      className="input w-full"
                      rows={4}
                    />
                  </div>

                  {/* Summary */}
                  <div className="p-4 bg-surface-50 border border-surface-200 rounded text-sm">
                    <p className="font-semibold text-surface-900 mb-2">Patient Summary to be Sent:</p>
                    <ul className="space-y-1 text-surface-700">
                      <li>✓ Patient name: {currentPatient?.patient_name}</li>
                      <li>✓ Contact: {currentPatient?.phone}, {currentPatient?.email}</li>
                      <li>✓ Condition: {currentPatient?.eye_condition}</li>
                      <li>✓ Documents: {documents.length} file(s)</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleSendToHospital}
                    disabled={sendEmailToHospitalMutation.isLoading || !hospitalEmail || documents.length === 0}
                    className="w-full btn btn-primary"
                  >
                    {sendEmailToHospitalMutation.isLoading ? 'Sending...' : '✉️ Send to Hospital'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
