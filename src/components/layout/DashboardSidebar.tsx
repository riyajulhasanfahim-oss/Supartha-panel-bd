import React from 'react';
import {
  Bell,
  Home,
  ShoppingCart,
  Wallet,
  HeadphonesIcon,
  User,
  LayoutGrid,
  Globe,
  KeyRound,
} from 'lucide-react';
import { DASHBOARD_NAV_ITEMS, type DashboardTab } from '../../config/navigation.config';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { normalizeCurrencySymbol } from '../../utils/pricing';

const ICON_MAP: Record<DashboardTab, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  order: <ShoppingCart className="h-4 w-4" />,
  services: <LayoutGrid className="h-4 w-4" />,
  funds: <Wallet className="h-4 w-4" />,
  support: <HeadphonesIcon className="h-4 w-4" />,
  notifications: <Bell className="h-4 w-4" />,
  profile: <User className="h-4 w-4" />,
  api: <KeyRound className="h-4 w-4" />,
};

export function DashboardSidebar() {
  const { activeTab, navigateProtected, openAuthModal, firebaseUser, wallet, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  return (
    <aside className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-violet-100 lg:bg-white">
      <div className="flex h-14 items-center border-b border-violet-100/80 px-5">
        <BrandLogo showTagline size="sm" onClick={() => navigateProtected('home')} />
      </div>

      <div className="flex flex-1 flex-col justify-between p-4">
        <div className="space-y-6">
          {/* Quick Balance Card */}
          <div className="rounded-2xl bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-700 p-4 text-white shadow-md shadow-violet-700/20">
            <p className="text-xs font-medium text-violet-100">Available Balance</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">
              {currencySymbol}
              {wallet.balance.toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => navigateProtected('funds')}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-xl bg-white/95 px-3 text-xs font-semibold text-violet-900 transition-colors hover:bg-white"
            >
              Add Funds &rarr;
            </button>
          </div>

          <nav className="space-y-1" aria-label="Dashboard sidebar">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateProtected(item.id)}
                  className={`flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-50 font-semibold text-violet-800'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className={isActive ? 'text-violet-700' : 'text-slate-400'}>
                    {ICON_MAP[item.id]}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {!firebaseUser && (
          <div className="border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-violet-50 px-3.5 text-xs font-bold text-violet-800 transition-colors hover:bg-violet-100"
            >
              <Globe className="h-4 w-4 text-violet-700" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
