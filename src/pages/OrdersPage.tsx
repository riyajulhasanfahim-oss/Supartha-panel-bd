import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  PlusCircle,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  Calendar,
  Layers,
  HeadphonesIcon,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { APP_CONFIG } from '../config/app.config';
import { useApp } from '../context/AppContext';
import { normalizeCurrencySymbol } from '../utils/pricing';
import type { OrderStatus } from '../types';
import { PlatformIcon } from '../components/common/PlatformIcon';
import { StatusText } from '../components/common/StatusText';
import { calculateOrderProgress, getOrderStatusMeta } from '../lib/orderStatus';

type StatusFilterOption =
  | 'All'
  | 'Pending'
  | 'Processing'
  | 'In Progress'
  | 'Completed'
  | 'Partial'
  | 'Cancelled'
  | 'Failed';
type DateFilterOption = 'all' | 'today' | '7d' | '30d';

const PAGE_SIZE = 10;

const STATUS_FILTERS: StatusFilterOption[] = [
  'All',
  'Pending',
  'Processing',
  'In Progress',
  'Completed',
  'Partial',
  'Cancelled',
  'Failed',
];

function matchesOrderStatus(orderStatus: OrderStatus, filter: StatusFilterOption): boolean {
  if (filter === 'All') return true;
  if (filter === 'Cancelled') {
    return orderStatus === 'Canceled' || orderStatus === 'Cancelled';
  }
  return orderStatus === filter;
}

function matchesDateFilter(iso: string, range: DateFilterOption): boolean {
  if (range === 'all') return true;
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed) || parsed <= 0) return true;
  const now = Date.now();
  const diffDays = (now - parsed) / (1000 * 60 * 60 * 24);
  if (range === 'today') return diffDays < 1;
  if (range === '7d') return diffDays <= 7;
  if (range === '30d') return diffDays <= 30;
  return true;
}

