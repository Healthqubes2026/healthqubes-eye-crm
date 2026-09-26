// Tab and role configuration
import {
  BarChart2,
  CheckSquare,
  DollarSign,
  FileText,
  HeartPulse,
  Building2,
  LayoutDashboard,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Stethoscope,
  User,
  Users,
} from 'lucide-react';

export const ROLES = ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'];

export const TABS = [
  // Overview
  { id: 'dashboard', label: 'Dashboard', route: '/', icon: LayoutDashboard, group: 'Overview', defaultRoles: ['admin', 'management', 'manager'], description: 'Dashboard statistics & summary' },
  { id: 'location', label: 'Live Location', route: '/location', icon: MapPin, group: 'Overview', defaultRoles: ['admin', 'management', 'manager'], badge: 'live', description: 'Agent location tracking in real-time' },

  // Medical Tourism
  { id: 'leads', label: 'Leads', route: '/leads', icon: Users, group: 'Medical Tourism', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'], description: 'Manage all incoming patient leads' },
  { id: 'patients', label: 'Patients', route: '/patients', icon: HeartPulse, group: 'Medical Tourism', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'], description: 'Patient records and treatment tracking' },
  { id: 'tasks', label: 'Tasks', route: '/tasks', icon: CheckSquare, group: 'Medical Tourism', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'], description: 'Task assignments and progress updates' },
  { id: 'quotations', label: 'Quotations', route: '/quotations', icon: FileText, group: 'Medical Tourism', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'], description: 'Create and approve price quotations' },

  // Field Ops
  { id: 'meetings', label: 'Doctor Meetings', route: '/meetings', icon: Stethoscope, group: 'Field Ops', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager', 'field_agent'], description: 'Schedule and manage doctor meetings' },
  { id: 'sales', label: 'Sales', route: '/sales', icon: DollarSign, group: 'Field Ops', defaultRoles: ['admin', 'management', 'manager'], description: 'Monitor sales performance and targets' },

  // Management
  { id: 'employees', label: 'Employees', route: '/employees', icon: User, group: 'Management', defaultRoles: ['admin', 'management', 'manager'], description: 'Manage team members and roles' },
  { id: 'reports', label: 'Reports', route: '/reports', icon: BarChart2, group: 'Management', defaultRoles: ['admin', 'management', 'manager'], description: 'View performance analytics and reports' },
  { id: 'ad-integrations', label: 'Ad Integrations', route: '/ad-integrations', icon: Megaphone, group: 'Management', defaultRoles: ['admin', 'management', 'manager'], description: 'Manage campaign and ad integrations' },
  { id: 'products', label: 'Products', route: '/products', icon: Building2, group: 'Management', defaultRoles: ['admin', 'management', 'manager'], description: 'Manage packages and product catalog' },
  { id: 'whatsapp', label: 'WhatsApp', route: '/whatsapp', icon: MessageSquare, group: 'Management', defaultRoles: ['admin', 'management', 'manager', 'sales_coordinator', 'case_manager'], description: 'Send WhatsApp messages and alerts' },
  { id: 'email-logs', label: 'Email Logs', route: '/email-logs', icon: Mail, group: 'Management', defaultRoles: ['admin', 'management', 'manager'], description: 'View email history and logs' },
];

export const getTabsByGroup = () => {
  const groups = {};
  TABS.forEach(tab => {
    if (!groups[tab.group]) groups[tab.group] = [];
    groups[tab.group].push(tab);
  });
  return groups;
};
