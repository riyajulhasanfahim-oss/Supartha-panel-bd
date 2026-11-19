import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  HeadphonesIcon,
  RefreshCw,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NotificationItem } from '../types';

type NotificationFilter = 'all' | 'orders' | 'payments' | 'support' | 'system';

function getCategoryGroup(category: string): Exclude<NotificationFilter, 'all'> {
  const norm = category.toLowerCase();
  if (norm.startsWith('order')) return 'orders';
  if (norm.startsWith('payment') || norm === 'wallet' || norm === 'refund') return 'payments';
  if (norm.startsWith('support')) return 'support';
  return 'system';
}

function getCategoryBadgeMeta(category: string) {
  const group = getCategoryGroup(category);
  switch (group) {
    case 'orders':
      return {
        label: 'Order',
        badgeClass: 'bg-indigo-50 text-indigo-700',
        icon: ShoppingBag,
      };
    case 'payments':
      return {
        label: category.toLowerCase() === 'refund' ? 'Refund' : 'Payment',
        badgeClass: 'bg-emerald-50 text-emerald-700',
        icon: CreditCard,
      };
    case 'support':
      return {
        label: 'Support',
        badgeClass: 'bg-violet-50 text-violet-700',
        icon: HeadphonesIcon,
      };
    default:
      return {
        label: 'System',
        badgeClass: 'bg-slate-100 text-slate-700',
        icon: Sparkles,
      };
  }
}

export function NotificationsPage() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    handleNotificationClick,
    dataError,
    refreshCustomerData,
    isLoading,
  } = useApp();

  const [filter, setFilter] = useState<NotificationFilter>('all');

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => getCategoryGroup(n.category) === filter);
  }, [filter, notifications]);

  const onOpenNotification = (item: NotificationItem) => {
    handleNotificationClick(item).catch(() => undefined);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Notifications
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Real-time alerts for orders, balance updates, refunds, and support replies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs sm:text-sm font-bold text-violet-800 hover:bg-violet-50 whitespace-nowrap"
            >
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              <span>Mark All Read ({unreadCount})</span>
            </button>
          )}
        </div>
      </div>

      {dataError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>নোটিফিকেশন লোড করতে সমস্যা হয়েছে।</span>
          </div>
          <button
            type="button"
            onClick={refreshCustomerData}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 font-bold text-rose-700 border border-rose-200 hover:bg-rose-100"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
        {(
          [
            { id: 'all', label: 'All Alerts' },
            { id: 'orders', label: 'Orders' },
            { id: 'payments', label: 'Payments & Refunds' },
            { id: 'support', label: 'Support' },
            { id: 'system', label: 'System' },
          ] as const
        ).map((tab) => {
          const active = filter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`h-9 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? 'bg-violet-700 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-violet-50 hover:text-violet-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Notification Cards */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        {isLoading ? (
          <div className="space-y-2.5 p-4">
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-2xl bg-slate-100 animate-pulse" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
            <p className="mt-2.5 text-sm font-bold text-slate-800">No notifications found</p>
            <p className="mt-1 text-xs text-slate-500">
              {notifications.length === 0
                ? 'Order updates, payment approvals, and support replies will appear here.'
                : 'No notifications match the selected category filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item) => {
              const meta = getCategoryBadgeMeta(item.category);
              const Icon = meta.icon;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                    item.read ? 'bg-white' : 'bg-violet-50/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onOpenNotification(item)}
                    className="flex flex-1 items-start gap-3 text-left min-w-0"
                  >
                    <span
                      className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.badgeClass}`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!item.read && (
                          <span
                            className="h-2 w-2 rounded-full bg-violet-600 shrink-0"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-slate-400">{item.timeLabel}</span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-slate-900">{item.title}</p>
                      <p className="mt-0.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        {item.message}
                      </p>
                    </div>
                  </button>

                  <div className="flex items-center justify-end gap-2 shrink-0 pl-13 sm:pl-0">
                    {!item.read ? (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(item)}
                        className="inline-flex h-9 items-center gap-1 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-700 hover:bg-violet-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark Read</span>
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onOpenNotification(item)}
                      aria-label={`Open ${item.title}`}
                      className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-bold text-slate-700 hover:bg-violet-100 hover:text-violet-800"
                    >
                      <span>Open</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
