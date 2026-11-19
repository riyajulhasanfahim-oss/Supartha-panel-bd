import React, { useMemo, useState } from 'react';
import { Search, ArrowRight, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../config/app.config';
import { useApp } from '../context/AppContext';
import type { PlatformId } from '../types';
import { PlatformIcon } from '../components/common/PlatformIcon';
import { isPackageService, normalizeCurrencySymbol } from '../utils/pricing';

export function ServicesPage() {
  const { platforms, services, selectPlatformForOrder, isLoading, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );
  const [filterPlatform, setFilterPlatform] = useState<'all' | PlatformId>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((srv) => {
      const matchPlat = filterPlatform === 'all' || srv.categoryId === filterPlatform;
      const matchSearch =
        !q || srv.name.toLowerCase().includes(q) || srv.description.toLowerCase().includes(q);
      return matchPlat && matchSearch;
    });
  }, [services, filterPlatform, search]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">Service Catalog</h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
          Browse verified social growth rates per 1,000 units and jump straight to ordering.
        </p>
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterPlatform('all')}
            className={`h-8 rounded-xl px-3 text-xs font-semibold transition-all duration-200 active:scale-[0.98] whitespace-nowrap shrink-0 ${
              filterPlatform === 'all'
                ? 'bg-violet-700 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:border-violet-300 hover:shadow-2xs'
            }`}
          >
            All Platforms
          </button>
          {platforms.map((plat) => {
            const active = filterPlatform === plat.id;
            return (
              <button
                key={plat.id}
                type="button"
                onClick={() => setFilterPlatform(plat.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-all duration-200 active:scale-[0.98] whitespace-nowrap shrink-0 ${
                  active
                    ? 'bg-violet-700 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-violet-300 hover:shadow-2xs'
                }`}
              >
                <PlatformIcon platform={plat.id} name={plat.name} icon={plat.icon} size="xs" />
                <span>{plat.shortName}</span>
              </button>
            );
          })}
        </div>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter services..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
      </div>

      {/* Services Cards */}
      {isLoading && services.length === 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="h-32 rounded-2xl bg-slate-200/70 animate-pulse" />
          <div className="h-32 rounded-2xl bg-slate-200/70 animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-800">No services found</p>
          <p className="mt-1 text-xs text-slate-500">
            Try choosing a different category or clearing your search query.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((srv) => (
          <div
            key={srv.id}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md hover:shadow-violet-950/5"
          >
            <div>
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="transition-transform duration-200 group-hover:scale-105">
                    <PlatformIcon
                      platform={srv.categoryId}
                      name={platforms.find((p) => p.id === srv.categoryId)?.name}
                      icon={platforms.find((p) => p.id === srv.categoryId)?.icon}
                      size="sm"
                    />
                  </span>
                  <h2 className="font-display text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                    {srv.name}
                  </h2>
                </div>
                <span className="font-mono text-xs sm:text-sm font-extrabold text-violet-800 whitespace-nowrap tabular-nums shrink-0">
                  {currencySymbol}
                  {srv.ratePerThousand.toFixed(2)} / {isPackageService(srv) ? 'Pkg' : '1K'}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-600 leading-relaxed line-clamp-2">{srv.description}</p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500 tabular-nums">
                {srv.serviceType && (
                  <>
                    <span className="rounded-md bg-violet-50 px-2 py-0.5 font-semibold text-violet-700">
                      {srv.serviceType}
                    </span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>Min {srv.minQuantity.toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>Avg {srv.averageTime}</span>
                {srv.refillGuaranteed && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      30d Refill
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => selectPlatformForOrder(srv.categoryId, srv.id)}
                className="inline-flex h-8 items-center gap-1 rounded-xl bg-violet-50 px-3 text-xs font-bold text-violet-800 transition-all duration-200 hover:bg-violet-700 hover:text-white hover:shadow-xs active:scale-[0.97] whitespace-nowrap"
              >
                <span>Order</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        </div>
      )}
    </div>
  );
}
