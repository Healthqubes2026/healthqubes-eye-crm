import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import toast from 'react-hot-toast';
import { Send, MessageSquare, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { Badge, Spinner } from '../components/common';
import api from '../api';

const whatsappApi = {
  sendMessage: async (phone, message) => {
    const { data } = await api.post('/whatsapp/send', { phone, message });
    return data;
  },
  getMessageLogs: async () => {
    const { data } = await api.get('/whatsapp/logs');
    return data;
  }
};

export default function WhatsAppPage() {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('custom');

  const { data: logsData, isLoading: logsLoading, refetch } = useQuery(
    'whatsapp-logs',
    whatsappApi.getMessageLogs,
    { refetchInterval: 30000 }
  );

  const sendMutation = useMutation(
    () => whatsappApi.sendMessage(phone, message),
    {
      onSuccess: (data) => {
        if (data.success) {
          toast.success('Message sent!');
          setPhone('');
          setMessage('');
          refetch();
        } else {
          toast.error(data.message || 'Failed to send message');
        }
      },
      onError: (err) => toast.error('Error sending message')
    }
  );

  const templates = {
    custom: '',
    welcome: 'Hi! 👋 Welcome to Healthqube Eyes. We\'re excited to help you with your eye care journey.',
    followup: 'Just a reminder about our scheduled follow-up. Please confirm your availability.',
    quotation: 'Your personalized quotation for eye treatment is ready! Please review and let us know if you have questions.'
  };

  const handleSend = () => {
    if (!phone.trim() || !message.trim()) {
      toast.error('Phone and message required');
      return;
    }
    sendMutation.mutate();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'green';
      case 'delivered': return 'blue';
      case 'received': return 'purple';
      case 'failed': return 'red';
      case 'read': return 'emerald';
      default: return 'gray';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <Clock size={16} />;
      case 'delivered': return <CheckCircle size={16} />;
      case 'received': return <MessageSquare size={16} />;
      case 'failed': return <AlertCircle size={16} />;
      case 'read': return <CheckCircle size={16} />;
      default: return <MessageSquare size={16} />;
    }
  };

  const getDirectionIcon = (direction) => {
    return direction === 'incoming' ? '📥' : '📤';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">WhatsApp Communication</h1>
          <p className="text-sm text-surface-500 mt-0.5">Send messages directly to patients via WhatsApp</p>
        </div>
        <MessageSquare className="text-brand-500" size={32} />
      </div>

      {/* Send Message Card */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">Send WhatsApp Message</h2>

        {/* Phone Input */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Patient Phone Number
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Enter phone number (with country code)"
            className="w-full px-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          <p className="text-xs text-surface-500 mt-1">Include country code: +91XXXXXXXXXX</p>
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Message Template
          </label>
          <div className="grid grid-cols-4 gap-2">
            {Object.keys(templates).map(key => (
              <button
                key={key}
                onClick={() => {
                  setSelectedTemplate(key);
                  if (key !== 'custom') {
                    setMessage(templates[key]);
                  }
                }}
                className={`p-2 rounded-lg text-sm font-medium transition ${
                  selectedTemplate === key
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                }`}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Message Input */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-2">
            Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message here..."
            rows="5"
            className="w-full px-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-surface-500 mt-1">
            {message.length}/4096 characters
          </p>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={sendMutation.isLoading}
          className="w-full bg-brand-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-brand-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sendMutation.isLoading ? (
            <>
              <Spinner size="sm" />
              Sending...
            </>
          ) : (
            <>
              <Send size={20} />
              Send Message
            </>
          )}
        </button>
      </div>

      {/* Message Logs */}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-surface-900">Message History</h2>

        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : logsData?.data?.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="px-4 py-3 text-left font-semibold text-surface-700">Direction</th>
                  <th className="px-4 py-3 text-left font-semibold text-surface-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-surface-700">Message</th>
                  <th className="px-4 py-3 text-left font-semibold text-surface-700">Status</th>
                  <th className="px-4 py-3 text-left font-semibold text-surface-700">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {logsData.data.map((msg) => (
                  <tr key={msg.id} className="hover:bg-surface-50">
                    <td className="px-4 py-3 text-center">
                      <span className="text-lg">{getDirectionIcon(msg.direction)}</span>
                      <span className="text-xs text-surface-500 block">
                        {msg.direction === 'incoming' ? 'Incoming' : 'Outgoing'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-surface-900">{msg.phone}</td>
                    <td className="px-4 py-3 text-surface-600 truncate max-w-xs">
                      {msg.message}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={getStatusColor(msg.status)}>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(msg.status)}
                          {msg.status}
                        </div>
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-surface-500 text-xs">
                      {new Date(msg.created_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-center text-surface-500 py-8">No messages sent yet</p>
        )}
      </div>

      {/* Usage Info */}
      <div className="card p-6 bg-gradient-to-r from-brand-50 to-brand-100 border border-brand-200 space-y-4">
        <h3 className="font-semibold text-brand-900">WhatsApp Integration Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium text-brand-800">📤 Outgoing Messages</h4>
            <ul className="space-y-1 text-sm text-brand-700">
              <li>✅ Send messages to patients/leads</li>
              <li>✅ Pre-built message templates</li>
              <li>✅ Bulk messaging capability</li>
              <li>✅ Delivery status tracking</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-brand-800">📥 Incoming Messages</h4>
            <ul className="space-y-1 text-sm text-brand-700">
              <li>✅ Auto-create leads from inquiries</li>
              <li>✅ Link messages to existing patients</li>
              <li>✅ Automatic welcome responses</li>
              <li>✅ Webhook-based message handling</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 p-3 bg-white/50 rounded-lg">
          <p className="text-sm text-brand-800">
            <strong>Webhook Setup:</strong> Configure <code className="bg-white px-1 rounded">POST /api/v1/whatsapp/webhook</code> 
            in Twilio Console to enable incoming message processing.
          </p>
        </div>
      </div>
    </div>
  );
}
