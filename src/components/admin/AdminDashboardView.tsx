import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
  UserMinus,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { PRODUCT_INFO } from '../../config/product.config';
import { useApp } from '../../context/AppContext';
import {
  adminPanelService,
  type AdminDashboardSnapshot,
} from '../../services/adminPanel.service';
import { StatusText } from '../common/StatusText';
import type { AdminSectionId } from './AdminNavTypes';
import { normalizeCurrencySymbol } from '../../utils/pricing';

interface AdminDashboardViewProps {
  onNavigate: (section: AdminSectionId) => void;
}

export function AdminDashboardView({ onNavigate }: AdminDashboardViewProps) {
  const { adminPermissions, setupState, systemSettings, openSetupWizard } = useApp();
  const [snapshot, setSnapshot] = useState<AdminDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminPanelService.getDashboardSnapshot();
      setSnapshot(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshot();
  }, [loadSnapshot]);

  const s = snapshot ?? {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalOrders: 0,
    pendingOrders: 0,
    completedOrders: 0,
    totalRevenue: 0,
    totalBalance: 0,
    totalDeposits: 0,
    approvedTodayCount: 0,
    approvedTodayAmount: 0,
    rejectedPaymentsCount: 0,
    recentOrders: [],
    recentUsers: [],
    recentTransactions: [],
    openTicketsCount: 0,
    pendingPaymentsCount: 0,
  };

  const kpiCards = [
    {
      label: 'Total Deposits',
      value: `${currencySymbol}${s.totalDeposits.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: ArrowDownLeft,
      accent: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Pending Payments',
      value: s.pendingPaymentsCount.toLocaleString(),
      icon: CreditCard,
      accent: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Approved Today',
      value: `${s.approvedTodayCount} (${currencySymbol}${s.approvedTodayAmount.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })})`,
      icon: CheckCircle2,
      accent: 'bg-emerald-100 text-emerald-800',
    },
    {
      label: 'Rejected Payments',
      value: s.rejectedPaymentsCount.toLocaleString(),
      icon: XCircle,
      accent: 'bg-rose-50 text-rose-700',
    },
    {
      label: 'Total User Balance',
      value: `${currencySymbol}${s.totalBalance.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: Wallet,
      accent: 'bg-violet-100 text-violet-800',
    },
    {
      label: 'Total Order Revenue',
      value: `${currencySymbol}${s.totalRevenue.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
      icon: DollarSign,
      accent: 'bg-purple-50 text-purple-700',
    },
    {
      label: 'Total Users',
      value: s.totalUsers.toLocaleString(),
      icon: Users,
      accent: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'Active Users',
      value: s.activeUsers.toLocaleString(),
      icon: UserCheck,
      accent: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Suspended Users',
      value: s.suspendedUsers.toLocaleString(),
      icon: UserMinus,
      accent: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Total Orders',
      value: s.totalOrders.toLocaleString(),
      icon: ShoppingBag,
      accent: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Pending Orders',
      value: s.pendingOrders.toLocaleString(),
      icon: Clock,
      accent: 'bg-orange-50 text-orange-700',
    },
    {
      label: 'Completed Orders',
      value: s.completedOrders.toLocaleString(),
      icon: CheckCircle2,
      accent: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Admin Overview
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Real-time metrics aggregated directly from Firestore collections.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSnapshot}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Refreshing...' : 'Refresh Metrics'}</span>
        </button>
      </div>

      {/* 8 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500">{card.label}</span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.accent}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-3 font-display text-lg sm:text-2xl font-extrabold text-slate-950 tabular-nums">
                {loading ? '—' : card.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* System Health & Commercial Setup Strip (Admin / Super Admin only) */}
      {adminPermissions.canManageSystemLifecycle && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200/80 bg-white px-4 py-3.5 shadow-xs">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
              <ShieldCheck
                className={`h-4 w-4 ${
                  setupState.firebaseConnected && setupState.databaseInitialized
                    ? 'text-emerald-600'
                    : 'text-amber-500'
                }`}
              />
              <span>
                {PRODUCT_INFO.shortName} {PRODUCT_INFO.version}
              </span>
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="font-mono text-slate-600 tabular-nums">
              {setupState.installationId || 'Setup Pending'}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">
              Firebase:{' '}
              <strong className={setupState.firebaseConnected ? 'text-emerald-700' : 'text-rose-600'}>
                {setupState.firebaseConnected ? 'Connected' : 'Offline'}
              </strong>
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-600">
              Mode:{' '}
              <strong className={setupState.productionMode ? 'text-emerald-700' : 'text-amber-700'}>
                {setupState.productionMode ? 'Production' : 'Staging'}
              </strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!setupState.setupCompleted && (
              <button
                type="button"
                onClick={openSetupWizard}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Complete Setup</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('system-info')}
              className="inline-flex h-8 items-center rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800 hover:bg-violet-100 whitespace-nowrap"
            >
              System Health &amp; Info
            </button>
          </div>
        </div>
      )}

      {/* Activity Summary Strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        {adminPermissions.canManagePayments && (
          <button
            type="button"
            onClick={() => onNavigate('payments')}
            className="flex items-center justify-between rounded-2xl border border-violet-100 bg-white p-4 text-left hover:border-violet-300 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">Pending Payment Reviews</p>
              <p className="mt-1 font-display text-lg font-extrabold text-slate-900">
                {s.pendingPaymentsCount} waiting
              </p>
            </div>
            <span className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700">
              Review
            </span>
          </button>
        )}

        {adminPermissions.canManageTickets && (
          <button
            type="button"
            onClick={() => onNavigate('tickets')}
            className="flex items-center justify-between rounded-2xl border border-violet-100 bg-white p-4 text-left hover:border-violet-300 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">Open Support Tickets</p>
              <p className="mt-1 font-display text-lg font-extrabold text-slate-900">
                {s.openTicketsCount} active
              </p>
            </div>
            <span className="rounded-xl bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700">
              Respond
            </span>
          </button>
        )}

        {adminPermissions.canViewAuditLogs && (
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="flex items-center justify-between rounded-2xl border border-violet-100 bg-white p-4 text-left hover:border-violet-300 transition-colors"
          >
            <div>
              <p className="text-xs font-semibold text-slate-500">Recent Audit Entries</p>
              <p className="mt-1 font-display text-lg font-extrabold text-slate-900">
                {s.recentTransactions.length} logged
              </p>
            </div>
            <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              Ledger
            </span>
          </button>
        )}
      </div>

      {/* Recent Orders & Recent Users + System Activity */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-display text-base font-bold text-slate-900">Recent Orders</h2>
            <button
              type="button"
              onClick={() => onNavigate('orders')}
              className="text-xs font-bold text-violet-700 hover:underline"
            >
              Manage All
            </button>
          </div>

          {s.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">No orders recorded yet.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100">
              {s.recentOrders.map((ord) => (
                <div key={ord.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      <span className="font-mono text-violet-700">#{ord.id}</span> · {ord.serviceName}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      Qty {ord.quantity.toLocaleString()} · {currencySymbol}
                      {ord.charge.toFixed(2)} · {ord.createdAtLabel}
                    </p>
                  </div>
                  <StatusText status={ord.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 space-y-5">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="font-display text-base font-bold text-slate-900">Recent Users</h2>
              <button
                type="button"
                onClick={() => onNavigate('users')}
                className="text-xs font-bold text-violet-700 hover:underline"
              >
                View Users
              </button>
            </div>
            {s.recentUsers.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No users registered yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-slate-100">
                {s.recentUsers.map((u) => (
                  <div key={u.uid} className="flex items-center justify-between gap-2 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-900">{u.name}</p>
                      <p className="truncate text-[11px] text-slate-500">{u.email}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-slate-900 tabular-nums">
                        {currencySymbol}
                        {u.balance.toFixed(2)}
                      </p>
                      <p className="text-[11px] capitalize text-slate-500">{u.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Activity className="h-4 w-4 text-violet-700" />
              <h2 className="font-display text-base font-bold text-slate-900">System Activity</h2>
            </div>
            {s.recentTransactions.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No ledger transactions yet.</p>
            ) : (
              <div className="mt-3 space-y-2.5">
                {s.recentTransactions.slice(0, 4).map((txn) => (
                  <div key={txn.id} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 truncate">
                        {txn.type.toUpperCase()} · {txn.reference}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{txn.createdAtLabel}</p>
                    </div>
                    <span
                      className={`font-bold tabular-nums shrink-0 ${
                        txn.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {txn.amount >= 0 ? '+' : ''}
                      {currencySymbol}
                      {txn.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
