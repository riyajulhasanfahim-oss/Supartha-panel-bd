import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import type { OrderStatusFirestore } from '../../lib/firestore/collections';
import {
  adminPanelService,
  type AdminApiProviderItem,
  type AdminOrderItem,
} from '../../services/adminPanel.service';
import { StatusText } from '../common/StatusText';
import { normalizeCurrencySymbol } from '../../utils/pricing';

const ORDER_STATUSES: Array<'All' | OrderStatusFirestore> = [
  'All',
  'Pending',
  'Processing',
  'In Progress',
  'Completed',
  'Partial',
  'Cancelled',
  'Failed',
];

const PAGE_SIZE = 15;

export function AdminOrdersView() {
  const { firebaseUser, showToast, adminPermissions, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );
  const canEditOrders = adminPermissions.canEditOrders;
  const canRefundOrders = adminPermissions.canEditUsers;
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [providers, setProviders] = useState<AdminApiProviderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | OrderStatusFirestore>('All');
  const [page, setPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<AdminOrderItem | null>(null);
  const [editStatus, setEditStatus] = useState<OrderStatusFirestore>('Pending');
  const [editProviderId, setEditProviderId] = useState('');
  const [editProviderOrderId, setEditProviderOrderId] = useState('');
  const [editRemains, setEditRemains] = useState('0');
  const [editStartCount, setEditStartCount] = useState('0');
  const [editInternalNote, setEditInternalNote] = useState('');
  const [refundReason, setRefundReason] = useState('Order failed / cancelled — full refund');
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const [ordList, provList] = await Promise.all([
        adminPanelService.listOrdersAdmin(),
        adminPanelService.listApiProviders(),
      ]);
      setOrders(ordList);
      setProviders(provList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const providerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    providers.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [providers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'All') {
        if (statusFilter === 'Cancelled') {
          if (o.status !== 'Cancelled' && o.status !== 'Canceled') return false;
        } else if (o.status !== statusFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        o.userId.toLowerCase().includes(q) ||
        o.link.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
      );
    });
  }, [orders, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  const openDetail = (order: AdminOrderItem) => {
    setSelectedOrder(order);
    setEditStatus(order.status);
    setEditProviderId(order.providerId);
    setEditProviderOrderId(order.providerOrderId);
    setEditRemains(String(order.remains));
    setEditStartCount(String(order.startCount));
    setEditInternalNote(order.internalNote ?? '');
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !canEditOrders) return;
    setSaving(true);
    try {
      await adminPanelService.updateOrderAdmin(selectedOrder.id, {
        status: editStatus,
        providerId: editProviderId,
        providerOrderId: editProviderOrderId,
        remains: Number(editRemains) || 0,
        startCount: Number(editStartCount) || 0,
        internalNote: editInternalNote,
      });
      showToast({
        title: 'Order Updated',
        description: `Order #${selectedOrder.id} updated to ${editStatus}.`,
        tone: 'success',
      });
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update order.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDispatchProvider = async () => {
    if (!selectedOrder || !canEditOrders) return;
    setDispatching(true);
    try {
      const res = await adminPanelService.dispatchOrderToProviderAdmin(
        selectedOrder.id,
        editProviderId || undefined
      );
      showToast({
        title: 'Dispatched to Provider',
        description: `Provider Order ID: ${res.providerOrderId}`,
        tone: 'success',
      });
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      showToast({
        title: 'Provider Dispatch Failed',
        description: err instanceof Error ? err.message : 'Unable to send order to provider.',
        tone: 'error',
      });
    } finally {
      setDispatching(false);
    }
  };

  const handleSyncProviderStatus = async (orderId: string, forceRetry: boolean) => {
    if (!firebaseUser || !canEditOrders) return;
    setDispatching(true);
    try {
      const res = await adminPanelService.syncProviderOrderStatusAdmin(
        orderId,
        firebaseUser.uid,
        forceRetry
      );
      showToast({
        title: res.autoRefunded ? 'Cancelled & Auto-Refunded' : 'Provider Status Synced',
        description: res.autoRefunded
          ? `Order was refunded automatically after provider status became ${res.status}.`
          : `Updated order status to ${res.status}.`,
        tone: res.autoRefunded ? 'warning' : 'success',
      });
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      showToast({
        title: 'Status Sync Failed',
        description: err instanceof Error ? err.message : 'Unable to sync status.',
        tone: 'error',
      });
      await loadOrders();
    } finally {
      setDispatching(false);
    }
  };

  const handleBatchSyncDue = async () => {
    if (!firebaseUser || !canEditOrders) return;
    setBatchSyncing(true);
    try {
      const res = await adminPanelService.syncDueProviderOrdersBatchAdmin(firebaseUser.uid);
      showToast({
        title: 'Batch Status Sync Complete',
        description: `Checked ${res.checkedCount} due orders · Updated ${res.updatedCount} · Refunded ${res.refundedCount} · Errors ${res.failedCount}`,
        tone: res.failedCount > 0 ? 'warning' : 'success',
      });
      await loadOrders();
    } catch (err) {
      showToast({
        title: 'Batch Sync Failed',
        description: err instanceof Error ? err.message : 'Unable to run batch sync.',
        tone: 'error',
      });
    } finally {
      setBatchSyncing(false);
    }
  };

  const handleRefundOrder = async () => {
    if (!selectedOrder || !firebaseUser || !canRefundOrders) return;
    setRefunding(true);
    try {
      const res = await adminPanelService.refundOrderAtomic(
        selectedOrder.id,
        firebaseUser.uid,
        refundReason
      );
      showToast({
        title: 'Order Refunded Atomically',
        description: `Returned ${currencySymbol}${res.refundAmount.toFixed(
          2
        )} to customer wallet (${res.transactionId}).`,
        tone: 'success',
      });
      setSelectedOrder(null);
      await loadOrders();
    } catch (err) {
      showToast({
        title: 'Refund Blocked / Failed',
        description: err instanceof Error ? err.message : 'Unable to refund order.',
        tone: 'error',
      });
    } finally {
      setRefunding(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Orders Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track customer orders, run server-side provider status syncs, inspect retries, and manage refunds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditOrders && (
            <button
              type="button"
              disabled={batchSyncing || loading}
              onClick={handleBatchSyncDue}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${batchSyncing ? 'animate-spin' : ''}`} />
              <span>{batchSyncing ? 'Syncing Due...' : 'Sync Due Orders'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order ID, User ID, Target Link, Service, or Status..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {ORDER_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`h-8 rounded-xl px-3 text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-violet-700 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3.5">Order ID</th>
              <th className="px-4 py-3.5">User &amp; Timestamps</th>
              <th className="px-4 py-3.5">Service &amp; Link</th>
              <th className="px-4 py-3.5">Qty &amp; Pricing</th>
              <th className="px-4 py-3.5">Provider Ref</th>
              <th className="px-4 py-3.5">Status &amp; Sync</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((ord) => (
              <tr key={ord.id} className="hover:bg-violet-50/30">
                <td className="px-4 py-3.5 font-mono font-bold text-violet-700">{ord.id}</td>
                <td className="px-4 py-3.5">
                  <p className="font-mono text-[11px] text-slate-700">{ord.userId}</p>
                  <p className="text-[10px] text-slate-400">
                    {ord.createdAtLabel} · upd {ord.updatedAtLabel}
                  </p>
                </td>
                <td className="px-4 py-3.5 max-w-xs">
                  <p className="font-semibold text-slate-900 truncate">{ord.serviceName}</p>
                  <p className="truncate text-[11px] text-slate-500">{ord.link}</p>
                </td>
                <td className="px-4 py-3.5 tabular-nums">
                  <p className="font-bold text-slate-900">{ord.quantity.toLocaleString()} qty</p>
                  <p className="text-[11px] text-slate-600">
                    Sell {currencySymbol}
                    {ord.charge.toFixed(2)}
                    {typeof ord.providerCharge === 'number'
                      ? ` · Cost ${ord.providerCharge.toFixed(2)}`
                      : ''}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-[11px] text-slate-600">
                  <p className="font-semibold text-slate-800">
                    {providerNameMap.get(ord.providerId) || ord.providerId || 'Manual'}
                  </p>
                  <p className="font-mono text-slate-500">{ord.providerOrderId || '—'}</p>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center gap-1">
                    <StatusText status={ord.status} />
                    {ord.refunded && <StatusText status="Refunded" />}
                    {ord.refundEligible && !ord.refunded && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                        Partial Review
                      </span>
                    )}
                  </div>
                  {(ord.retryCount > 0 || ord.lastCheckedAtLabel) && (
                    <p className="mt-1 text-[10px] text-slate-400">
                      {ord.retryCount > 0
                        ? `Retries: ${ord.retryCount}${ord.nextRetryAtLabel ? ` · next ${ord.nextRetryAtLabel}` : ''}`
                        : `Checked ${ord.lastCheckedAtLabel}`}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    {canEditOrders && ord.providerOrderId && (
                      <button
                        type="button"
                        disabled={dispatching}
                        onClick={() => handleSyncProviderStatus(ord.id, ord.retryCount > 0)}
                        title="Sync Provider Status"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>{ord.retryCount > 0 ? 'Retry' : 'Sync'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetail(ord)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-700 hover:bg-violet-100"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>{canEditOrders ? 'Manage' : 'View'}</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No orders matched your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {paginated.map((ord) => (
          <div
            key={ord.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-violet-700">{ord.id}</span>
              <div className="flex items-center gap-1">
                {ord.refunded && <StatusText status="Refunded" />}
                <StatusText status={ord.status} />
              </div>
            </div>
            <p className="text-sm font-bold text-slate-900">{ord.serviceName}</p>
            <p className="truncate text-xs text-slate-500">{ord.link}</p>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-1">
              <span>
                Qty: {ord.quantity.toLocaleString()} · Provider:{' '}
                {providerNameMap.get(ord.providerId) || ord.providerId || 'Manual'}
              </span>
              <span className="font-bold text-slate-900">
                {currencySymbol}
                {ord.charge.toFixed(2)}
              </span>
            </div>
            {ord.lastError && (
              <p className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
                Last Sync Error: {ord.lastError}
              </p>
            )}
            <div className="flex gap-2">
              {canEditOrders && ord.providerOrderId && (
                <button
                  type="button"
                  disabled={dispatching}
                  onClick={() => handleSyncProviderStatus(ord.id, ord.retryCount > 0)}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-xs font-bold text-indigo-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>{ord.retryCount > 0 ? 'Retry Sync' : 'Refresh Status'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => openDetail(ord)}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-700 text-xs font-bold text-white"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{canEditOrders ? 'Manage Order' : 'View Order'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs">
          <span className="text-slate-500 tabular-nums">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}{' '}
            of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-mono font-bold text-slate-700 tabular-nums">
              {safePage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Order Detail View Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Order Detail #{selectedOrder.id}
                </h2>
                <p className="text-xs text-slate-500">
                  Created {selectedOrder.createdAtLabel} · Updated {selectedOrder.updatedAtLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 text-xs space-y-1.5">
              <p>
                <span className="font-semibold text-slate-600">User ID:</span>{' '}
                <span className="font-mono text-slate-900">{selectedOrder.userId}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Service:</span>{' '}
                <span className="font-semibold text-slate-900">{selectedOrder.serviceName}</span>
              </p>
              <p className="break-all">
                <span className="font-semibold text-slate-600">Target Link:</span>{' '}
                <span className="text-violet-700">{selectedOrder.link}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-600">Quantity / Charge:</span>{' '}
                <span className="font-bold">
                  {selectedOrder.quantity.toLocaleString()} · {currencySymbol}
                  {selectedOrder.charge.toFixed(2)}
                </span>
                {typeof selectedOrder.providerCharge === 'number' && (
                  <span className="ml-2 text-slate-500">
                    (Provider Cost: {selectedOrder.providerCharge.toFixed(4)})
                  </span>
                )}
              </p>
              {selectedOrder.lastCheckedAtLabel && (
                <p>
                  <span className="font-semibold text-slate-600">Last Provider Check:</span>{' '}
                  <span>{selectedOrder.lastCheckedAtLabel}</span>
                </p>
              )}
              {selectedOrder.lastError && (
                <div className="mt-1 flex items-start gap-1.5 rounded-xl bg-rose-50 p-2 text-rose-800">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Last Sync Error (Retry #{selectedOrder.retryCount}): {selectedOrder.lastError}
                    {selectedOrder.nextRetryAtLabel
                      ? ` · Next backoff: ${selectedOrder.nextRetryAtLabel}`
                      : ''}
                  </span>
                </div>
              )}
            </div>

            {canEditOrders ? (
              <form onSubmit={handleSaveOrder} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as OrderStatusFirestore)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Processing">Processing</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Partial">Partial</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Failed">Failed</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Provider</label>
                    <select
                      value={editProviderId}
                      onChange={(e) => setEditProviderId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    >
                      <option value="">None / Manual</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Provider Order ID
                    </label>
                    <input
                      type="text"
                      value={editProviderOrderId}
                      onChange={(e) => setEditProviderOrderId(e.target.value)}
                      placeholder="e.g. 982341"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Start Count
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={editStartCount}
                      onChange={(e) => setEditStartCount(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Remains</label>
                    <input
                      type="number"
                      min="0"
                      value={editRemains}
                      onChange={(e) => setEditRemains(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Internal Admin Note (Hidden from Customer)
                  </label>
                  <textarea
                    rows={2}
                    value={editInternalNote}
                    onChange={(e) => setEditInternalNote(e.target.value)}
                    placeholder="Optional internal audit note..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {saving ? 'Updating...' : 'Save Order Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
                Read-only order view for <span className="font-bold">{adminPermissions.label}</span>.
                Status edits and wallet refunds require Manager or Admin privileges.
              </div>
            )}

            {/* Provider Dispatch & Sync & Atomic Refund Controls */}
            <div className="mt-5 border-t border-slate-100 pt-4 space-y-3">
              {canEditOrders && (
                <div className="flex flex-wrap gap-2">
                  {!selectedOrder.providerOrderId && !selectedOrder.refunded && (
                    <button
                      type="button"
                      disabled={dispatching}
                      onClick={handleDispatchProvider}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span>{dispatching ? 'Dispatching...' : 'Send to Provider API'}</span>
                    </button>
                  )}
                  {selectedOrder.providerOrderId && (
                    <>
                      <button
                        type="button"
                        disabled={dispatching}
                        onClick={() => handleSyncProviderStatus(selectedOrder.id, false)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${dispatching ? 'animate-spin' : ''}`} />
                        <span>Refresh Status</span>
                      </button>
                      {(selectedOrder.retryCount > 0 || selectedOrder.lastError) && (
                        <button
                          type="button"
                          disabled={dispatching}
                          onClick={() => handleSyncProviderStatus(selectedOrder.id, true)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Retry Order Sync</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {selectedOrder.refunded ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-bold">Already Refunded</p>
                  <p className="mt-0.5 font-mono text-[11px]">
                    Refund Txn: {selectedOrder.refundTransactionId || 'Recorded'} (Duplicate refund
                    locked)
                  </p>
                </div>
              ) : canRefundOrders ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-2.5">
                  <p className="text-xs font-bold text-rose-900">
                    Cancel &amp; Refund Full Charge ({currencySymbol}
                    {selectedOrder.charge.toFixed(2)})
                  </p>
                  <input
                    type="text"
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Refund reason..."
                    className="h-9 w-full rounded-xl border border-rose-200 bg-white px-3 text-xs"
                  />
                  <button
                    type="button"
                    disabled={refunding}
                    onClick={handleRefundOrder}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{refunding ? 'Refunding...' : 'Refund & Cancel Order'}</span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
