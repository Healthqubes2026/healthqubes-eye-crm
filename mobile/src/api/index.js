import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../config';

const api = axios.create({
  baseURL: Config.API_URL,
  timeout: Config.API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ── Inject access token on every request ─────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Auto-refresh on 401 ───────────────────────────────────────────────────────
let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => queue.push({ resolve, reject }))
          .then((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${Config.API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;
        await AsyncStorage.multiSet([['accessToken', accessToken], ['refreshToken', newRefresh]]);
        processQueue(null, accessToken);
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'employee']);
        // Navigation reset handled by auth store listener
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(err);
  }
);

export default api;

// ─── Typed API methods ────────────────────────────────────────────────────────

export const authAPI = {
  login:     (d) => api.post('/auth/login', d),
  logout:    (refreshToken) => api.post('/auth/logout', { refreshToken }),
};

export const attendanceAPI = {
  checkIn:   (fd) => api.post('/attendance/checkin', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  checkOut:  (d) => api.put('/attendance/checkout', d),
  getToday:  () => api.get('/attendance/today'),
  getHistory:(p) => api.get('/attendance/history', { params: p }),
  applyLeave:(d) => api.post('/attendance/leave', d),
};

export const meetingsAPI = {
  add:         (fd) => api.post('/meetings/add', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list:        (p) => api.get('/meetings/list', { params: p }),
  checkout:    (id, d) => api.put(`/meetings/${id}/checkout`, d),
  followUps:   () => api.get('/meetings/followups'),
  listDoctors: (p) => api.get('/meetings/doctors', { params: p }),
  addDoctor:   (d) => api.post('/meetings/doctors', d),
};

export const locationAPI = {
  update: (d) => api.post('/location/update', d),
};

export const leadsAPI = {
  add:          (fd) => api.post('/leads/add', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list:         (p) => api.get('/leads/list', { params: p }),
  updateStatus: (id, d) => api.put(`/leads/${id}/status`, d),
  pipeline:     () => api.get('/leads/pipeline'),
  followUpsDue: () => api.get('/leads/followups-due'),
};

export const salesAPI = {
  add:  (d) => api.post('/sales/add', d),
  list: (p) => api.get('/sales/list', { params: p }),
};

export const employeesAPI = {
  me:        () => api.get('/employees/me'),
  updateFcm: (token) => api.put('/employees/me/fcm-token', { fcm_token: token }),
};

export const notificationsAPI = {
  getMy:      (p) => api.get('/notifications/my', { params: p }),
  markRead:   (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};
