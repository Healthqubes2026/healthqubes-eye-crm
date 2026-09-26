import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { meetingsAPI, emailsAPI } from '../api';
import { PageLoader, Badge, EmptyState, Pagination, Modal, Tabs } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const DOCTOR_CATEGORIES = ['A', 'B', 'C'];

export default function DoctorsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [addModal, setAddModal] = useState(false);
  const { register: registerEdit, handleSubmit: handleEditSubmit } = useForm();
  const { register: registerAdd, handleSubmit: handleAddSubmit, reset: resetAdd } = useForm();

  const { data, isLoading } = useQuery(
    ['doctors', page, categoryFilter, searchText],
    () => meetingsAPI.listDoctors({
      page,
      limit: 20,
      category: categoryFilter || undefined,
      search: searchText || undefined
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const updateMutation = useMutation(
    ({ id, ...data }) => meetingsAPI.updateDoctor(id, data),
    {
      onSuccess: () => {
        toast.success('Doctor updated');
        qc.invalidateQueries('doctors');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const addDoctorMutation = useMutation((data) => meetingsAPI.addDoctor(data), {
    onSuccess: () => {
      toast.success('Doctor added successfully');
      setAddModal(false);
      resetAdd();
      qc.invalidateQueries('doctors');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const sendEmailMutation = useMutation((data) => emailsAPI.sendToDoctor(data), {
    onSuccess: () => {
      toast.success('Email sent successfully to doctor');
      setEmailModalOpen(false);
      setEmailSubject('');
      setEmailMessage('');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Doctor Management</h1>
        <button
          type="button"
          onClick={() => {
            resetAdd();
            setAddModal(true);
          }}
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Doctor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name, specialization..."
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          className="flex-1 border rounded px-3 py-2"
        />
        <select
          value={categoryFilter}
          onChange={(e) => {
            setCategoryFilter(e.target.value);
            setPage(1);
          }}
          className="border rounded px-3 py-2 min-w-fit"
        >
          <option value="">All Categories</option>
          {DOCTOR_CATEGORIES.map(category => (
            <option key={category} value={category}>Category {category}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctors List */}
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Doctors</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.data?.map(doctor => (
              <div
                key={doctor.id}
                onClick={() => setSelectedDoctor(doctor)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedDoctor?.id === doctor.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-sm">Dr. {doctor.name}</div>
                <div className="text-xs text-gray-600 mt-1">{doctor.specialization}</div>
                {doctor.hospital && <div className="text-xs text-gray-500">{doctor.hospital}</div>}
                {doctor.phone && <div className="text-xs text-gray-500">{doctor.phone}</div>}
                <div className="mt-2 flex gap-2">
                  <Badge variant={
                    doctor.category === 'A' ? 'success' :
                    doctor.category === 'B' ? 'info' : 'secondary'
                  }>
                    Category {doctor.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {data?.meta && <Pagination page={data.meta.page} total={data.meta.total} limit={data.meta.limit} onChange={setPage} />}
        </div>

        {/* Doctor Details */}
        <div className="bg-white rounded shadow">
          {selectedDoctor ? (
            <>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">Dr. {selectedDoctor.name}</h2>
              </div>

              <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
                <Tabs.Tab id="overview" title="Overview">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500">Doctor details and contact information.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientEmail(selectedDoctor.email || '');
                          setEmailSubject(`Communication from Healthqubes Eye - Dr. ${selectedDoctor.name}`);
                          setEmailMessage('Dear Dr. ' + selectedDoctor.name + ',\n\nWe are reaching out regarding...');
                          setEmailModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        disabled={!selectedDoctor.email}
                      >
                        Send Email
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Specialization</label>
                        <p>{selectedDoctor.specialization || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Hospital</label>
                        <p>{selectedDoctor.hospital || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p>{selectedDoctor.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p>{selectedDoctor.email || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Address</label>
                      <p>{selectedDoctor.address || 'N/A'}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <p>{selectedDoctor.city || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">State</label>
                        <p>{selectedDoctor.state || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      <Badge variant={
                        selectedDoctor.category === 'A' ? 'success' :
                        selectedDoctor.category === 'B' ? 'info' : 'secondary'
                      }>
                        Category {selectedDoctor.category}
                      </Badge>
                    </div>
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="edit" title="Edit">
                  <form onSubmit={handleEditSubmit((data) => updateMutation.mutate({ id: selectedDoctor.id, ...data }))} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input {...registerEdit('name')} defaultValue={selectedDoctor.name} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Specialization</label>
                        <input {...registerEdit('specialization')} defaultValue={selectedDoctor.specialization} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Hospital</label>
                      <input {...registerEdit('hospital')} defaultValue={selectedDoctor.hospital} className="w-full border rounded px-3 py-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input {...registerEdit('phone')} defaultValue={selectedDoctor.phone} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input {...registerEdit('email')} type="email" defaultValue={selectedDoctor.email} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <textarea {...registerEdit('address')} defaultValue={selectedDoctor.address} className="w-full border rounded px-3 py-2" rows={3} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">City</label>
                        <input {...registerEdit('city')} defaultValue={selectedDoctor.city} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">State</label>
                        <input {...registerEdit('state')} defaultValue={selectedDoctor.state} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Category</label>
                      <select {...registerEdit('category')} defaultValue={selectedDoctor.category} className="w-full border rounded px-3 py-2">
                        {DOCTOR_CATEGORIES.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                      Update Doctor
                    </button>
                  </form>
                </Tabs.Tab>
              </Tabs>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a doctor to view details
            </div>
          )}
        </div>
      </div>

      <Modal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Send Email to Doctor" width="max-w-xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedDoctor) return;
          sendEmailMutation.mutate({
            doctorId: selectedDoctor.id,
            recipientEmail,
            subject: emailSubject,
            message: emailMessage,
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
              rows={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={sendEmailMutation.isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendEmailMutation.isLoading ? 'Sending...' : 'Send Email'}
          </button>
        </form>
      </Modal>

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Doctor" width="max-w-2xl">
        <form onSubmit={handleAddSubmit((data) => addDoctorMutation.mutate(data))} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Doctor Name *</label>
              <input {...registerAdd('name', { required: true })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Specialization</label>
              <input {...registerAdd('specialization')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Hospital</label>
            <input {...registerAdd('hospital')} className="w-full border rounded px-3 py-2" />
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

          <div>
            <label className="block text-sm font-medium mb-1">Address</label>
            <textarea {...registerAdd('address')} className="w-full border rounded px-3 py-2" rows={3} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">City</label>
              <input {...registerAdd('city')} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">State</label>
              <input {...registerAdd('state')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Category</label>
            <select {...registerAdd('category')} className="w-full border rounded px-3 py-2">
              <option value="B">B</option>
              {DOCTOR_CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Add Doctor
          </button>
        </form>
      </Modal>
    </div>
  );
}