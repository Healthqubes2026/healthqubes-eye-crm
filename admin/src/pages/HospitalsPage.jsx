import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { hospitalsAPI, emailsAPI } from '../api';
import { PageLoader, Badge, EmptyState, Pagination, Modal, Tabs } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const HOSPITAL_CATEGORIES = ['primary', 'secondary', 'tertiary', 'super_specialty'];

export default function HospitalsPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [addModal, setAddModal] = useState(false);
  const { register: registerEdit, handleSubmit: handleEditSubmit } = useForm();
  const { register: registerAdd, handleSubmit: handleAddSubmit, reset: resetAdd } = useForm();

  const { data, isLoading } = useQuery(
    ['hospitals', page, categoryFilter, searchText],
    () => hospitalsAPI.list({
      page,
      limit: 20,
      category: categoryFilter || undefined,
      search: searchText || undefined
    }).then(r => r.data),
    { keepPreviousData: true }
  );

  const updateMutation = useMutation(
    ({ id, ...data }) => hospitalsAPI.update(id, data),
    {
      onSuccess: () => {
        toast.success('Hospital updated');
        qc.invalidateQueries('hospitals');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  const addHospitalMutation = useMutation((data) => hospitalsAPI.add(data), {
    onSuccess: () => {
      toast.success('Hospital added successfully');
      setAddModal(false);
      resetAdd();
      qc.invalidateQueries('hospitals');
    },
    onError: (err) => toast.error(apiError(err)),
  });

  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');

  const sendEmailMutation = useMutation((data) => emailsAPI.sendToHospital(data), {
    onSuccess: () => {
      toast.success('Email sent successfully to hospital');
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
        <h1 className="text-2xl font-bold">Hospital Management</h1>
        <button
          type="button"
          onClick={() => {
            resetAdd();
            setAddModal(true);
          }}
          className="inline-flex items-center justify-center rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Add Hospital
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name or city..."
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
          {HOSPITAL_CATEGORIES.map(category => (
            <option key={category} value={category}>{category.replace('_', ' ')}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hospitals List */}
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold">Hospitals</h2>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {data?.data?.map(hospital => (
              <div
                key={hospital.id}
                onClick={() => setSelectedHospital(hospital)}
                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                  selectedHospital?.id === hospital.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="font-medium text-sm">{hospital.name}</div>
                <div className="text-xs text-gray-600 mt-1">{hospital.city}, {hospital.state}</div>
                {hospital.phone && <div className="text-xs text-gray-500">{hospital.phone}</div>}
                <div className="mt-2 flex gap-2">
                  <Badge variant={
                    hospital.category === 'tertiary' ? 'success' :
                    hospital.category === 'secondary' ? 'info' :
                    hospital.category === 'primary' ? 'warning' : 'secondary'
                  }>
                    {hospital.category}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          {data?.meta && <Pagination page={data.meta.page} total={data.meta.total} limit={data.meta.limit} onChange={setPage} />}
        </div>

        {/* Hospital Details */}
        <div className="bg-white rounded shadow">
          {selectedHospital ? (
            <>
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold">{selectedHospital.name}</h2>
              </div>

              <Tabs activeTab={activeTab} onTabChange={setActiveTab}>
                <Tabs.Tab id="overview" title="Overview">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="space-y-2">
                        <p className="text-sm text-gray-500">Hospital details and contact information.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setRecipientEmail(selectedHospital.email || '');
                          setEmailSubject(`Communication from Healthqubes Eye - ${selectedHospital.name}`);
                          setEmailMessage('Dear Hospital Administration,\n\nWe are reaching out regarding...');
                          setEmailModalOpen(true);
                        }}
                        className="inline-flex items-center justify-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                        disabled={!selectedHospital.email}
                      >
                        Send Email
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Address</label>
                        <p>{selectedHospital.address || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">City</label>
                        <p>{selectedHospital.city || 'N/A'}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Phone</label>
                        <p>{selectedHospital.phone || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <p>{selectedHospital.email || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Category</label>
                      <Badge variant={
                        selectedHospital.category === 'tertiary' ? 'success' :
                        selectedHospital.category === 'secondary' ? 'info' :
                        selectedHospital.category === 'primary' ? 'warning' : 'secondary'
                      }>
                        {selectedHospital.category}
                      </Badge>
                    </div>

                    {selectedHospital.website && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Website</label>
                        <a href={selectedHospital.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {selectedHospital.website}
                        </a>
                      </div>
                    )}
                  </div>
                </Tabs.Tab>

                <Tabs.Tab id="edit" title="Edit">
                  <form onSubmit={handleEditSubmit((data) => updateMutation.mutate({ id: selectedHospital.id, ...data }))} className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input {...registerEdit('name')} defaultValue={selectedHospital.name} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Phone</label>
                        <input {...registerEdit('phone')} defaultValue={selectedHospital.phone} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Email</label>
                      <input {...registerEdit('email')} type="email" defaultValue={selectedHospital.email} className="w-full border rounded px-3 py-2" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Address</label>
                      <textarea {...registerEdit('address')} defaultValue={selectedHospital.address} className="w-full border rounded px-3 py-2" rows={3} />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">City</label>
                        <input {...registerEdit('city')} defaultValue={selectedHospital.city} className="w-full border rounded px-3 py-2" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">State</label>
                        <input {...registerEdit('state')} defaultValue={selectedHospital.state} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Category</label>
                        <select {...registerEdit('category')} defaultValue={selectedHospital.category} className="w-full border rounded px-3 py-2">
                          {HOSPITAL_CATEGORIES.map(category => (
                            <option key={category} value={category}>{category.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Website</label>
                        <input {...registerEdit('website')} type="url" defaultValue={selectedHospital.website} className="w-full border rounded px-3 py-2" />
                      </div>
                    </div>

                    <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
                      Update Hospital
                    </button>
                  </form>
                </Tabs.Tab>
              </Tabs>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              Select a hospital to view details
            </div>
          )}
        </div>
      </div>

      <Modal open={emailModalOpen} onClose={() => setEmailModalOpen(false)} title="Send Email to Hospital" width="max-w-xl">
        <form onSubmit={(e) => {
          e.preventDefault();
          if (!selectedHospital) return;
          sendEmailMutation.mutate({
            hospitalId: selectedHospital.id,
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

      <Modal open={addModal} onClose={() => setAddModal(false)} title="Add Hospital" width="max-w-2xl">
        <form onSubmit={handleAddSubmit((data) => addHospitalMutation.mutate(data))} className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hospital Name *</label>
              <input {...registerAdd('name', { required: true })} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input {...registerAdd('phone')} className="w-full border rounded px-3 py-2" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input {...registerAdd('email')} type="email" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Website</label>
              <input {...registerAdd('website')} type="url" className="w-full border rounded px-3 py-2" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input {...registerAdd('country')} defaultValue="India" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select {...registerAdd('category')} className="w-full border rounded px-3 py-2">
                <option value="secondary">Secondary</option>
                {HOSPITAL_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
            Add Hospital
          </button>
        </form>
      </Modal>
    </div>
  );
}