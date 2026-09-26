import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: inject access token ─────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response: handle 401 → refresh token ─────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

const processQueue = (error, token = null) => {
  refreshQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;

    if (err.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data;

        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefresh);

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        localStorage.clear();
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;

// ─────────────────────────────────────────────────────────────────────────────
// Typed API methods — one file, all endpoints
// ─────────────────────────────────────────────────────────────────────────────

// Auth
export const authAPI = {
  login:         (data) => api.post('/auth/login', data),
  logout:        (refreshToken) => api.post('/auth/logout', { refreshToken }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// Dashboard
export const dashboardAPI = {
  get: () => api.get('/dashboard'),
};

// Attendance
export const attendanceAPI = {
  checkIn:     (formData) => api.post('/attendance/checkin', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  checkOut:    (data) => api.put('/attendance/checkout', data),
  getToday:    () => api.get('/attendance/today'),
  getHistory:  (params) => api.get('/attendance/history', { params }),
  getTeam:     (params) => api.get('/attendance/team', { params }),
};

// Meetings
export const meetingsAPI = {
  add:          (formData) => api.post('/meetings/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list:         (params) => api.get('/meetings/list', { params }),
  get:          (id) => api.get(`/meetings/${id}`),
  checkout:     (id, data) => api.put(`/meetings/${id}/checkout`, data),
  followUps:    (params) => api.get('/meetings/followups', { params }),
  listDoctors:  (params) => api.get('/meetings/doctors', { params }),
  addDoctor:    (data) => api.post('/meetings/doctors', data),
  updateDoctor: (id, data) => api.put(`/meetings/doctors/${id}`, data),
};

// Location
export const locationAPI = {
  update:     (data) => api.post('/location/update', data),
  getLive:    () => api.get('/location/live'),
  getRoute:   (employeeId, params) => api.get(`/location/route/${employeeId}`, { params }),
  getSummary: (params) => api.get('/location/summary', { params }),
};

// Leads
export const leadsAPI = {
  add:          (formData) => api.post('/leads/add', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  list:         (params) => api.get('/leads/list', { params }),
  get:          (id) => api.get(`/leads/${id}`),
  update:       (id, data) => api.put(`/leads/${id}`, data),
  addActivity:  (id, data) => api.post(`/leads/${id}/activities`, data),
  updateStatus: (id, data) => api.put(`/leads/${id}/status`, data),
  convert:      (id, data) => api.post(`/leads/${id}/convert`, data),
  pipeline:     () => api.get('/leads/pipeline'),
  followUpsDue: () => api.get('/leads/followups-due'),
  eligible:     () => api.get('/leads/eligible'),
};

// Tasks
export const tasksAPI = {
  add:          (data) => api.post('/tasks/add', data),
  list:         (params) => api.get('/tasks/list', { params }),
  updateStatus: (id, data) => api.put(`/tasks/${id}/status`, data),
  getOverdue:   () => api.get('/tasks/overdue'),
};

// Quotations
export const quotationsAPI = {
  add:          (data) => api.post('/quotations/add', data),
  list:         (params) => api.get('/quotations/list', { params }),
  send:         (id, data) => api.put(`/quotations/${id}/send`, data),
  updateStatus: (id, data) => api.put(`/quotations/${id}/status`, data),
};

// Patients
export const patientsAPI = {
  list:            (params) => api.get('/patients/list', { params }),
  get:             (id) => api.get(`/patients/${id}`),
  add:             (data) => api.post('/patients/add', data),
  update:          (id, data) => api.put(`/patients/${id}`, data),
  uploadDoc:       (id, formData) => api.post(`/patients/${id}/documents`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  verifyDoc:       (id, data) => api.put(`/patients/documents/${id}/verify`, data),
  assignHospital:  (id, data) => api.put(`/patients/${id}/assign-hospital`, data),
  assignDoctor:    (id, data) => api.put(`/patients/${id}/assign-doctor`, data),
  assignBoth:      (id, data) => api.put(`/patients/${id}/assign`, data),
  bulkAssign:      (data) => api.post('/patients/bulk-assign', data),
  notifyAssignment: (id, data) => api.post(`/patients/${id}/notify-assignment`, data),
};

export const emailsAPI = {
  sendSummary: (data) => {
    const { attachments, ...emailData } = data;
    if (attachments && attachments.length > 0) {
      const formData = new FormData();
      Object.keys(emailData).forEach(key => {
        formData.append(key, emailData[key]);
      });
      attachments.forEach((attachment, index) => {
        if (attachment.content) {
          formData.append(`attachments`, attachment.content, attachment.filename);
        }
      });
      return api.post('/emails/send-patient-summary', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/emails/send-patient-summary', emailData);
  },
  sendToHospital: (data) => {
    const { attachments, ...emailData } = data;
    if (attachments && attachments.length > 0) {
      const formData = new FormData();
      Object.keys(emailData).forEach(key => {
        formData.append(key, emailData[key]);
      });
      attachments.forEach((attachment, index) => {
        if (attachment.content) {
          formData.append(`attachments`, attachment.content, attachment.filename);
        }
      });
      return api.post('/emails/send-to-hospital', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/emails/send-to-hospital', emailData);
  },
  sendToDoctor: (data) => {
    const { attachments, ...emailData } = data;
    if (attachments && attachments.length > 0) {
      const formData = new FormData();
      Object.keys(emailData).forEach(key => {
        formData.append(key, emailData[key]);
      });
      attachments.forEach((attachment, index) => {
        if (attachment.content) {
          formData.append(`attachments`, attachment.content, attachment.filename);
        }
      });
      return api.post('/emails/send-to-doctor', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    return api.post('/emails/send-to-doctor', emailData);
  },
  logs: (params) => api.get('/emails/logs', { params }),
};

// Hospitals
export const hospitalsAPI = {
  add:          (data) => api.post('/hospitals/add', data),
  list:         (params) => api.get('/hospitals/list', { params }),
  update:       (id, data) => api.put(`/hospitals/${id}`, data),
};

// Treatment Categories
export const treatmentCategoriesAPI = {
  add:          (data) => api.post('/treatment-categories/add', data),
  list:         (params) => api.get('/treatment-categories/list', { params }),
  update:       (id, data) => api.put(`/treatment-categories/${id}`, data),
};

// Sales
export const salesAPI = {
  add:     (data) => api.post('/sales/add', data),
  list:    (params) => api.get('/sales/list', { params }),
  summary: (params) => api.get('/sales/summary', { params }),
};

// Reports
export const reportsAPI = {
  attendance:  (params) => api.get('/reports/attendance', { params }),
  sales:       (params) => api.get('/reports/sales', { params }),
  leads:       (params) => api.get('/reports/leads', { params }),
  performance: (params) => api.get('/reports/performance', { params }),
  tasks:       (params) => api.get('/reports/tasks', { params }),
  quotations:  (params) => api.get('/reports/quotations', { params }),
  patients:    (params) => api.get('/reports/patients', { params }),
};

// Employees
export const employeesAPI = {
  me:           () => api.get('/employees/me'),
  list:         (params) => api.get('/employees/list', { params }),
  get:          (id) => api.get(`/employees/${id}`),
  add:          (data) => api.post('/employees/add', data),
  update:       (id, data) => api.put(`/employees/${id}`, data),
  updateFcm:    (token) => api.put('/employees/me/fcm-token', { fcm_token: token }),
};

// Notifications
export const notificationsAPI = {
  getMy:      (params) => api.get('/notifications/my', { params }),
  send:       (data) => api.post('/notifications/send', data),
  markRead:   (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const productsAPI = {
  list:                  (params) => api.get('/products/list', { params }),
  categories:            ()       => api.get('/products/categories'),
  treatmentCategories:   ()       => api.get('/products/treatment-categories'),
  add:                   (data)   => api.post('/products/add', data),
  update:                (id, data) => api.put(`/products/${id}`, data),
  remove:                (id)     => api.delete(`/products/${id}`),
};

