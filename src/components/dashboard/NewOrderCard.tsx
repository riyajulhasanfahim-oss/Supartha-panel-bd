import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingCart,
  Zap,
  Link2,
  Hash,
  Rocket,
  ChevronDown,
  Info,
  ShieldCheck,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import type { PlatformId } from '../../types';
import { PlatformIcon } from '../common/PlatformIcon';
import {
  calculateOrderCharge,
  isPackageService,
  normalizeCurrencySymbol,
} from '../../utils/pricing';

const QUANTITY_PRESETS = [
  { label: '250', value: 250 },
  { label: '500', value: 500 },
  { label: '1K', value: 1000 },
  { label: '5K', value: 5000 },
];

export function NewOrderCard() {
  const {
    platforms,
    services,
    selectedPlatform,
    setSelectedPlatform,
    placeDemoOrder,
    wallet,
    navigateProtected,
    firebaseUser,
    requireAuthForOrder,
    orderDraft,
    consumeOrderDraft,
    isLoading,
    systemSettings,
  } = useApp();

  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  const categoryServices = useMemo(
    () => services.filter((s) => s.categoryId === selectedPlatform),
    [services, selectedPlatform]
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [quantityInput, setQuantityInput] = useState<string>('1000');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const submittingRef = useRef<boolean>(false);
  const attemptKeyRef = useRef<string>('');

  useEffect(() => {
    attemptKeyRef.current = '';
  }, [selectedPlatform, selectedServiceId, link, quantityInput]);

  useEffect(() => {
    if (!orderDraft) return;
    if (orderDraft.categoryId === selectedPlatform) {
      if (orderDraft.serviceId) {
        setSelectedServiceId(orderDraft.serviceId);
        if (!orderDraft.quantity) {
          const found = categoryServices.find((s) => s.id === orderDraft.serviceId);
          if (found) {
            const current = Number(quantityInput) || 0;
            if (current < found.minQuantity || current > found.maxQuantity) {
              setQuantityInput(String(Math.min(found.maxQuantity, Math.max(found.minQuantity, 1000))));
            }
          }
        }
      }
      if (orderDraft.link) {
        setLink(orderDraft.link);
      }
      if (orderDraft.quantity) {
        setQuantityInput(orderDraft.quantity);
      }
      consumeOrderDraft();
    }
  }, [orderDraft, selectedPlatform, categoryServices, quantityInput, consumeOrderDraft]);

  useEffect(() => {
    if (categoryServices.length > 0 && !categoryServices.some((s) => s.id === selectedServiceId)) {
      const next = categoryServices[0];
      setSelectedServiceId(next.id);
      const currentNum = Number(quantityInput) || 0;
      if (currentNum < next.minQuantity || currentNum > next.maxQuantity) {
        setQuantityInput(String(Math.min(next.maxQuantity, Math.max(next.minQuantity, 1000))));
      }
    } else if (categoryServices.length === 0 && selectedServiceId !== '') {
      setSelectedServiceId('');
    }
  }, [categoryServices, quantityInput, selectedServiceId]);

  const selectedCategoryName = useMemo(() => {
    const found = platforms.find((p) => p.id === selectedPlatform);
    if (found) return found.name;
    const norm = String(selectedPlatform || '').toLowerCase();
    if (norm.includes('traffic')) return 'Web Traffic';
    if (norm.includes('linkedin')) return 'LinkedIn';
    return selectedPlatform;
  }, [platforms, selectedPlatform]);

  const linkPlaceholder = useMemo(() => {
    const norm = String(selectedPlatform || '').toLowerCase();
    if (norm === 'x') return 'https://x.com/username';
    if (norm.includes('traffic')) return 'https://example.com/landing-page';
    if (norm.includes('linkedin')) return 'https://www.linkedin.com/in/username';
    return `https://${selectedPlatform}.com/username`;
  }, [selectedPlatform]);

  const activeService = useMemo(
    () => categoryServices.find((s) => s.id === selectedServiceId) ?? categoryServices[0],
    [categoryServices, selectedServiceId]
  );

  const handleSelectService = (nextId: string) => {
    setSelectedServiceId(nextId);
    const found = categoryServices.find((s) => s.id === nextId);
    if (found) {
      const current = Number(quantityInput) || 0;
      if (current < found.minQuantity || current > found.maxQuantity) {
        setQuantityInput(String(Math.min(found.maxQuantity, Math.max(found.minQuantity, 1000))));
      }
    }
  };

  const numericQuantity = Math.max(0, Math.floor(Number(quantityInput) || 0));
  const serviceRate = activeService?.ratePerThousand ?? 0;
  const activeIsPackage = isPackageService(activeService);
  const totalCost = calculateOrderCharge(numericQuantity, serviceRate, activeIsPackage);
  const outOfRange =
    Boolean(activeService) &&
    (numericQuantity < activeService.minQuantity || numericQuantity > activeService.maxQuantity);
  const insufficientBalance = Boolean(firebaseUser) && totalCost > wallet.balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      requireAuthForOrder({
        categoryId: selectedPlatform,
        serviceId: activeService?.id ?? '',
        link,
        quantity: quantityInput,
      });
      return;
    }
    if (!activeService || submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    if (!attemptKeyRef.current) {
      attemptKeyRef.current = `${10258 + Math.floor(Math.random() * 89000)}-${Date.now()
        .toString()
        .slice(-4)}`;
    }
    try {
      const ok = await placeDemoOrder({
        categoryId: selectedPlatform,
        serviceId: activeService.id,
        link,
        quantity: numericQuantity,
        idempotencyKey: attemptKeyRef.current,
      });
      if (ok) {
        attemptKeyRef.current = '';
        setLink('');
      }
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="new-order-card"
      aria-labelledby="new-order-heading"
      className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm shadow-violet-950/5 transition-shadow duration-200 hover:shadow-md hover:shadow-violet-950/8"
    >
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-gradient-to-r from-[#5B21B6] via-[#7C3AED] to-[#6D28D9] px-4 py-2.5 sm:px-5 sm:py-3 text-white">
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          <h2 id="new-order-heading" className="font-display text-sm sm:text-base font-bold tracking-tight">
            New Order
          </h2>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-slate-950/30 px-2.5 py-0.5 text-[11px] font-semibold text-white whitespace-nowrap">
          <span>{activeService?.deliverySpeed ?? 'Instant Delivery'}</span>
          <Zap className="h-3 w-3 text-amber-300" aria-hidden="true" />
        </span>
      </div>

      {isLoading && platforms.length === 0 ? (
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
          </div>
          <div className="h-11 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      ) : platforms.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-sm font-bold text-slate-800">No active categories available</p>
          <p className="mt-1 text-xs text-slate-500">
            Categories and services will appear once activated by the administrator.
          </p>
        </div>
      ) : (
        <form noValidate={!firebaseUser} onSubmit={handleSubmit} className="space-y-3.5 p-3.5 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Select Category */}
            <div>
              <label htmlFor="order-category" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                Select Category
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3">
                  <PlatformIcon
                    platform={selectedPlatform}
                    name={platforms.find((p) => p.id === selectedPlatform)?.name}
                    icon={platforms.find((p) => p.id === selectedPlatform)?.icon}
                    size="xs"
                  />
                </span>
                <select
                  id="order-category"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value as PlatformId)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs sm:text-sm font-medium text-slate-900 shadow-2xs transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                >
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  ))}
                  {!platforms.some((p) => p.id === selectedPlatform) && (
                    <option value={selectedPlatform}>
                      {selectedPlatform === 'webtraffic' || selectedPlatform === 'web-traffic'
                        ? 'Web Traffic'
                        : selectedPlatform === 'linkedin'
                          ? 'LinkedIn'
                          : selectedPlatform}
                    </option>
                  )}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
              </div>
            </div>

            {/* Select Service */}
            <div>
              <label htmlFor="order-service" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                Select Service
              </label>
              <div className="relative flex items-center">
                <span className="pointer-events-none absolute left-3">
                  <PlatformIcon
                    platform={selectedPlatform}
                    name={platforms.find((p) => p.id === selectedPlatform)?.name}
                    icon={platforms.find((p) => p.id === selectedPlatform)?.icon}
                    size="xs"
                  />
                </span>
                <select
                  id="order-service"
                  value={activeService?.id ?? ''}
                  disabled={categoryServices.length === 0}
                  onChange={(e) => handleSelectService(e.target.value)}
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-8 text-xs sm:text-sm font-medium text-slate-900 shadow-2xs transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20 truncate disabled:opacity-60"
                >
                  {categoryServices.length === 0 ? (
                    <option value="">No active services in this category</option>
                  ) : (
                    categoryServices.map((srv) => (
                      <option key={srv.id} value={srv.id}>
                        {srv.name} ({currencySymbol}
                        {srv.ratePerThousand.toFixed(2)}/{isPackageService(srv) ? 'Pkg' : '1K'})
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 h-4 w-4 text-slate-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {categoryServices.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-6 text-center">
              <p className="text-sm font-bold text-slate-800">
                No active services available for {selectedCategoryName}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Services added and activated by the administrator under {selectedCategoryName} will appear here automatically.
              </p>
            </div>
          ) : (
            <>
              {/* Link Input */}
              <div>
                <label htmlFor="order-link" className="block text-[11px] sm:text-xs font-semibold text-slate-700 mb-1">
                  Link
                </label>
                <div className="relative flex items-center">
                  <Link2 className="pointer-events-none absolute left-3 h-4 w-4 text-violet-600" aria-hidden="true" />
                  <input
                    id="order-link"
                    type="url"
                    required
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder={linkPlaceholder}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 shadow-2xs transition-all duration-200 hover:border-violet-300 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
              </div>

          {/* Quantity + Presets */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label htmlFor="order-quantity" className="block text-[11px] sm:text-xs font-semibold text-slate-700">
                Quantity
              </label>
              {activeService && (
                <span className="text-[11px] font-medium text-slate-500 tabular-nums">
                  Min {activeService.minQuantity.toLocaleString()} · Max {activeService.maxQuantity.toLocaleString()}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Hash className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-600" aria-hidden="true" />
                <input
                  id="order-quantity"
                  type="number"
                  min={activeService?.minQuantity ?? 1}
                  max={activeService?.maxQuantity ?? 1000000}
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  className={`h-10 w-full rounded-xl border pl-9 pr-3.5 text-xs sm:text-sm font-semibold text-slate-900 tabular-nums shadow-2xs transition-all duration-200 focus:bg-white focus:outline-none focus:ring-2 ${
                    outOfRange
                      ? 'border-rose-300 bg-rose-50/50 focus:border-rose-500 focus:ring-rose-500/20'
                      : 'border-slate-200 bg-slate-50/70 hover:border-violet-300 focus:border-violet-500 focus:ring-violet-500/20'
                  }`}
                />
              </div>

              <div className="grid grid-cols-4 gap-1.5 sm:w-auto">
                {QUANTITY_PRESETS.map((preset) => {
                  const isDisabled =
                    !activeService ||
                    preset.value < activeService.minQuantity ||
                    preset.value > activeService.maxQuantity;
                  const isSelected = !isDisabled && numericQuantity === preset.value;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => setQuantityInput(String(preset.value))}
                      title={
                        isDisabled && activeService
                          ? `Requires ${activeService.minQuantity.toLocaleString()}–${activeService.maxQuantity.toLocaleString()}`
                          : `Set quantity to ${preset.value}`
                      }
                      className={`h-9 sm:h-10 rounded-xl px-2.5 text-xs font-bold transition-all duration-200 tabular-nums active:scale-[0.97] ${
                        isDisabled
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400 opacity-60'
                          : isSelected
                            ? 'bg-violet-700 text-white shadow-xs'
                            : 'bg-violet-50 text-violet-800 hover:bg-violet-100 hover:shadow-2xs'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {outOfRange && activeService && (
              <p className="mt-1 text-[11px] font-semibold text-rose-600">
                Quantity must stay between {activeService.minQuantity.toLocaleString()} and{' '}
                {activeService.maxQuantity.toLocaleString()}.
              </p>
            )}
          </div>

          {/* Service Information Panel (Strictly excludes provider secrets & cost price) */}
          {activeService && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 sm:p-3.5 space-y-2 transition-colors duration-200 hover:border-violet-200/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Info className="h-3.5 w-3.5 text-violet-700 shrink-0" aria-hidden="true" />
                  <h3 className="text-xs font-bold text-slate-900 truncate">{activeService.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] font-semibold">
                  <span className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-slate-700 border border-slate-200/80">
                    <Clock className="h-3 w-3 text-violet-600" aria-hidden="true" />
                    {activeService.averageTime}
                  </span>
                  {activeService.refillGuaranteed && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-700">
                      <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                      Refill Protected
                    </span>
                  )}
                </div>
              </div>

              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                {activeService.description || 'High-retention delivery optimized for steady campaign performance.'}
              </p>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-white p-2 border border-slate-100 text-[11px]">
                <div>
                  <span className="block text-slate-400">Minimum</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    {activeService.minQuantity.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Maximum</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    {activeService.maxQuantity.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">
                    {activeIsPackage ? 'Price / Pkg' : 'Rate / 1K'}
                  </span>
                    <span className="font-bold text-violet-700 tabular-nums">
                    {currencySymbol}
                    {activeService.ratePerThousand.toFixed(2)}
                  </span>
                </div>
              </div>

              <p className="text-[10.5px] text-slate-500 leading-snug">
                <span className="font-semibold text-slate-700">Important Notes:</span> Keep the target account or post public until delivery completes. Avoid placing duplicate orders for the same link simultaneously.
              </p>
            </div>
          )}

          {insufficientBalance && activeService && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-semibold">
                    আপনার পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে Add Funds করে আবার চেষ্টা করুন।
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-800">
                    Available: {currencySymbol}
                    {wallet.balance.toFixed(2)} · Required: {currencySymbol}
                    {totalCost.toFixed(2)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigateProtected('funds')}
                className="inline-flex h-8 items-center rounded-xl bg-violet-700 px-3 text-xs font-bold text-white shadow-xs hover:bg-violet-800 whitespace-nowrap"
              >
                Add Funds
              </button>
            </div>
          )}

          {/* Pricing Summary + Place Order CTA */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-violet-100 bg-violet-50/50 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-2 divide-x divide-violet-200/80 sm:flex sm:items-center sm:gap-6 sm:divide-x-0">
              <div className="pr-3 sm:pr-0">
                <p className="text-[11px] font-medium text-slate-500">
                  {activeIsPackage ? 'Package Price' : 'Service Price'}
                </p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-extrabold text-slate-900 tabular-nums">
                  {currencySymbol} {serviceRate.toFixed(2)}
                </p>
              </div>
              <div className="pl-4 sm:border-l sm:border-violet-200/80 sm:pl-6">
                <p className="text-[11px] font-medium text-slate-500">Total Cost</p>
                <p className="mt-0.5 font-display text-base sm:text-lg font-extrabold text-violet-800 tabular-nums">
                  {currencySymbol} {totalCost.toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !activeService || outOfRange || insufficientBalance}
              className="inline-flex h-10 sm:h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 text-xs sm:text-sm font-bold text-white shadow-md shadow-violet-700/20 transition-all duration-200 hover:from-violet-800 hover:to-purple-700 hover:shadow-lg hover:shadow-violet-700/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 whitespace-nowrap"
            >
              <span>{isSubmitting ? 'Placing Order...' : 'Place Order'}</span>
              <Rocket className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
            </>
          )}
        </form>
      )}
    </section>
  );
}
