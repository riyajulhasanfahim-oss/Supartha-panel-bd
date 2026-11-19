import type { AdminSectionId } from '../components/admin/AdminNavTypes';
import type { AdminStaffRole } from './firestore/collections';

export interface AdminPermissions {
  role: AdminStaffRole;
  label: string;
  allowedSections: AdminSectionId[];
  canManageFirebase: boolean;
  canManageStaff: boolean;
  canManageSystemLifecycle: boolean;
  canManageSettings: boolean;
  canManageUsers: boolean;
  canEditUsers: boolean;
  canManageServices: boolean;
  canManageCategories: boolean;
  canManageOrders: boolean;
  canEditOrders: boolean;
  canManageProviders: boolean;
  canManagePayments: boolean;
  canManagePaymentMethods: boolean;
  canManageTickets: boolean;
  canSendNotifications: boolean;
  canViewAuditLogs: boolean;
}

const ALL_SECTIONS: AdminSectionId[] = [
  'dashboard',
  'users',
  'services',
  'categories',
  'orders',
  'payments',
  'payment-methods',
  'transactions',
  'providers',
  'api-gateway',
  'tickets',
  'notifications',
  'audit-logs',
  'settings',
  'firebase',
  'system-info',
  'staff',
  'profile',
];

const ADMIN_SECTIONS: AdminSectionId[] = [
  'dashboard',
  'users',
  'services',
  'categories',
  'orders',
  'payments',
  'payment-methods',
  'transactions',
  'providers',
  'api-gateway',
  'tickets',
  'notifications',
  'audit-logs',
  'settings',
  'firebase',
  'system-info',
  'staff',
  'profile',
];

const MANAGER_SECTIONS: AdminSectionId[] = [
  'dashboard',
  'orders',
  'services',
  'categories',
  'providers',
  'users',
  'profile',
];

const SUPPORT_SECTIONS: AdminSectionId[] = [
  'dashboard',
  'tickets',
  'orders',
  'notifications',
  'profile',
];

export function getAdminRoleLabel(role: AdminStaffRole | null | undefined): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'manager':
      return 'Manager';
    case 'support_staff':
      return 'Support Staff';
    default:
      return 'Customer';
  }
}

export function getAdminPermissions(role: AdminStaffRole | null | undefined): AdminPermissions {
  if (role === 'super_admin') {
    return {
      role: 'super_admin',
      label: 'Super Admin',
      allowedSections: ALL_SECTIONS,
      canManageFirebase: true,
      canManageStaff: true,
      canManageSystemLifecycle: true,
      canManageSettings: true,
      canManageUsers: true,
      canEditUsers: true,
      canManageServices: true,
      canManageCategories: true,
      canManageOrders: true,
      canEditOrders: true,
      canManageProviders: true,
      canManagePayments: true,
      canManagePaymentMethods: true,
      canManageTickets: true,
      canSendNotifications: true,
      canViewAuditLogs: true,
    };
  }

  if (role === 'admin') {
    return {
      role: 'admin',
      label: 'Admin',
      allowedSections: ADMIN_SECTIONS,
      canManageFirebase: true,
      canManageStaff: false,
      canManageSystemLifecycle: true,
      canManageSettings: true,
      canManageUsers: true,
      canEditUsers: true,
      canManageServices: true,
      canManageCategories: true,
      canManageOrders: true,
      canEditOrders: true,
      canManageProviders: true,
      canManagePayments: true,
      canManagePaymentMethods: true,
      canManageTickets: true,
      canSendNotifications: true,
      canViewAuditLogs: true,
    };
  }

  if (role === 'manager') {
    return {
      role: 'manager',
      label: 'Manager',
      allowedSections: MANAGER_SECTIONS,
      canManageFirebase: false,
      canManageStaff: false,
      canManageSystemLifecycle: false,
      canManageSettings: false,
      canManageUsers: true,
      canEditUsers: false,
      canManageServices: true,
      canManageCategories: true,
      canManageOrders: true,
      canEditOrders: true,
      canManageProviders: true,
      canManagePayments: false,
      canManagePaymentMethods: false,
      canManageTickets: false,
      canSendNotifications: false,
      canViewAuditLogs: false,
    };
  }

  return {
    role: 'support_staff',
    label: 'Support Staff',
    allowedSections: SUPPORT_SECTIONS,
    canManageFirebase: false,
    canManageStaff: false,
    canManageSystemLifecycle: false,
    canManageSettings: false,
    canManageUsers: false,
    canEditUsers: false,
    canManageServices: false,
    canManageCategories: false,
    canManageOrders: true,
    canEditOrders: false,
    canManageProviders: false,
    canManagePayments: false,
    canManagePaymentMethods: false,
    canManageTickets: true,
    canSendNotifications: false,
    canViewAuditLogs: false,
  };
}

export function canAccessAdminSection(
  role: AdminStaffRole | null | undefined,
  section: AdminSectionId
): boolean {
  if (!role) return false;
  return getAdminPermissions(role).allowedSections.includes(section);
}
