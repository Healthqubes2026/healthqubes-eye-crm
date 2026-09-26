import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './hooks/useAuthStore';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import MeetingsPage from './pages/MeetingsPage';
import LeadsPage from './pages/LeadsPage';
import SalesPage from './pages/SalesPage';
import LocationPage from './pages/LocationPage';
import { EmployeesPage } from './pages/EmployeesPage';
import ReportsPage from './pages/ReportsPage';
import ProductsPage from './pages/ProductsPage';
import TasksPage from './pages/TasksPage';
import QuotationsPage from './pages/QuotationsPage';
import PatientsPageEnhanced from './pages/PatientsPageEnhanced';
import EmailLogsPage from './pages/EmailLogsPage';
import AdIntegrationsPage from './pages/AdIntegrationsPage';
import WhatsAppPage from './pages/WhatsAppPage';
import TabAccessControlPage from './pages/TabAccessControlPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

const ProtectedRoute = ({ children }) => {
  const { accessToken, employee } = useAuthStore();
  if (!accessToken || !employee) return <Navigate to="/login" replace />;
  return children;
};

const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const { employee, logout } = useAuthStore();
  if (!allowedRoles.includes(employee?.role)) {
    logout();
    return <Navigate to="/login" replace />;
  }
  return children;
};

const PublicRoute = ({ children }) => {
  const { accessToken, employee } = useAuthStore();
  if (accessToken && employee) return <Navigate to="/" replace />;
  return children;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route index                      element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><DashboardPage /></RoleProtectedRoute>} />
            <Route path="meetings"            element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent']}><MeetingsPage /></RoleProtectedRoute>} />
            <Route path="leads"               element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent']}><LeadsPage /></RoleProtectedRoute>} />
            <Route path="sales"               element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><SalesPage /></RoleProtectedRoute>} />
            <Route path="location"            element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><LocationPage /></RoleProtectedRoute>} />
            <Route path="employees"           element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><EmployeesPage /></RoleProtectedRoute>} />
            <Route path="reports"             element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><ReportsPage /></RoleProtectedRoute>} />
            <Route path="ad-integrations"    element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><AdIntegrationsPage /></RoleProtectedRoute>} />
            <Route path="email-logs"          element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><EmailLogsPage /></RoleProtectedRoute>} />
            <Route path="products"            element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager']}><ProductsPage /></RoleProtectedRoute>} />
            <Route path="tasks"               element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent']}><TasksPage /></RoleProtectedRoute>} />
            <Route path="quotations"          element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent']}><QuotationsPage /></RoleProtectedRoute>} />
            <Route path="patients"            element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent']}><PatientsPageEnhanced /></RoleProtectedRoute>} />
            <Route path="whatsapp"            element={<RoleProtectedRoute allowedRoles={['admin', 'management', 'manager', 'sales_coordinator', 'case_manager']}><WhatsAppPage /></RoleProtectedRoute>} />
            <Route path="tab-access-control"  element={<RoleProtectedRoute allowedRoles={['admin']}><TabAccessControlPage /></RoleProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            background: '#1F2937',
            color: '#F9FAFB',
            fontSize: '13px',
            borderRadius: '10px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#34D399', secondary: '#1F2937' } },
          error:   { iconTheme: { primary: '#F87171', secondary: '#1F2937' } },
        }}
      />
    </QueryClientProvider>
  );
}
