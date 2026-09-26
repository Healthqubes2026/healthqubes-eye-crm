import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { patientsAPI, leadsAPI, emailsAPI, employeesAPI, hospitalsAPI, meetingsAPI } from '../api';
import { PageLoader, Badge, EmptyState, Pagination, Modal, Tabs } from '../components/common';
import { fmtDate, formatEmployeeId, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const COMPLETION_STATUSES = ['confirmation','onboarding','docs_complete','travel_planning','appointment','treatment','recovery','completed','on_hold','cancelled'];
const HOSPITAL_CATEGORIES = ['primary', 'secondary', 'tertiary', 'super_specialty'];
const DOCTOR_CATEGORIES = ['A', 'B', 'C'];

export default function PatientsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [addModal, setAddModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);
  const { register: registerEdit, handleSubmit: handleEditSubmit } = useForm();
  const { register: registerAdd, handleSubmit: handleAddSubmit, reset: resetAdd, setValue } = useForm();

  // Hospital management state
  const [addHospitalModal, setAddHospitalModal] = useState(false);
  const { register: registerHospitalAdd, handleSubmit: handleHospitalAddSubmit, reset: resetHospitalAdd } = useForm();

  // Doctor management state
  const [addDoctorModal, setAddDoctorModal] = useState(false);
  const { register: registerDoctorAdd, handleSubmit: handleDoctorAddSubmit, reset: resetDoctorAdd } = useForm();

  const { data, isLoading } = useQuery(
    ['patients', page, statusFilter],
    () => patientsAPI.list({ page, limit: 20, completion_status: statusFilter || undefined }).then(r => r.data),
    { keepPreviousData: true }
  );

  const { data: eligibleLeadsData } = useQuery('eligible-leads', () => leadsAPI.eligible().then(r => r.data));
  const eligibleLeads = eligibleLeadsData?.data || [];

  const { data: managerListData } = useQuery(['employees', 'managers'], () => employeesAPI.list({ role: 'manager', limit: 100 }).then(r => r.data));
  const managerList = managerListData?.data || [];

  const { data: hospitalsData } = useQuery('hospitals-list', () => hospitalsAPI.list({ limit: 100 }).then(r => r.data));
  const hospitalsList = hospitalsData?.data || [];

  const { data: doctorsData } = useQuery('doctors-list', () => meetingsAPI.listDoctors({ limit: 100 }).then(r => r.data));
  const doctorsList = doctorsData?.data || [];

  const leadRegister = registerAdd('lead_id', {
    required: true,
    onChange: (e) => {
      const lead = eligibleLeads.find(item => String(item.id) === e.target.value);
      setSelectedLead(lead || null);
    },
  });

  const { data: patientData, isLoading: patientLoading } = useQuery(
    ['patient', selectedPatient?.id],
    () => patientsAPI.get(selectedPatient.id).then(r => r.data),
    { enabled: !!selectedPatient }
  );

  const updateMutation = useMutation(
    ({ id, ...data }) => patientsAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Patient updated');
        qc.invalidateQueries('patients');
        qc.invalidateQueries(['patient', selectedPatient?.id]);
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const [docFile, setDocFile] = useState(null);
  const [docType, setDocType] = useState('passport');
  const [docName, setDocName] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const [hospitalEmailModalOpen, setHospitalEmailModalOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [hospitalEmailMessage, setHospitalEmailMessage] = useState('');
  const [hospitalEmailAttachments, setHospitalEmailAttachments] = useState([]);

  const [doctorEmailModalOpen, setDoctorEmailModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorEmailMessage, setDoctorEmailMessage] = useState('');
  const [doctorEmailAttachments, setDoctorEmailAttachments] = useState([]);

  // Assignment modal state
  const [assignmentModal, setAssignmentModal] = useState(false);
  const [assignmentHospitalId, setAssignmentHospitalId] = useState('');
  const [assignmentDoctorId, setAssignmentDoctorId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Bulk assign modal state
  const [bulkAssignModal, setBulkAssignModal] = useState(false);
  const [bulkAssignHospitalId, setBulkAssignHospitalId] = useState('');
  const [bulkAssignDoctorId, setBulkAssignDoctorId] = useState('');
  const [bulkAssignNotes, setBulkAssignNotes] = useState('');
  const [bulkAssignSelected, setBulkAssignSelected] = useState([]);

  // Notify assignment modal state
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifySendToPatient, setNotifySendToPatient] = useState(true);
  const [notifySendToHospital, setNotifySendToHospital] = useState(true);
  const [notifySendToDoctor, setNotifySendToDoctor] = useState(true);
  const [notifyMessage, setNotifyMessage] = useState('');

  const sendEmailMutation = useMutation((data) => emailsAPI.sendSummary(data), {
    onSuccess: () => {
      toast.success('Patient summary email sent successfully');
      setEmailModalOpen(false);
      setEmailSubject('');
      setEmailMessage('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const sendToHospitalMutation = useMutation((data) => emailsAPI.sendToHospital(data), {
    onSuccess: () => {
      toast.success('Patient details sent to hospital successfully');
      setHospitalEmailModalOpen(false);
      setSelectedHospital(null);
      setHospitalEmailMessage('');
      setHospitalEmailAttachments([]);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const sendToDoctorMutation = useMutation((data) => emailsAPI.sendToDoctor(data), {
    onSuccess: () => {
      toast.success('Email sent to doctor successfully');
      setDoctorEmailModalOpen(false);
      setSelectedDoctor(null);
      setDoctorEmailMessage('');
      setDoctorEmailAttachments([]);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const uploadDocMutation = useMutation(({ id, formData }) => patientsAPI.uploadDoc(id, formData), {
    onSuccess: () => {
      toast.success('Document uploaded successfully');
      setDocFile(null);
      setDocName('');
      setDocType('passport');
      setDocExpiry('');
      qc.invalidateQueries(['patient', selectedPatient?.id]);
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const addPatientMutation = useMutation((data) => patientsAPI.add(data), {
    onSuccess: () => {
      toast.success('Patient added successfully');
      setAddModal(false);
      resetAdd();
      setSelectedLead(null);
      qc.invalidateQueries('patients');
      qc.invalidateQueries('leads');
      qc.invalidateQueries('eligible-leads');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const addHospitalMutation = useMutation((data) => hospitalsAPI.add(data), {
    onSuccess: () => {
      toast.success('Hospital added successfully');
      setAddHospitalModal(false);
      resetHospitalAdd();
      qc.invalidateQueries('hospitals-list');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const addDoctorMutation = useMutation((data) => meetingsAPI.addDoctor(data), {
    onSuccess: () => {
      toast.success('Doctor added successfully');
      setAddDoctorModal(false);
      resetDoctorAdd();
      qc.invalidateQueries('doctors-list');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const assignmentMutation = useMutation(
    ({ id, data }) => {
      if (assignmentHospitalId && assignmentDoctorId) {
        return patientsAPI.assignBoth(id, data);
      } else if (assignmentHospitalId) {
        return patientsAPI.assignHospital(id, data);
      } else if (assignmentDoctorId) {
        return patientsAPI.assignDoctor(id, data);
      }
    },
    {
      onSuccess: () => {
        toast.success('Assignment successful');
        setAssignmentModal(false);
        setAssignmentHospitalId('');
        setAssignmentDoctorId('');
        setAssignmentNotes('');
        qc.invalidateQueries(['patient', selectedPatient?.id]);
        qc.invalidateQueries('patients');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const handleAssignmentSubmit = () => {
    if (!assignmentHospitalId && !assignmentDoctorId) {
      toast.error('Please select at least a hospital or doctor');
      return;
    }
    const data = {};
    if (assignmentHospitalId) data.hospital_id = assignmentHospitalId;
    if (assignmentDoctorId) data.doctor_id = assignmentDoctorId;
    if (assignmentNotes) data.notes = assignmentNotes;
    assignmentMutation.mutate({ id: selectedPatient.id, data });
  };

  const bulkAssignMutation = useMutation(
    (data) => patientsAPI.bulkAssign(data),
    {
      onSuccess: (res) => {
        toast.success(`Assigned ${res.data.data.successCount} patients successfully`);
        setBulkAssignModal(false);
        setBulkAssignHospitalId('');
        setBulkAssignDoctorId('');
        setBulkAssignNotes('');
        setBulkAssignSelected([]);
        qc.invalidateQueries('patients');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const notifyAssignmentMutation = useMutation(
    ({ id, data }) => patientsAPI.notifyAssignment(id, data),
    {
      onSuccess: () => {
        toast.success('Assignment notifications sent successfully');
        setNotifyModal(false);
        setNotifySendToPatient(true);
        setNotifySendToHospital(true);
        setNotifySendToDoctor(true);
        setNotifyMessage('');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const handleBulkAssignSubmit = () => {
    if (bulkAssignSelected.length === 0) {
      toast.error('Please select at least one patient');
      return;
    }
    if (!bulkAssignHospitalId && !bulkAssignDoctorId) {
      toast.error('Please select at least a hospital or doctor');
      return;
    }
    const data = {
      patient_ids: bulkAssignSelected,
      notes: bulkAssignNotes || null
    };
    if (bulkAssignHospitalId) data.hospital_id = bulkAssignHospitalId;
    if (bulkAssignDoctorId) data.doctor_id = bulkAssignDoctorId;
    bulkAssignMutation.mutate(data);
  };

  const handleNotifySubmit = () => {
    if (!notifySendToPatient && !notifySendToHospital && !notifySendToDoctor) {
      toast.error('Please select at least one recipient');
      return;
    }
    const data = {
      send_to_patient: notifySendToPatient,
      send_to_hospital: notifySendToHospital,
      send_to_doctor: notifySendToDoctor,
      message: notifyMessage || null
    };
    notifyAssignmentMutation.mutate({ id: selectedPatient.id, data });
  };

  useEffect(() => {
    if (!selectedLead) return;
    setValue('lead_id', selectedLead.id);
    setValue('patient_name', selectedLead.patient_name);
    setValue('phone', selectedLead.phone || '');
    setValue('email', selectedLead.email || '');
  }, [selectedLead, setValue]);

  useEffect(() => {
    setDocFile(null);
    setDocName('');
    setDocType('passport');
    setDocExpiry('');
  }, [selectedPatient]);

  const handleUploadSubmit = (event) => {
    event.preventDefault();
    if (!selectedPatient || !docFile) {
      toast.error('Please select a document file first.');
      return;
    }

    const formData = new FormData();
    formData.append('document', docFile);
    formData.append('document_type', docType);
    formData.append('document_name', docName || docFile.name);
    if (docExpiry) formData.append('expiry_date', docExpiry);

    uploadDocMutation.mutate({ id: selectedPatient.id, formData });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Patient Management</h1>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setBulkAssignSelected([]);
              setBulkAssignHospitalId('');
              setBulkAssignDoctorId('');
              setBulkAssignNotes('');
              setBulkAssignModal(true);
            }}
            className="inline-flex items-center justify-center rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Bulk Assign
          </button>
          <button
            type="button"
            onClick={() => {
              resetHospitalAdd();
              setAddHospitalModal(true);
            }}
            className="inline-flex items-center justify-center rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Add Hospital
          </button>
          <button
            type="button"
            onClick={() => {
              resetDoctorAdd();
              setAddDoctorModal(true);
            }}
            className="inline-flex items-center justify-center rounded bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Add Doctor
          </button>
          <button
            type="button"
            onClick={() => {
              resetAdd();
              setSelectedLead(null);
              setAddModal(true);
            }}
            className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Patient
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Statuses</option>
          {COMPLETION_STATUSES.map(status => (
            <option key={status} value={status}>{status.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Patients List */}
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Patients</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.data?.map(patient => (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedPatient?.id === patient.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium">{patient.patient_name}</div>
                <div className="text-sm text-gray-600">{patient.lead_phone}</div>
                <div className="mt-2">
                  <Badge variant={
                    patient.completion_status === 'completed' ? 'success' :
                    patient.completion_status === 'cancelled' ? 'danger' :
                    patient.completion_status === 'on_hold' ? 'warning' : 'info'
                  }>
                    {patient.completion_status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {data?.meta && <Pagination page={data.meta.page} total={data.meta.total} limit={data.meta.limit} onChange={setPage} />}
        </div>

        {/* Patient Details */}
        <div className="bg-white rounded shadow">
          {selectedPatient ? (
            <>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedPatient.patient_name}</h2>
              </div>

              <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
                <Tabs.Tab id="overview" title="Overview">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500">Patient overview and contact details.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAssignmentHospitalId('');
                            setAssignmentDoctorId('');
                            setAssignmentNotes('');
                            setAssignmentModal(true);
                          }}
                          className="inline-flex items-center justify-center rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                          Assign Hospital & Doctor
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRecipientEmail(selectedPatient.email || '');
                            setEmailSubject(`Patient Summary - ${selectedPatient.patient_name}`);
                            setEmailMessage('Please review your patient summary below.');
                            setEmailModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                          disabled={!selectedPatient.email}
                        >
                          Send Summary Email
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setHospitalEmailMessage(`Dear Hospital Team,\n\nWe are referring ${selectedPatient.patient_name} for medical treatment. Please find the patient details below.`);
                            setHospitalEmailModalOpen(true);
                          }}
                          className="inline-flex items-center justify-center rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                        >
                          Send to Hospital
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p>{selectedPatient.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p>{selectedPatient.email || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Completion Status</label>
                      <Badge variant={
                        selectedPatient.completion_status === 'completed' ? 'success' :
                        selectedPatient.completion_status === 'cancelled' ? 'danger' :
                        selectedPatient.completion_status === 'on_hold' ? 'warning' : 'info'
                      }>
                        {selectedPatient.completion_status.replace('_', ' ')}
                      </Badge>
                    </div>

                    {patientData?.assigned_hospital_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Assigned Hospital</label>
                        <p className="text-sm text-gray-600">
                          {hospitalsList.find(h => h.id === patientData.assigned_hospital_id)?.name || 'Unknown'} 
                          <span className="text-xs text-gray-500 ml-2">
                            (Assigned: {patientData.hospital_assigned_at ? new Date(patientData.hospital_assigned_at).toLocaleDateString() : 'N/A'})
                          </span>
                        </p>
                      </div>
                    )}

                    {patientData?.assigned_doctor_id && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Assigned Doctor</label>
                        <p className="text-sm text-gray-600">
                          {doctorsList.find(d => d.id === patientData.assigned_doctor_id) && 
                            `Dr. ${doctorsList.find(d => d.id === patientData.assigned_doctor_id).name}`}
                          <span className="text-xs text-gray-500 ml-2">
                            (Assigned: {patientData.doctor_assigned_at ? new Date(patientData.doctor_assigned_at).toLocaleDateString() : 'N/A'})
                          </span>
                        </p>
                      </div>
                    )}

                    {selectedPatient.package_value && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Package Value</label>
                        <p className="font-medium">₹{selectedPatient.package_value.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="hospitals" title="Hospitals">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold">Available Hospitals</h3>
                      <button
                        type="button"
                        onClick={() => {
                          resetHospitalAdd();
                          setAddHospitalModal(true);
                        }}
                        className="inline-flex items-center justify-center rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                      >
                        Add Hospital
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {hospitalsList.length > 0 ? (
                        <div className="space-y-2">
                          {hospitalsList.map(hospital => (
                            <div key={hospital.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                              <div>
                                <div className="font-medium">{hospital.name}</div>
                                <div className="text-sm text-gray-600">{hospital.city}, {hospital.state}</div>
                                <div className="text-xs text-gray-500">{hospital.category}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  hospital.category === 'tertiary' ? 'success' :
                                  hospital.category === 'secondary' ? 'info' :
                                  hospital.category === 'primary' ? 'warning' : 'secondary'
                                }>
                                  {hospital.category}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setHospitalEmailMessage(`Dear ${hospital.name} Team,\n\nWe are referring ${selectedPatient.patient_name} for medical treatment. Please find the patient details below.`);
                                    setSelectedHospital(hospital);
                                    setHospitalEmailModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  disabled={!hospital.email}
                                >
                                  Send Patient
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No hospitals available. Add a hospital to get started." />
                      )}
                    </div>
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="doctors" title="Doctors">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold">Available Doctors</h3>
                      <button
                        type="button"
                        onClick={() => {
                          resetDoctorAdd();
                          setAddDoctorModal(true);
                        }}
                        className="inline-flex items-center justify-center rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
                      >
                        Add Doctor
                      </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                      {doctorsList.length > 0 ? (
                        <div className="space-y-2">
                          {doctorsList.map(doctor => (
                            <div key={doctor.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                              <div>
                                <div className="font-medium">Dr. {doctor.name}</div>
                                <div className="text-sm text-gray-600">{doctor.specialization || 'General'}</div>
                                <div className="text-xs text-gray-500">{doctor.hospital_name || 'N/A'}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  doctor.category === 'A' ? 'success' :
                                  doctor.category === 'B' ? 'info' : 'warning'
                                }>
                                  Category {doctor.category}
                                </Badge>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDoctorEmailMessage(`Dear Dr. ${doctor.name},\n\nWe are referring ${selectedPatient.patient_name} for consultation in ${doctor.specialization || 'your specialty'}. Please find attached relevant patient documents and information.`);
                                    setSelectedDoctor(doctor);
                                    setDoctorEmailModalOpen(true);
                                  }}
                                  className="inline-flex items-center justify-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  disabled={!doctor.email}
                                >
                                  Send Email
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState message="No doctors available. Add a doctor to get started." />
                      )}
                    </div>
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="documents" title="Documents">
                  <div className="p-4 space-y-6">
                    {patientData?.documents?.length > 0 ? (
                      <div className="space-y-2">
                        {patientData.documents.map(doc => (
                          <div key={doc.id} className="flex justify-between items-center p-3 border rounded">
                            <div>
                              <div className="font-medium">{doc.document_name}</div>
                              <div className="text-sm text-gray-600">{doc.document_type.replace('_', ' ')}</div>
                              {doc.expiry_date && <div className="text-xs text-gray-500">Expiry: {fmtDate(doc.expiry_date)}</div>}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={doc.is_verified ? 'success' : 'secondary'}>
                                {doc.is_verified ? 'Verified' : 'Pending'}
                              </Badge>
                              <a
                                href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/uploads/patient-docs/${doc.file_path.split('/').pop()}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                              >
                                Download
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="No documents uploaded yet" />
                    )}

                    <div className="p-4 border rounded bg-gray-50">
                      <h3 className="text-sm font-semibold mb-3">Upload Document</h3>
                      <form onSubmit={handleUploadSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Document Name</label>
                            <input
                              value={docName}
                              onChange={(e) => setDocName(e.target.value)}
                              placeholder="Passport, Report, Invoice"
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Document Type</label>
                            <select
                              value={docType}
                              onChange={(e) => setDocType(e.target.value)}
                              className="w-full border rounded px-3 py-2"
                            >
                              <option value="passport">Passport</option>
                              <option value="medical_report">Medical Report</option>
                              <option value="invoice">Invoice</option>
                              <option value="insurance">Insurance</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Expiry Date</label>
                            <input
                              type="date"
                              value={docExpiry}
                              onChange={(e) => setDocExpiry(e.target.value)}
                              className="w-full border rounded px-3 py-2"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Document File</label>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={!docFile || uploadDocMutation.isLoading}
                          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {uploadDocMutation.isLoading ? 'Uploading...' : 'Upload Document'}
                        </button>
                      </form>
                    </div>
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="assignments" title="Assignments">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <h3 className="text-lg font-semibold">Assignment History</h3>
                      <button
                        type="button"
                        onClick={() => {
                          setNotifySendToPatient(true);
                          setNotifySendToHospital(true);
                          setNotifySendToDoctor(true);
                          setNotifyMessage('');
                          setNotifyModal(true);
                        }}
                        disabled={!selectedPatient?.assigned_hospital_id && !selectedPatient?.assigned_doctor_id}
                        className="inline-flex items-center justify-center rounded bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Send Notification
                      </button>
                    </div>

                    {patientData?.assignments && patientData.assignments.length > 0 ? (
                      <div className="space-y-3">
                        {patientData.assignments.map((assignment, idx) => (
                          <div key={assignment.id} className="border rounded p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-700">
                                  Assignment #{patientData.assignments.length - idx}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {new Date(assignment.created_at).toLocaleString()}
                                </p>
                              </div>
                              <Badge variant={assignment.status === 'active' ? 'success' : 'secondary'}>
                                {assignment.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-2">
                              {assignment.hospital_name && (
                                <p>
                                  <span className="font-medium text-gray-700">Hospital:</span>{' '}
                                  <span className="text-gray-600">{assignment.hospital_name} <span className="text-xs text-gray-500">({assignment.hospital_city})</span></span>
                                </p>
                              )}
                              {assignment.doctor_name && (
                                <p>
                                  <span className="font-medium text-gray-700">Doctor:</span>{' '}
                                  <span className="text-gray-600">Dr. {assignment.doctor_name} <span className="text-xs text-gray-500">({assignment.specialization || 'General'})</span></span>
                                </p>
                              )}
                            </div>

                            <div className="text-xs text-gray-600 mb-2">
                              <span className="font-medium">Type:</span> {assignment.assignment_type.replace('_', ' ')} | 
                              <span className="font-medium ml-2">By:</span> {assignment.assigned_by_name}
                            </div>

                            {assignment.notes && (
                              <div className="text-sm bg-white rounded p-2 mt-2">
                                <p className="text-xs font-medium text-gray-700">Notes:</p>
                                <p className="text-gray-600">{assignment.notes}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState message="No assignments yet. Click 'Assign Hospital & Doctor' to get started." />
                    )}
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="edit" title="Edit">
                  <form onSubmit={handleEditSubmit((data) => updateMutation.mutate({ id: selectedPatient.id, ...data }))} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Patient Name</label>
                        <input {...registerEdit('patient_name')} defaultValue={selectedPatient.patient_name} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input {...registerEdit('phone')} defaultValue={selectedPatient.phone} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Completion Status</label>
                      <select {...registerEdit('completion_status')} defaultValue={selectedPatient.completion_status} className="w-full border rounded px-3 py-2">
                        {COMPLETION_STATUSES.map(status => (
                          <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Package Value</label>
                      <input {...registerEdit('package_value')} type="number" defaultValue={selectedPatient.package_value} className="w-full border rounded px-3 py-2" />
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                      Update Patient
                    </button>
                  </form>
                </Tabs.Tab>
              </Tabs>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a patient to view details
            </div>
          )}
        </div>
      </div>

      <Modal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Send Patient Summary" width="max-w-xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedPatient) return;
          sendEmailMutation.mutate({
            patientId: selectedPatient.id,
            recipientEmail,
            subject: emailSubject,
            additionalMessage: emailMessage,
          });
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={emailMessage}
              onChange={(e) => setEmailMessage(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
            />
          </div>
          <button
            type="submit"
            disabled={sendEmailMutation.isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendEmailMutation.isLoading ? 'Sending...' : 'Send Summary Email'}
          </button>
        </form>
      </Modal>

      <Modal open={hospitalEmailModalOpen} onClose={() => setHospitalEmailModalOpen(false)} title="Send Patient Details to Hospital" width="max-w-xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedPatient || !selectedHospital) return;
          sendToHospitalMutation.mutate({
            hospitalId: selectedHospital.id,
            patientId: selectedPatient.id,
            recipientEmail: selectedHospital.email,
            subject: `Patient Referral - ${selectedPatient.patient_name}`,
            message: hospitalEmailMessage,
            attachments: hospitalEmailAttachments,
          });
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Hospital</label>
            <select
              value={selectedHospital?.id || ''}
              onChange={(e) => {
                const hospital = hospitalsList.find(h => h.id == e.target.value);
                setSelectedHospital(hospital || null);
              }}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Choose a hospital...</option>
              {hospitalsList.map(hospital => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.name} - {hospital.city}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hospital Email</label>
            <input
              type="email"
              value={selectedHospital?.email || ''}
              onChange={(e) => setSelectedHospital(prev => prev ? {...prev, email: e.target.value} : null)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={hospitalEmailMessage}
              onChange={(e) => setHospitalEmailMessage(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
              placeholder="Enter your message to the hospital..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Attach Documents</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const files = Array.from(e.target.files);
                const attachments = files.map(file => ({
                  filename: file.name,
                  path: URL.createObjectURL(file),
                  content: file
                }));
                setHospitalEmailAttachments(attachments);
              }}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Supported formats: PDF, DOC, DOCX, JPG, PNG</p>
            {hospitalEmailAttachments.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Attached files:</p>
                <ul className="text-xs text-gray-600">
                  {hospitalEmailAttachments.map((file, index) => (
                    <li key={index}>• {file.filename}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={sendToHospitalMutation.isLoading || !selectedHospital}
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendToHospitalMutation.isLoading ? 'Sending...' : 'Send Patient Details'}
          </button>
        </form>
      </Modal>

      <Modal open={doctorEmailModalOpen} onClose={() => setDoctorEmailModalOpen(false)} title="Send Email to Doctor" width="max-w-xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedDoctor) return;
          sendToDoctorMutation.mutate({
            doctorId: selectedDoctor.id,
            recipientEmail: selectedDoctor.email,
            subject: `Communication from Healthqubes Eye - Dr. ${selectedDoctor.name}`,
            message: doctorEmailMessage,
            attachments: doctorEmailAttachments,
          });
        }} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Select Doctor</label>
            <select
              value={selectedDoctor?.id || ''}
              onChange={(e) => {
                const doctor = doctorsList.find(d => d.id == e.target.value);
                setSelectedDoctor(doctor || null);
              }}
              className="w-full border rounded px-3 py-2"
              required
            >
              <option value="">Choose a doctor...</option>
              {doctorsList.map(doctor => (
                <option key={doctor.id} value={doctor.id}>
                  Dr. {doctor.name} - {doctor.specialization || 'General'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Doctor Email</label>
            <input
              type="email"
              value={selectedDoctor?.email || ''}
              onChange={(e) => setSelectedDoctor(prev => prev ? {...prev, email: e.target.value} : null)}
              className="w-full border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Subject</label>
            <input
              type="text"
              value={`Communication from Healthqubes Eye - Dr. ${selectedDoctor?.name || ''}`}
              onChange={(e) => {}}
              className="w-full border rounded px-3 py-2 bg-gray-50"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Message</label>
            <textarea
              value={doctorEmailMessage}
              onChange={(e) => setDoctorEmailMessage(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={4}
              placeholder="Enter your message to the doctor..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Attach Documents</label>
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const files = Array.from(e.target.files);
                const attachments = files.map(file => ({
                  filename: file.name,
                  path: URL.createObjectURL(file),
                  content: file
                }));
                setDoctorEmailAttachments(attachments);
              }}
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Supported formats: PDF, DOC, DOCX, JPG, PNG</p>
            {doctorEmailAttachments.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium">Attached files:</p>
                <ul className="text-xs text-gray-600">
                  {doctorEmailAttachments.map((file, index) => (
                    <li key={index}>• {file.filename}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={sendToDoctorMutation.isLoading || !selectedDoctor}
            className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendToDoctorMutation.isLoading ? 'Sending...' : 'Send Email to Doctor'}
          </button>
        </form>
      </Modal>

      <Modal open={assignmentModal} onClose={() => setAssignmentModal(false)} title="Assign Hospital & Doctor to Patient" width="max-w-2xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          handleAssignmentSubmit();
        }} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <p className="font-medium text-blue-900">Patient: <span className="font-semibold">{selectedPatient?.patient_name}</span></p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Hospital (Optional)</label>
              <select
                value={assignmentHospitalId}
                onChange={(e) => setAssignmentHospitalId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a hospital...</option>
                {hospitalsList.map(hospital => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name} - {hospital.city} ({hospital.category})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor (Optional)</label>
              <select
                value={assignmentDoctorId}
                onChange={(e) => setAssignmentDoctorId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a doctor...</option>
                {doctorsList.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name} - {doctor.specialization || 'General'} {doctor.hospital_name ? `(${doctor.hospital_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="Add notes about this assignment (optional)..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setAssignmentModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={assignmentMutation.isLoading || (!assignmentHospitalId && !assignmentDoctorId)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {assignmentMutation.isLoading ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={notifyModal} onClose={() => setNotifyModal(false)} title="Send Assignment Notifications" width="max-w-2xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          handleNotifySubmit();
        }} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
            <p className="font-medium text-blue-900">Patient: <span className="font-semibold">{selectedPatient?.patient_name}</span></p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center p-3 border rounded hover:bg-gray-50">
              <input
                type="checkbox"
                id="notify_patient"
                checked={notifySendToPatient}
                onChange={(e) => setNotifySendToPatient(e.target.checked)}
                className="mr-3 w-4 h-4"
              />
              <label htmlFor="notify_patient" className="flex-1 cursor-pointer">
                <p className="font-medium text-gray-700">Send to Patient</p>
                <p className="text-xs text-gray-600">{selectedPatient?.email || 'No email'}</p>
              </label>
            </div>

            <div className="flex items-center p-3 border rounded hover:bg-gray-50">
              <input
                type="checkbox"
                id="notify_hospital"
                checked={notifySendToHospital}
                onChange={(e) => setNotifySendToHospital(e.target.checked)}
                disabled={!selectedPatient?.assigned_hospital_id}
                className="mr-3 w-4 h-4 disabled:opacity-50"
              />
              <label htmlFor="notify_hospital" className="flex-1 cursor-pointer">
                <p className="font-medium text-gray-700">Send to Hospital</p>
                <p className="text-xs text-gray-600">
                  {hospitalsList.find(h => h.id === selectedPatient?.assigned_hospital_id)?.name || 'No hospital assigned'}
                </p>
              </label>
            </div>

            <div className="flex items-center p-3 border rounded hover:bg-gray-50">
              <input
                type="checkbox"
                id="notify_doctor"
                checked={notifySendToDoctor}
                onChange={(e) => setNotifySendToDoctor(e.target.checked)}
                disabled={!selectedPatient?.assigned_doctor_id}
                className="mr-3 w-4 h-4 disabled:opacity-50"
              />
              <label htmlFor="notify_doctor" className="flex-1 cursor-pointer">
                <p className="font-medium text-gray-700">Send to Doctor</p>
                <p className="text-xs text-gray-600">
                  {doctorsList.find(d => d.id === selectedPatient?.assigned_doctor_id) && 
                    `Dr. ${doctorsList.find(d => d.id === selectedPatient?.assigned_doctor_id).name}`}
                </p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Message (Optional)</label>
            <textarea
              value={notifyMessage}
              onChange={(e) => setNotifyMessage(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
              rows={3}
              placeholder="Add a custom message to include in notifications..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setNotifyModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={notifyAssignmentMutation.isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {notifyAssignmentMutation.isLoading ? 'Sending...' : 'Send Notifications'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={bulkAssignModal} onClose={() => setBulkAssignModal(false)} title="Bulk Assign Hospital & Doctor" width="max-w-3xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          handleBulkAssignSubmit();
        }} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
            <p className="font-medium text-amber-900">Selected Patients: <span className="font-semibold">{bulkAssignSelected.length}</span></p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Choose Patients</label>
            <div className="max-h-48 overflow-y-auto border rounded">
              {data?.data?.map(patient => (
                <div key={patient.id} className="flex items-center p-3 border-b hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={bulkAssignSelected.includes(patient.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setBulkAssignSelected([...bulkAssignSelected, patient.id]);
                      } else {
                        setBulkAssignSelected(bulkAssignSelected.filter(id => id !== patient.id));
                      }
                    }}
                    className="mr-3 w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-gray-700">{patient.patient_name}</p>
                    <p className="text-xs text-gray-600">{patient.lead_phone}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Hospital (Optional)</label>
              <select
                value={bulkAssignHospitalId}
                onChange={(e) => setBulkAssignHospitalId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a hospital...</option>
                {hospitalsList.map(hospital => (
                  <option key={hospital.id} value={hospital.id}>
                    {hospital.name} - {hospital.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Doctor (Optional)</label>
              <select
                value={bulkAssignDoctorId}
                onChange={(e) => setBulkAssignDoctorId(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select a doctor...</option>
                {doctorsList.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.name} - {doctor.specialization || 'General'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Notes</label>
            <textarea
              value={bulkAssignNotes}
              onChange={(e) => setBulkAssignNotes(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
              rows={2}
              placeholder="Add notes for this bulk assignment (optional)..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={() => setBulkAssignModal(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={bulkAssignMutation.isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {bulkAssignMutation.isLoading ? 'Assigning...' : `Assign to ${bulkAssignSelected.length} Patients`}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Patient" width="max-w-2xl">
        <form onSubmit={handleAddSubmit((data) => addPatientMutation.mutate(data))} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Mapped Lead</label>
              <select
                {...leadRegister}
                className="w-full border rounded px-3 py-2"
                defaultValue=""
                disabled={!eligibleLeads.length}
              >
                <option value="" disabled>
                  {eligibleLeads.length ? 'Select a lead' : 'No eligible leads available'}
                </option>
                {eligibleLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.patient_name} • {lead.phone || lead.email || lead.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Patient Name</label>
              <input {...registerAdd('patient_name', { required: true })} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...registerAdd('phone')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...registerAdd('email')} type="email" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <input {...registerAdd('whatsapp')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Case Manager</label>
              <select {...registerAdd('case_manager_id')} className="w-full border rounded px-3 py-2">
                <option value="">Select a manager</option>
                {managerList.map((mgr) => (
                  <option key={mgr.id} value={mgr.id}>
                    {formatEmployeeId(mgr.id)} — {mgr.name}{mgr.email ? ` (${mgr.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Completion Status</label>
              <select {...registerAdd('completion_status')} defaultValue="confirmation" className="w-full border rounded px-3 py-2">
                {COMPLETION_STATUSES.map(status => (
                  <option key={status} value={status}>{status.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Package Value</label>
              <input {...registerAdd('package_value')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Arrival Date</label>
              <input {...registerAdd('arrival_date')} type="date" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Departure Date</label>
              <input {...registerAdd('departure_date')} type="date" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Feedback</label>
            <textarea {...registerAdd('feedback')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Add Patient
          </button>
        </form>
      </Modal>

      <Modal open={addHospitalModal} onClose={() => setAddHospitalModal(false)} title="Add Hospital" width="max-w-2xl">
        <form onSubmit={handleHospitalAddSubmit((data) => addHospitalMutation.mutate(data))} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hospital Name *</label>
              <input {...registerHospitalAdd('name', { required: true })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...registerHospitalAdd('phone')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...registerHospitalAdd('email')} type="email" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input {...registerHospitalAdd('website')} type="url" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea {...registerHospitalAdd('address')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input {...registerHospitalAdd('city')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input {...registerHospitalAdd('state')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input {...registerHospitalAdd('country')} defaultValue="India" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...registerHospitalAdd('category')} className="w-full border rounded px-3 py-2">
                <option value="secondary">Secondary</option>
                {HOSPITAL_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">
            Add Hospital
          </button>
        </form>
      </Modal>

      <Modal open={addDoctorModal} onClose={() => setAddDoctorModal(false)} title="Add Doctor" width="max-w-2xl">
        <form onSubmit={handleDoctorAddSubmit((data) => addDoctorMutation.mutate(data))} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Doctor Name *</label>
              <input {...registerDoctorAdd('name', { required: true })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Specialization</label>
              <input {...registerDoctorAdd('specialization')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...registerDoctorAdd('phone')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...registerDoctorAdd('email')} type="email" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hospital Name</label>
              <input {...registerDoctorAdd('hospital_name')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...registerDoctorAdd('category')} className="w-full border rounded px-3 py-2">
                {DOCTOR_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea {...registerDoctorAdd('address')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input {...registerDoctorAdd('city')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input {...registerDoctorAdd('state')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Experience (Years)</label>
              <input {...registerDoctorAdd('experience_years')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Consultation Fee</label>
              <input {...registerDoctorAdd('consultation_fee')} type="number" className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <button type="submit" className="w-full bg-purple-600 text-white py-2 rounded hover:bg-purple-700">
            Add Doctor
          </button>
        </form>
      </Modal>
    </div>
  );
}