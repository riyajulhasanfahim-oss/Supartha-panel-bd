import React from 'react';
import { Wallet, ShoppingCart, Check, Clock, ArrowRight } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { StatCard } from '../common/StatCard';
import { normalizeCurrencySymbol } from '../../utils/pricing';

export function StatsGrid() {
  const { wallet, orderStats, navigateProtected, isLoading, platforms, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  if (isLoading && platforms.length === 0) {
    return (
      <section aria-label="Loading statistics" className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
        <div className="lg:col-span-5 h-16 rounded-2xl bg-violet-200/50 animate-pulse" />
        <div className="lg:col-span-7 grid grid-cols-3 gap-2 sm:gap-2.5">
          <div className="h-16 rounded-xl bg-slate-200/70 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-200/70 animate-pulse" />
          <div className="h-16 rounded-xl bg-slate-200/70 animate-pulse" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Account statistics" className="grid grid-cols-1 gap-2.5 lg:grid-cols-12">
      {/* Wallet Balance Card */}
      <div className="lg:col-span-5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#6D28D9] via-[#7C3AED] to-[#4F46E5] px-3.5 py-3 sm:px-4 sm:py-3.5 text-white shadow-md shadow-violet-700/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-xs">
            <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-violet-100 leading-tight">Your Balance</p>
            <p className="mt-0.5 font-display text-lg sm:text-xl font-extrabold tracking-tight tabular-nums truncate leading-tight">
              {currencySymbol} {wallet.balance.toLocaleString()}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigateProtected('funds')}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[11px] font-bold text-violet-900 shadow-xs transition-all duration-150 hover:bg-violet-50 active:scale-[0.98] whitespace-nowrap"
        >
          <span>Add Funds</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>

      {/* Order Statistics Cards */}
      <div className="lg:col-span-7 grid grid-cols-3 gap-2 sm:gap-2.5">
        <StatCard
          label="Total Orders"
          value={orderStats.totalOrders}
          tone="indigo"
          icon={<ShoppingCart className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => navigateProtected('order')}
        />
        <StatCard
          label="Completed"
          value={orderStats.completedOrders}
          tone="emerald"
          icon={<Check className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />}
          onClick={() => navigateProtected('order')}
        />
        <StatCard
          label="Pending"
          value={orderStats.pendingOrders}
          tone="amber"
          icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={() => navigateProtected('order')}
        />
      </div>
    </section>
  );
}
