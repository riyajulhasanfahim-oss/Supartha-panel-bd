import React from 'react';
import {
  Bell,
  X,
  Home,
  ShoppingCart,
  LayoutGrid,
  Wallet,
  HeadphonesIcon,
  User,
  Globe,
  KeyRound,
} from 'lucide-react';
import { DASHBOARD_NAV_ITEMS, type DashboardTab } from '../../config/navigation.config';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

const DRAWER_ICONS: Record<DashboardTab, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  order: <ShoppingCart className="h-4 w-4" />,
  services: <LayoutGrid className="h-4 w-4" />,
  funds: <Wallet className="h-4 w-4" />,
  support: <HeadphonesIcon className="h-4 w-4" />,
  notifications: <Bell className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
  api: <KeyRound className="h-4 w-4" />,
};

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const { activeTab, navigateProtected, openAuthModal, firebaseUser, profile } = useApp();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-2xl">
        <div className="flex h-14 items-center justify-between border-b border-violet-100 px-4">
          <BrandLogo showTagline size="sm" onClick={() => { navigateProtected('home'); onClose(); }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            {firebaseUser ? (profile?.fullName ?? 'Account') : 'Guest Visitor'}
          </p>
          <p className="text-xs text-slate-500">
            {firebaseUser ? (profile?.tierLabel ?? 'Customer Account') : 'Sign in to place orders & add funds'}
          </p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Drawer navigation">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onClose();
                  navigateProtected(item.id);
                }}
                className={`flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-violet-50 font-semibold text-violet-800'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={isActive ? 'text-violet-700' : 'text-slate-400'}>
                  {DRAWER_ICONS[item.id]}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {!firebaseUser && (
          <div className="border-t border-slate-100 p-3">
            <button
              type="button"
              onClick={() => {
                onClose();
                openAuthModal('login');
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-50 px-3.5 text-sm font-bold text-violet-700 hover:bg-violet-100"
            >
              <Globe className="h-4 w-4" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
