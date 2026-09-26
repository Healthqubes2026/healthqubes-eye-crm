/**
 * locationService.js
 * Handles:
 *  - Foreground GPS position capture
 *  - Background fetch every 3 minutes (via react-native-background-fetch)
 *  - Offline queue via SQLite when network is unavailable
 *  - Auto-sync of cached pings when internet returns
 */
import Geolocation from '@react-native-community/geolocation';
import BackgroundFetch from 'react-native-background-fetch';
import NetInfo from '@react-native-community/netinfo';
import { locationAPI } from '../api';
import { cacheLocation, getUnsyncedLocations, markLocationSynced } from '../store/offlineDB';
import Config from '../config';

// ── Get current position (promise wrapper) ───────────────────────────────────
export const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });

// ── Post a GPS ping (with offline fallback) ───────────────────────────────────
export const postLocationPing = async (coords) => {
  const payload = {
    lat:      coords.latitude,
    lng:      coords.longitude,
    accuracy: coords.accuracy,
    speed:    coords.speed,
    heading:  coords.heading,
  };

  const net = await NetInfo.fetch();
  if (net.isConnected) {
    try {
      await locationAPI.update(payload);
      // Try to flush any cached pings too
      await syncCachedLocations();
    } catch (_) {
      await cacheLocation(payload);
    }
  } else {
    await cacheLocation(payload);
  }
};

// ── Sync SQLite-cached pings to server ───────────────────────────────────────
export const syncCachedLocations = async () => {
  const pending = await getUnsyncedLocations();
  for (const row of pending) {
    try {
      await locationAPI.update({
        lat:      row.lat,
        lng:      row.lng,
        accuracy: row.accuracy,
        speed:    row.speed,
      });
      await markLocationSynced(row.id);
    } catch (_) {
      break; // stop on first failure; retry next cycle
    }
  }
};

// ── Configure background fetch (every 3 minutes) ─────────────────────────────
export const configureBackgroundFetch = async (getToken) => {
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 3,          // minutes (iOS minimum = 15, Android can be 3)
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
      requiredNetworkType: BackgroundFetch.NETWORK_TYPE_ANY,
    },
    async (taskId) => {
      const token = await getToken();
      if (!token) {
        BackgroundFetch.finish(taskId);
        return;
      }
      try {
        const coords = await getCurrentPosition();
        await postLocationPing(coords);
      } catch (_) {}
      BackgroundFetch.finish(taskId);
    },
    (taskId) => {
      // Timeout handler
      BackgroundFetch.finish(taskId);
    }
  );

  BackgroundFetch.start();
};

export const stopBackgroundFetch = () => BackgroundFetch.stop();