export function OrdersPage() {
  const {
    orders,
    services,
    setActiveTab,
    selectedOrderId,
    setSelectedOrderId,
    openSupportForOrder,
    dataError,
    refreshCustomerData,
    isLoading,
    systemSettings,
  } = useApp();

  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('All');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterOption>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, serviceFilter, dateFilter]);

  const uniqueServices = useMemo(() => {
    const map = new Map<string, string>();
    services.forEach((s) => map.set(s.id, s.name));
    orders.forEach((o) => {
      if (!map.has(o.serviceId)) map.set(o.serviceId, o.serviceName);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [orders, services]);

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (!matchesOrderStatus(order.status, statusFilter)) return false;
      if (serviceFilter !== 'all' && order.serviceId !== serviceFilter) return false;
      if (!matchesDateFilter(order.createdAtIso, dateFilter)) return false;
      if (!q) return true;
      return (
        order.orderNumber.toLowerCase().includes(q) ||
        order.id.toLowerCase().includes(q) ||
        order.serviceName.toLowerCase().includes(q) ||
        order.link.toLowerCase().includes(q)
      );
    });
  }, [dateFilter, orders, query, serviceFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredOrders.slice(start, start + PAGE_SIZE);
  }, [filteredOrders, safePage]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId]
  );

  // Order Detail View (strictly excludes providerId, providerOrderId, providerCharge, lastError, internalNote)
  if (selectedOrder) {
    const statusMeta = getOrderStatusMeta(selectedOrder.status);
    const progress = calculateOrderProgress(selectedOrder);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedOrderId(null)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-bold text-slate-800 hover:border-violet-200 hover:text-violet-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to All Orders</span>
          </button>

          <div className="flex items-center gap-2">
            {selectedOrder.refunded && <StatusText status="Refunded" />}
            <StatusText status={selectedOrder.status} />
          </div>
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          {/* Header Block */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <PlatformIcon platform={selectedOrder.categoryId} size="lg" />
              <div className="min-w-0">
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md tabular-nums">
                  Order #{selectedOrder.orderNumber}
                </span>
                <h1 className="mt-1.5 font-display text-lg sm:text-xl font-extrabold text-slate-950 truncate">
                  {selectedOrder.serviceName}
                </h1>
                <p className="mt-0.5 text-xs font-medium text-violet-700">
                  {statusMeta.bnDescription}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <p className="text-[11px] font-medium text-slate-500">Order Price</p>
              <p className="font-display text-xl font-extrabold text-violet-800 tabular-nums">
                {currencySymbol} {selectedOrder.charge.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Progress Visualization */}
          <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-800">Delivery Progress</p>
              <span className="font-mono text-xs font-extrabold text-violet-800 tabular-nums">
                {progress.percent}%
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  selectedOrder.status === 'Cancelled' ||
                  selectedOrder.status === 'Canceled' ||
                  selectedOrder.status === 'Failed'
                    ? 'bg-rose-500'
                    : selectedOrder.status === 'Completed'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-500'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="rounded-xl bg-white p-2.5 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Start Count</p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                  {(selectedOrder.startCount ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Delivered</p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-emerald-700 tabular-nums">
                  {progress.delivered.toLocaleString()}
                </p>
              </div>
              <div className="rounded-xl bg-white p-2.5 border border-slate-100">
                <p className="text-[10px] font-semibold uppercase text-slate-500">Remains</p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-900 tabular-nums">
                  {progress.remains.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Target Link */}
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Target Link
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-medium text-slate-900 break-all">
                {selectedOrder.link}
              </p>
              <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Order ID</p>
              <p className="mt-1 font-mono text-xs sm:text-sm font-bold text-slate-900 truncate">
                #{selectedOrder.orderNumber}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Ordered Quantity</p>
              <p className="mt-1 text-sm font-bold text-slate-900 tabular-nums">
                {selectedOrder.quantity.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Order Date</p>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">
                {selectedOrder.createdAtLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
              <p className="text-[11px] font-medium text-slate-500">Last Updated</p>
              <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">
                {selectedOrder.updatedAtLabel ?? selectedOrder.createdAtLabel}
              </p>
            </div>

            {selectedOrder.lastCheckedAtLabel && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3.5">
                <p className="text-[11px] font-medium text-slate-500">Last Checked</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-800">
                  {selectedOrder.lastCheckedAtLabel}
                </p>
              </div>
            )}

            {selectedOrder.completedAtLabel && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5">
                <p className="text-[11px] font-medium text-emerald-700">Completed At</p>
                <p className="mt-1 text-xs sm:text-sm font-semibold text-emerald-900">
                  {selectedOrder.completedAtLabel}
                </p>
              </div>
            )}
          </div>

          {/* Customer Support Escalation CTA */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-900">
                এই অর্ডার নিয়ে সমস্যা?
              </p>
              <p className="text-[11px] sm:text-xs text-slate-500">
                ডেলিভারি দেরি, রিফিল বা আংশিক সম্পন্ন অর্ডারের জন্য সরাসরি টিকেট ওপেন করুন।
              </p>
            </div>
            <button
              type="button"
              onClick={() => openSupportForOrder(`#${selectedOrder.orderNumber}`)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-violet-800 whitespace-nowrap"
            >
              <HeadphonesIcon className="h-4 w-4" aria-hidden="true" />
              <span>সাপোর্ট টিকেট খুলুন</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            My Orders
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Real-time order tracking with start count, remains, and delivery progress.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('home')}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-violet-800 whitespace-nowrap"
        >
          <PlusCircle className="h-4 w-4" aria-hidden="true" />
          <span>New Order</span>
        </button>
      </div>

      {dataError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>অর্ডারের তথ্য লোড করতে সমস্যা হচ্ছে। অনুগ্রহ করে আবার চেষ্টা করুন।</span>
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

      {/* Search & Multi-Filters */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
        <div className="grid gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-5">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Order ID, service, or target link..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="relative sm:col-span-4">
            <Layers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              aria-label="Filter by service"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-none"
            >
              <option value="all">All Services</option>
              {uniqueServices.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative sm:col-span-3">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <select
              aria-label="Filter by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilterOption)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm font-medium text-slate-800 focus:border-violet-500 focus:bg-white focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl bg-slate-50 p-1">
          {STATUS_FILTERS.map((status) => {
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`h-9 rounded-lg px-3 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-violet-50 hover:text-violet-800'
                }`}
              >
                {status}
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : paginatedOrders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">No matching orders found</p>
            <p className="mt-1 text-xs text-slate-500">
              {orders.length === 0
                ? 'You have not placed any orders yet. Place your first order from the dashboard.'
                : 'Try adjusting your search or filter selections.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paginatedOrders.map((order) => {
              const meta = getOrderStatusMeta(order.status);
              const progress = calculateOrderProgress(order);
              return (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left transition-colors hover:bg-violet-50/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <PlatformIcon platform={order.categoryId} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md tabular-nums">
                            #{order.orderNumber}
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 truncate">
                            {order.serviceName}
                          </h3>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{order.link}</p>
                        <p className="mt-0.5 text-[11px] font-medium text-violet-700">
                          {meta.bnDescription}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end shrink-0 border-t border-slate-100 pt-2.5 sm:border-t-0 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <p className="text-xs font-bold text-slate-900 tabular-nums">
                          {order.quantity.toLocaleString()} qty
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 tabular-nums">
                          {currencySymbol}
                          {order.charge.toFixed(2)} · {order.createdAtLabel}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {order.refunded && <StatusText status="Refunded" />}
                        <StatusText status={order.status} />
                      </div>
                      <ChevronRight
                        className="hidden sm:block h-4 w-4 text-slate-400"
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  {/* Start Count / Remains / Progress Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/90 px-3 py-2 text-[11px]">
                    <div className="flex flex-wrap items-center gap-3 text-slate-600 tabular-nums">
                      <span>
                        Start: <strong className="text-slate-900">{(order.startCount ?? 0).toLocaleString()}</strong>
                      </span>
                      <span>
                        Remains: <strong className="text-slate-900">{progress.remains.toLocaleString()}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 min-w-[130px] flex-1 max-w-[220px]">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full ${
                            order.status === 'Cancelled' ||
                            order.status === 'Canceled' ||
                            order.status === 'Failed'
                              ? 'bg-rose-500'
                              : order.status === 'Completed'
                                ? 'bg-emerald-500'
                                : 'bg-violet-600'
                          }`}
                          style={{ width: `${progress.percent}%` }}
                        />
                      </div>
                      <span className="font-mono font-bold text-slate-700 tabular-nums">
                        {progress.percent}%
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination Strip */}
        {!isLoading && filteredOrders.length > PAGE_SIZE && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-xs">
            <span className="text-slate-500 tabular-nums">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredOrders.length)} of {filteredOrders.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
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
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
