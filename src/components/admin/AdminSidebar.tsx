import React from 'react';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  ClipboardList,
  CreditCard,
  Database,
  FolderTree,
  HeadphonesIcon,
  Landmark,
  Layers,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  Shield,
  ShoppingBag,
  Terminal,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { AdminStaffRole } from '../../lib/firestore/collections';
import { canAccessAdminSection, getAdminRoleLabel } from '../../lib/permissions';
import { BrandLogo } from '../common/BrandLogo';
import type { AdminSectionId } from './AdminNavTypes';

export interface AdminNavItem {
  id: AdminSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'services', label: 'Services', icon: Layers },
  { id: 'categories', label: 'Categories', icon: FolderTree },
  { id: 'orders', label: 'Orders', icon: ShoppingBag },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'payment-methods', label: 'Payment Methods', icon: Landmark },
  { id: 'transactions', label: 'Transactions', icon: ArrowLeftRight },
  { id: 'providers', label: 'API Providers', icon: Plug },
  { id: 'api-gateway', label: 'API Gateway', icon: Terminal },
  { id: 'tickets', label: 'Support Tickets', icon: HeadphonesIcon },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'audit-logs', label: 'Audit Logs', icon: ClipboardList },
  { id: 'settings', label: 'Website Settings', icon: Settings },
  { id: 'firebase', label: 'Firebase Configuration', icon: Database },
  { id: 'staff', label: 'Admin Staff & Roles', icon: Shield },
  { id: 'system-info', label: 'System Info & Health', icon: Activity },
  { id: 'profile', label: 'Admin Profile', icon: UserCog },
];

interface AdminSidebarProps {
  activeSection: AdminSectionId;
  onSelectSection: (section: AdminSectionId) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  adminEmail?: string | null;
  staffRole?: AdminStaffRole | null;
}

export function AdminSidebar({
  activeSection,
  onSelectSection,
  onLogout,
  mobileOpen,
  onCloseMobile,
  adminEmail,
  staffRole,
}: AdminSidebarProps) {
  const handleSelect = (id: AdminSectionId) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const visibleItems = staffRole
    ? ADMIN_NAV_ITEMS.filter((item) => canAccessAdminSection(staffRole, item.id))
    : ADMIN_NAV_ITEMS;

  const navContent = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center justify-between border-b border-violet-100 px-4">
        <BrandLogo size="sm" />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-violet-50 lg:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-slate-100 bg-violet-50/50">
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
          {staffRole ? `${getAdminRoleLabel(staffRole)} Console` : 'Admin Control Center'}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-600">{adminEmail ?? 'Verified Admin'}</p>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-all ${
                active
                  ? 'bg-gradient-to-r from-violet-700 to-purple-600 text-white shadow-sm shadow-violet-700/20'
                  : 'text-slate-600 hover:bg-violet-50 hover:text-violet-800'
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <button
          type="button"
          onClick={() => {
            onCloseMobile();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-violet-100">
        {navContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col border-r border-violet-100 shadow-2xl">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
