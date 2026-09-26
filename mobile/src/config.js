const Config = {
  // ← Change to your backend IP/domain before building APK
 API_URL: 'http://192.168.31.23:5000/api/v1',
UPLOAD_URL: 'http://192.168.31.23:5000',
  APP_NAME: 'Healthqube Eyes',
  // GPS tracking — every 3 minutes
  LOCATION_INTERVAL_MS: 3 * 60 * 1000,

  // Late check-in cutoff: 09:30
  LATE_HOUR: 9,
  LATE_MINUTE: 30,

  // Offline sync retry
  SYNC_INTERVAL_MS: 2 * 60 * 1000,

  API_TIMEOUT_MS: 15000,
};

export default Config;
