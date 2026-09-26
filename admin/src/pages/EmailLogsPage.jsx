import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { emailsAPI } from '../api';
import { PageLoader, EmptyState, Pagination } from '../components/common';
import { fmtDate, apiError } from '../utils/helpers';
import toast from 'react-hot-toast';

export default function EmailLogsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery(
    ['email-logs', page],
    () => emailsAPI.logs({ page, limit: 20 }).then((res) => res.data),
    {
      keepPreviousData: true,
      onError: (err) => toast.error(apiError(err)),
    }
  );

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Email Logs</h1>
          <p className="text-sm text-surface-500 mt-1">Review sent patient summary emails and failures.</p>
        </div>
      </div>

      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <EmptyState title="Unable to load email logs" description="Please try again later." />
      ) : data?.data?.length ? (
        <div className="bg-white rounded shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead className="bg-surface-100 text-surface-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Sent By</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((row) => (
                  <tr key={row.id} className="border-t border-surface-200 hover:bg-surface-50">
                    <td className="px-4 py-3 text-sm text-surface-700">{fmtDate(row.sent_at)}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{row.patient_name || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{row.recipient_email}</td>
                    <td className="px-4 py-3 text-sm text-surface-700">{row.subject}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={row.status === 'sent' ? 'text-emerald-600' : 'text-red-600'}>{row.status}</span>
                      {row.error_message && <div className="text-xs text-surface-500 mt-1">{row.error_message}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-700">{row.sent_by_name || 'System'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.meta && <Pagination page={data.meta.page} total={data.meta.total} limit={data.meta.limit} onChange={setPage} />}
        </div>
      ) : (
        <EmptyState title="No email logs found" description="No patient summary emails have been sent yet." />
      )}
    </div>
  );
}
