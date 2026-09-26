import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import api from '../api';
import { PageLoader, Badge, Modal } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';

export default function AdIntegrationsPage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('integrations');
  const [facebookModal, setFacebookModal] = useState(false);
  const [googleModal, setGoogleModal] = useState(false);
  const [webhookModal, setWebhookModal] = useState(null);

  const { register: facebookRegister, handleSubmit: handleFacebookSubmit, reset: resetFacebook } = useForm();
  const { register: googleRegister, handleSubmit: handleGoogleSubmit, reset: resetGoogle } = useForm();

  // Fetch integrations
  const { data, isLoading } = useQuery(
    'ad-integrations',
    () => api.get('/ads/integrations').then(r => r.data.data),
    { staleTime: 60000 }
  );

  // Connect Facebook
  const facebookMutation = useMutation(
    (data) => api.post('/ads/integrations/connect-facebook', data),
    {
      onSuccess: () => {
        toast.success('Facebook connected successfully!');
        resetFacebook();
        setFacebookModal(false);
        qc.invalidateQueries('ad-integrations');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  // Connect Google
  const googleMutation = useMutation(
    (data) => api.post('/ads/integrations/connect-google', data),
    {
      onSuccess: () => {
        toast.success('Google Ads connected successfully!');
        resetGoogle();
        setGoogleModal(false);
        qc.invalidateQueries('ad-integrations');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  // Disconnect integration
  const disconnectMutation = useMutation(
    (id) => api.delete(`/ads/integrations/${id}`),
    {
      onSuccess: () => {
        toast.success('Integration disconnected');
        qc.invalidateQueries('ad-integrations');
      },
      onError: (err) => toast.error(apiError(err)),
    }
  );

  // Get webhook URL
  const getWebhookUrl = async (integrationId) => {
    try {
      const res = await api.get(`/ads/integrations/${integrationId}/webhook-url`);
      setWebhookModal(res.data.data);
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  if (isLoading) return <PageLoader />;

  const facebookIntegration = data?.find(i => i.type === 'facebook');
  const googleIntegration = data?.find(i => i.type === 'google_ads');

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Ad Integrations</h1>
        <p className="text-gray-600 mt-1">Connect Facebook Ads and Google Ads to automatically capture leads in real-time</p>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Facebook Card */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">f</div>
              <div>
                <h3 className="font-bold">Facebook Ads</h3>
                <p className="text-sm text-gray-600">Lead Form Integration</p>
              </div>
            </div>
            {facebookIntegration?.is_active && (
              <Badge variant="success">Connected</Badge>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Automatically capture leads from Facebook Lead Forms and sync them to your CRM
          </p>

          <div className="space-y-2 mb-4">
            {facebookIntegration?.is_active ? (
              <>
                <p className="text-sm"><strong>Business ID:</strong> {facebookIntegration.business_id}</p>
                <p className="text-sm"><strong>Last Sync:</strong> {facebookIntegration.last_sync ? fmtDate(facebookIntegration.last_sync) : 'Never'}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>

          <div className="flex gap-2">
            {facebookIntegration?.is_active ? (
              <>
                <button
                  onClick={() => getWebhookUrl(facebookIntegration.id)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Webhook Setup
                </button>
                <button
                  onClick={() => disconnectMutation.mutate(facebookIntegration.id)}
                  className="flex-1 border border-red-400 text-red-600 px-4 py-2 rounded hover:bg-red-50 text-sm"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => setFacebookModal(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Connect
              </button>
            )}
          </div>
        </div>

        {/* Google Card */}
        <div className="border rounded-lg p-6 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="text-3xl">G</div>
              <div>
                <h3 className="font-bold">Google Ads</h3>
                <p className="text-sm text-gray-600">Lead Form Extension</p>
              </div>
            </div>
            {googleIntegration?.is_active && (
              <Badge variant="success">Connected</Badge>
            )}
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Capture leads directly from Google Lead Form Extensions and Google Local Services Ads
          </p>

          <div className="space-y-2 mb-4">
            {googleIntegration?.is_active ? (
              <>
                <p className="text-sm"><strong>Customer ID:</strong> {googleIntegration.platform_id}</p>
                <p className="text-sm"><strong>Last Sync:</strong> {googleIntegration.last_sync ? fmtDate(googleIntegration.last_sync) : 'Never'}</p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Not connected</p>
            )}
          </div>

          <div className="flex gap-2">
            {googleIntegration?.is_active ? (
              <>
                <button
                  onClick={() => getWebhookUrl(googleIntegration.id)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm"
                >
                  Webhook Setup
                </button>
                <button
                  onClick={() => disconnectMutation.mutate(googleIntegration.id)}
                  className="flex-1 border border-red-400 text-red-600 px-4 py-2 rounded hover:bg-red-50 text-sm"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={() => setGoogleModal(true)}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Connect
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Features List */}
      <div className="bg-white rounded-lg p-6 mb-6">
        <h3 className="text-lg font-bold mb-4">Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex gap-3">
            <div className="text-xl">✅</div>
            <div>
              <p className="font-medium">Real-Time Lead Capture</p>
              <p className="text-sm text-gray-600">Leads automatically created as soon as forms submitted</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-xl">✅</div>
            <div>
              <p className="font-medium">Duplicate Detection</p>
              <p className="text-sm text-gray-600">Automatically detects and prevents duplicate leads</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-xl">✅</div>
            <div>
              <p className="font-medium">UTM Tracking</p>
              <p className="text-sm text-gray-600">Automatically captures campaign and source data</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-xl">✅</div>
            <div>
              <p className="font-medium">Auto Assignment</p>
              <p className="text-sm text-gray-600">New leads assigned to coordinators automatically</p>
            </div>
          </div>
        </div>
      </div>

      {/* Facebook Connect Modal */}
      <Modal open={facebookModal} onClose={() => setFacebookModal(false)} title="Connect Facebook Ads">
        <form onSubmit={handleFacebookSubmit((data) => facebookMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Business ID</label>
            <input
              {...facebookRegister('businessId', { required: 'Business ID required' })}
              placeholder="Your Facebook Business ID"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Find in Facebook Business Settings > Business Info</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input
              {...facebookRegister('accessToken', { required: 'Access Token required' })}
              type="password"
              placeholder="Your Facebook Access Token"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Get from Facebook Graph API Explorer or Business SDK</p>
          </div>
          <button
            type="submit"
            disabled={facebookMutation.isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {facebookMutation.isLoading ? 'Connecting...' : 'Connect Facebook'}
          </button>
        </form>
      </Modal>

      {/* Google Connect Modal */}
      <Modal open={googleModal} onClose={() => setGoogleModal(false)} title="Connect Google Ads">
        <form onSubmit={handleGoogleSubmit((data) => googleMutation.mutate(data))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Customer ID</label>
            <input
              {...googleRegister('customerId', { required: 'Customer ID required' })}
              placeholder="Your Google Ads Customer ID"
              className="w-full border rounded px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Format: 1234567890 (without dashes)</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Access Token</label>
            <input
              {...googleRegister('accessToken', { required: 'Access Token required' })}
              type="password"
              placeholder="Your Google OAuth Access Token"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Refresh Token (Optional)</label>
            <input
              {...googleRegister('refreshToken')}
              type="password"
              placeholder="Your Google OAuth Refresh Token"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            disabled={googleMutation.isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {googleMutation.isLoading ? 'Connecting...' : 'Connect Google Ads'}
          </button>
        </form>
      </Modal>

      {/* Webhook Setup Modal */}
      <Modal
        open={!!webhookModal}
        onClose={() => setWebhookModal(null)}
        title={`${webhookModal?.platform?.toUpperCase() || ''} Webhook Setup`}
        width="max-w-2xl"
      >
        {webhookModal && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <p className="font-bold text-sm mb-3">Webhook URL:</p>
              <div className="relative">
                <code className="bg-white border rounded p-2 block text-xs break-all">
                  {webhookModal.webhookUrl}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookModal.webhookUrl);
                    toast.success('Copied to clipboard!');
                  }}
                  className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs"
                >
                  Copy
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-bold mb-3">Setup Instructions:</h4>
              <ol className="space-y-2 text-sm">
                {webhookModal.instructions?.steps?.map((step, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-bold text-gray-400 min-w-fit">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
              <p className="font-bold mb-1">Important:</p>
              <p>After configuring the webhook in your ad platform, a test request will be sent to verify connectivity.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
