/**
 * syncService.js
 * Listens for network reconnection and replays the offline queue.
 * Supports: attendance check-in/out, meetings, leads, sales.
 */
import NetInfo from '@react-native-community/netinfo';
import { attendanceAPI, meetingsAPI, leadsAPI, salesAPI } from '../api';
import { getUnsynced, markSynced, incrementRetry } from '../store/offlineDB';
import { syncCachedLocations } from './locationService';

const HANDLERS = {
  attendance_checkin:  (p) => attendanceAPI.checkIn(p),
  attendance_checkout: (p) => attendanceAPI.checkOut(p),
  meeting_add:         (p) => meetingsAPI.add(p),
  lead_add:            (p) => leadsAPI.add(p),
  lead_status:         (p) => leadsAPI.updateStatus(p.id, p),
  sale_add:            (p) => salesAPI.add(p),
};

let unsubscribe = null;

export const startSyncService = () => {
  // Immediate attempt on start
  syncAll();

  // Listen for reconnection
  unsubscribe = NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      await syncAll();
    }
  });
};

export const stopSyncService = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
};

export const syncAll = async () => {
  // Sync location pings first
  try { await syncCachedLocations(); } catch (_) {}

  // Then replay the general queue
  const items = await getUnsynced();
  for (const item of items) {
    const handler = HANDLERS[item.type];
    if (!handler) {
      await markSynced(item.id);
      continue;
    }
    try {
      const payload = JSON.parse(item.payload);
      await handler(payload);
      await markSynced(item.id);
    } catch (err) {
      await incrementRetry(item.id);
      // If server returns 4xx, mark as synced (won't succeed on retry)
      if (err.response?.status >= 400 && err.response?.status < 500) {
        await markSynced(item.id);
      }
    }
  }
};
