import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertOctagon,
  Bell,
  CheckCheck,
  CheckCircle2,
  CreditCard,
  HeadphonesIcon,
  RefreshCw,
  Send,
  ShoppingBag,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { NotificationTypeFirestore } from '../../lib/firestore/collections';
import {
  adminPanelService,
  type AdminNotificationItem,
  type AdminSystemAlertItem,
} from '../../services/adminPanel.service';
import {
  userManagementService,
  type ManagedUserRecord,
} from '../../services/userManagement.service';
import type { AdminSectionId } from './AdminNavTypes';

interface AdminNotificationsViewProps {
  onNavigate?: (section: AdminSectionId) => void;
  onAlertsChanged?: () => void;
}

function getAlertMeta(type: AdminSystemAlertItem['type']) {
  switch (type) {
    case 'new_user':
      return { label: 'New User', badge: 'bg-emerald-50 text-emerald-700', icon: UserPlus, section: 'users' as AdminSectionId };
    case 'new_payment':
      return { label: 'New Payment', badge: 'bg-amber-50 text-amber-800', icon: CreditCard, section: 'payments' as AdminSectionId };
    case 'new_order':
      return { label: 'New Order', badge: 'bg-indigo-50 text-indigo-700', icon: ShoppingBag, section: 'orders' as AdminSectionId };
    case 'new_ticket':
      return { label: 'New Ticket', badge: 'bg-violet-50 text-violet-700', icon: HeadphonesIcon, section: 'tickets' as AdminSectionId };
    case 'failed_provider_api':
      return { label: 'Provider API Error', badge: 'bg-rose-50 text-rose-700', icon: AlertOctagon, section: 'orders' as AdminSectionId };
    default:
      return { label: 'System Alert', badge: 'bg-rose-50 text-rose-700', icon: AlertOctagon, section: 'orders' as AdminSectionId };
  }
}

