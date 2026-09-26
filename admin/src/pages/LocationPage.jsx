import React from 'react';
import { useQuery } from 'react-query';
import { locationAPI } from '../api';
import { StatCard, PageLoader, LiveDot, Badge } from '../components/common';
import { Avatar } from '../components/common';
import { fmtRelative } from '../utils/helpers';

export default function LocationPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery(
    'live-locations',
    () => locationAPI.getLive().then(r => r.data),
    { refetchInterval: 30000 }
  );

  const locations = data?.data || [];
  const activeCount = locations.filter(l => l.minutes_ago <= 5).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Live Location</h1>
          <p className="text-sm text-surface-500 mt-0.5">Real-time GPS tracking · refreshes every 30 seconds</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <LiveDot /> Live · {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Active Now"     value={activeCount}      subVariant="up" sub="Last 5 minutes" icon={<span>📍</span>} iconBg="bg-emerald-50" />
        <StatCard label="In Field"       value={locations.length} sub="Last 15 min GPS ping"           icon={<span>🗺</span>} iconBg="bg-brand-50" />
        <StatCard label="Avg Battery"    value={
          locations.length
            ? `${Math.round(locations.reduce((a,l) => a + (l.battery||0), 0) / locations.length)}%`
            : '—'
        } icon={<span>🔋</span>} iconBg="bg-amber-50" />
        <StatCard label="Last Sync"      value="30s"              sub="Auto-refresh interval"          icon={<span>🔄</span>} iconBg="bg-purple-50" />
      </div>

      {/* Map placeholder — integrate react-leaflet with real coords */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-surface-900">Field Map</h3>
          <span className="text-xs text-surface-500 bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
            Connect Google Maps API key in .env to enable live map
          </span>
        </div>
        <div className="bg-surface-50 rounded-xl h-72 flex items-center justify-center border-2 border-dashed border-surface-200 relative overflow-hidden">
          {/* Simulated grid map */}
          <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 600 300">
            {Array.from({length:15}, (_,i) => <line key={`v${i}`} x1={i*40} y1="0" x2={i*40} y2="300" stroke="#6B7280" strokeWidth="0.5"/>)}
            {Array.from({length:8}, (_,i)  => <line key={`h${i}`} x1="0" y1={i*40} x2="600" y2={i*40} stroke="#6B7280" strokeWidth="0.5"/>)}
          </svg>
          {/* Render dots for each employee */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 300">
            {locations.slice(0,12).map((loc, i) => {
              const x = 60 + (i % 6) * 90 + Math.sin(i * 1.3) * 20;
              const y = 60 + Math.floor(i / 6) * 100 + Math.cos(i * 0.9) * 20;
              const colors = ['#2E6BE6','#0F8C6A','#D97706','#7C3AED','#DC2626','#0891B2'];
              const c = colors[i % colors.length];
              const isActive = loc.minutes_ago <= 5;
              return (
                <g key={loc.id}>
                  {isActive && <circle cx={x} cy={y} r="14" fill={c} opacity="0.15">
                    <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.2;0.05;0.2" dur="2s" repeatCount="indefinite"/>
                  </circle>}
                  <circle cx={x} cy={y} r="6" fill={c} />
                  <circle cx={x} cy={y} r="3" fill="white" />
                  <rect x={x+10} y={y-12} width={loc.name?.split(' ')[0].length * 7 + 8} height="18" rx="4" fill="white" stroke="#E0E2E9" strokeWidth="1"/>
                  <text x={x+14} y={y} fontSize="9" fill="#374151" fontWeight="500">{loc.name?.split(' ')[0]}</text>
                </g>
              );
            })}
          </svg>
          {isLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/80"><PageLoader /></div>}
          {!isLoading && locations.length === 0 && (
            <div className="text-center z-10">
              <p className="text-3xl mb-2">🗺</p>
              <p className="text-sm font-medium text-surface-700">No active field agents</p>
              <p className="text-xs text-surface-500 mt-1">Agents appear when they share their GPS location</p>
            </div>
          )}
        </div>
      </div>

      {/* Location log table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-900">Active Agents</h3>
          <span className="text-xs text-surface-500">{locations.length} agents tracked</span>
        </div>
        <div className="divide-y divide-surface-50">
          {isLoading ? <PageLoader /> : locations.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-xs text-surface-500">No location data in last 15 minutes</p>
            </div>
          ) : locations.map((loc) => (
            <div key={loc.id} className="flex items-center gap-4 px-5 py-3.5">
              <Avatar name={loc.name} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-900">{loc.name}</p>
                <p className="text-xs text-surface-500 truncate">{loc.address || `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}`}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="flex items-center gap-1.5 justify-end">
                  {loc.minutes_ago <= 5 ? <LiveDot /> : <span className="w-2 h-2 rounded-full bg-surface-300 inline-block" />}
                  <span className="text-xs text-surface-600">{fmtRelative(loc.recorded_at)}</span>
                </div>
                <div className="flex gap-2 mt-1 justify-end">
                  {loc.battery != null && (
                    <span className={`text-xs ${loc.battery < 20 ? 'text-red-500' : 'text-surface-500'}`}>
                      🔋{loc.battery}%
                    </span>
                  )}
                  {loc.speed != null && <span className="text-xs text-surface-500">{Math.round(loc.speed)} km/h</span>}
                </div>
              </div>
              <Badge variant={loc.minutes_ago <= 5 ? 'green' : loc.minutes_ago <= 15 ? 'amber' : 'gray'}>
                {loc.minutes_ago <= 5 ? 'Active' : loc.minutes_ago <= 15 ? 'Idle' : 'Away'}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
