import React from 'react';
import { ArrowRight, ChevronRight, History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PlatformIcon } from '../common/PlatformIcon';
import { StatusText } from '../common/StatusText';

export function RecentOrdersCard() {
  const { orders, navigateProtected, openOrderDetails, isLoading } = useApp();
  const visibleOrders = orders.slice(0, 4);

  return (
    <section aria-labelledby="recent-orders-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-violet-700" aria-hidden="true" />
          <h2 id="recent-orders-heading" className="font-display text-base sm:text-lg font-bold text-slate-900">
            Recent Orders
          </h2>
        </div>

        <button
          type="button"
          onClick={() => navigateProtected('order')}
          className="inline-flex h-8 items-center gap-1 rounded-full bg-white px-3 text-xs font-semibold text-slate-700 border border-slate-200 transition-colors hover:border-violet-200 hover:text-violet-700 whitespace-nowrap"
        >
          <span>View All</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        {isLoading && orders.length === 0 ? (
          <div className="space-y-2 p-4">
            <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">
            No orders placed yet. Submit your first campaign above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {visibleOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openOrderDetails(order.id)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-violet-50/40 sm:px-5"
              >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                  <span className="rounded-lg bg-emerald-50 px-2 py-1 font-mono text-xs font-bold text-emerald-700 tabular-nums shrink-0">
                    #{order.orderNumber}
                  </span>
                  <PlatformIcon platform={order.categoryId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs sm:text-sm font-semibold text-slate-900">
                      {order.serviceName}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 sm:hidden tabular-nums">
                      {order.quantity.toLocaleString()} qty · {order.createdAtLabel}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                  <span className="hidden sm:inline text-xs font-semibold text-slate-800 tabular-nums">
                    {order.quantity.toLocaleString()}
                  </span>
                  <StatusText status={order.status} />
                  <span className="hidden md:inline text-xs text-slate-500 whitespace-nowrap w-20 text-right">
                    {order.createdAtLabel}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