export function AdminNotificationsView({
  onNavigate,
  onAlertsChanged,
}: AdminNotificationsViewProps) {
  const { showToast } = useApp();
  const [activeTab, setActiveTab] = useState<'alerts' | 'broadcasts'>('alerts');
  const [adminAlerts, setAdminAlerts] = useState<AdminSystemAlertItem[]>([]);
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [targetType, setTargetType] = useState<'all' | 'user'>('all');
  const [targetUserId, setTargetUserId] = useState('');
  const [type, setType] = useState<NotificationTypeFirestore>('system');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertList, notifList, userList] = await Promise.all([
        adminPanelService.listAdminNotifications(80).catch(() => []),
        adminPanelService.listNotificationsAdmin(),
        userManagementService.listAllUsers().catch(() => []),
      ]);
      setAdminAlerts(alertList);
      setNotifications(notifList);
      setUsers(userList);
      if (!targetUserId && userList[0]) {
        setTargetUserId(userList[0].uid);
      }
      onAlertsChanged?.();
    } finally {
      setLoading(false);
    }
  }, [onAlertsChanged, targetUserId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const unreadAlertsCount = adminAlerts.filter((a) => !a.read).length;

  const handleMarkAlertRead = async (alertId: string) => {
    setAdminAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, read: true } : a)));
    await adminPanelService.markAdminNotificationRead(alertId);
    onAlertsChanged?.();
  };

  const handleMarkAllAlertsRead = async () => {
    const prev = adminAlerts;
    setAdminAlerts((cur) => cur.map((a) => ({ ...a, read: true })));
    await adminPanelService.markAllAdminNotificationsRead(prev);
    onAlertsChanged?.();
    showToast({
      title: 'All Alerts Marked Read',
      description: 'Admin operational alert badge cleared.',
      tone: 'success',
    });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await adminPanelService.sendNotification({
        targetType,
        userId: targetType === 'all' ? 'all' : targetUserId,
        title,
        message,
        type,
      });
      showToast({
        title: 'Notification Dispatched',
        description:
          targetType === 'all'
            ? 'Broadcast notification is now live in customer dashboards.'
            : 'Targeted notification sent to user.',
        tone: 'success',
      });
      setTitle('');
      setMessage('');
      await loadData();
    } catch (err) {
      showToast({
        title: 'Dispatch Failed',
        description: err instanceof Error ? err.message : 'Unable to send notification.',
        tone: 'error',
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await adminPanelService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast({
        title: 'Notification Deleted',
        description: 'Removed from customer notification feeds.',
        tone: 'info',
      });
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete notification.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Notifications Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Monitor admin operational alerts and send announcements directly to customer bells.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Mode Switch Tabs */}
      <div className="inline-flex rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('alerts')}
          className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
            activeTab === 'alerts'
              ? 'bg-violet-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-violet-50'
          }`}
        >
          <span>Admin Alerts</span>
          {unreadAlertsCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-extrabold ${
                activeTab === 'alerts' ? 'bg-white/20 text-white' : 'bg-rose-600 text-white'
              }`}
            >
              {unreadAlertsCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('broadcasts')}
          className={`inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-bold transition-colors ${
            activeTab === 'broadcasts'
              ? 'bg-violet-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-violet-50'
          }`}
        >
          <span>Customer Announcements</span>
        </button>
      </div>

      {activeTab === 'alerts' ? (
        <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Admin Operational Alerts ({adminAlerts.length})
              </h2>
              <p className="text-xs text-slate-500">
                New signups, payment deposits, customer orders, support tickets, and provider sync errors.
              </p>
            </div>
            {unreadAlertsCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAlertsRead}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-700 hover:bg-violet-100"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Mark All Read</span>
              </button>
            )}
          </div>

          <div className="mt-3 divide-y divide-slate-100">
            {adminAlerts.map((alert) => {
              const meta = getAlertMeta(alert.type);
              const Icon = meta.icon;
              return (
                <div
                  key={alert.id}
                  className={`flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between ${
                    alert.read ? 'opacity-80' : 'bg-violet-50/30 -mx-3 px-3 rounded-2xl'
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.badge}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!alert.read && <span className="h-2 w-2 rounded-full bg-violet-600" />}
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[11px] text-slate-400">{alert.createdAtLabel}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">{alert.title}</p>
                      <p className="text-xs text-slate-600">{alert.message}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {!alert.read && (
                      <button
                        type="button"
                        onClick={() => handleMarkAlertRead(alert.id)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Mark Read</span>
                      </button>
                    )}
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!alert.read) handleMarkAlertRead(alert.id).catch(() => undefined);
                          onNavigate(meta.section);
                        }}
                        className="inline-flex h-8 items-center rounded-lg bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800"
                      >
                        Inspect
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {!loading && adminAlerts.length === 0 && (
              <p className="py-10 text-center text-xs text-slate-400">
                No admin operational alerts recorded yet.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <form
            onSubmit={handleSend}
            className="lg:col-span-5 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Bell className="h-5 w-5 text-violet-700" />
              <h2 className="font-display text-base font-bold text-slate-900">
                Create Customer Notification
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`h-10 rounded-xl border text-xs font-bold ${
                  targetType === 'all'
                    ? 'border-violet-700 bg-violet-50 text-violet-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Broadcast (All Users)
              </button>
              <button
                type="button"
                onClick={() => setTargetType('user')}
                className={`h-10 rounded-xl border text-xs font-bold ${
                  targetType === 'user'
                    ? 'border-violet-700 bg-violet-50 text-violet-800'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                Specific User
              </button>
            </div>

            {targetType === 'user' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target User
                </label>
                <select
                  required
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                >
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notification Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NotificationTypeFirestore)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
              >
                <option value="system">System Announcement</option>
                <option value="order_completed">Order Update</option>
                <option value="payment_approved">Payment Update</option>
                <option value="refund">Refund Notice</option>
                <option value="support_reply">Support Reply</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="New Instagram Services Live!"
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write notification message for customers..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              <span>{sending ? 'Sending...' : 'Send Notification'}</span>
            </button>
          </form>

          <div className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <h2 className="font-display text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
              Dispatched Customer Notifications ({notifications.length})
            </h2>

            <div className="mt-3 divide-y divide-slate-100">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 py-3.5">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                        {n.type}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                        {n.userId === 'all' ? 'ALL USERS' : `User: ${n.userId}`}
                      </span>
                      <span className="text-[11px] text-slate-400">{n.createdAtLabel}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                    <p className="text-xs text-slate-600">{n.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(n.id)}
                    aria-label={`Delete notification ${n.title}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {!loading && notifications.length === 0 && (
                <p className="py-10 text-center text-xs text-slate-400">
                  No notifications dispatched yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
