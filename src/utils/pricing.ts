import { APP_CONFIG } from '../config/app.config';

export const DEFAULT_USD_TO_BDT_RATE = 122;

export type ProviderRateCurrency = 'BDT' | 'USD';

/**
 * Strips accidental numeric suffixes appended to the BDT currency symbol
 * (for example, "৳20" saved inside settings/system.currencySymbol -> "৳")
 * and ensures a clean display symbol fallback.
 */
export function normalizeCurrencySymbol(
  rawSymbol?: string | null,
  currencyCode?: string | null
): string {
  const trimmed = typeof rawSymbol === 'string' ? rawSymbol.trim() : '';
  if (!trimmed) return APP_CONFIG.currencySymbol;

  const isBdt = currencyCode?.trim().toUpperCase() === 'BDT';
  if (trimmed.startsWith('৳')) {
    const withoutDigits = trimmed.replace(/\s*\d+(?:[.,]\d+)?\s*$/u, '').trim();
    return withoutDigits || '৳';
  }

  if (isBdt) {
    if (/^\d+(?:[.,]\d+)?$/u.test(trimmed)) {
      return '৳';
    }
    const stripped = trimmed.replace(/\s*\d+(?:[.,]\d+)?\s*$/u, '').trim();
    return stripped || '৳';
  }

  if (/^\d+(?:[.,]\d+)?$/u.test(trimmed)) {
    return APP_CONFIG.currencySymbol;
  }

  return trimmed;
}

/**
 * Checks if an existing settings currencySymbol value contains an unintended
 * numeric suffix (e.g. "৳20") that needs cleanup.
 */
export function hasCorruptedCurrencySymbol(
  rawSymbol?: string | null,
  currencyCode?: string | null
): boolean {
  const trimmed = typeof rawSymbol === 'string' ? rawSymbol.trim() : '';
  if (!trimmed) return false;
  return normalizeCurrencySymbol(trimmed, currencyCode) !== trimmed;
}

/**
 * Detects whether a service is priced per package (e.g. Package type or min=1, max=1)
 * rather than per 1,000 units.
 */
export function isPackageService(srv?: {
  serviceType?: string | null;
  deliverySpeed?: string | null;
  description?: string | null;
  minQuantity?: number | null;
  maxQuantity?: number | null;
  providerType?: string | null;
} | null): boolean {
  if (!srv) return false;
  if (typeof srv.providerType === 'string' && /\bpackage\b/i.test(srv.providerType)) {
    return true;
  }
  if (typeof srv.serviceType === 'string' && /^package$/i.test(srv.serviceType.trim())) {
    return true;
  }
  if (typeof srv.deliverySpeed === 'string' && /\bpackage\b/i.test(srv.deliverySpeed)) {
    return true;
  }
  if (typeof srv.description === 'string' && /\(\s*package\s*\)/i.test(srv.description)) {
    return true;
  }
  const minQty = Number(srv.minQuantity ?? 0);
  const maxQty = Number(srv.maxQuantity ?? 0);
  return minQty === 1 && maxQty === 1;
}

/**
 * Single authoritative provider-rate to customer-selling-price calculator.
 * - Converts USD -> BDT at most once using the configured exchange rate.
 * - Leaves BDT provider rates unconverted (multiplier = 1).
 * - Adds Admin Profit strictly once per 1,000 units (or once per package).
 */
export function calculateProviderServicePricing(input: {
  rawProviderRate: number;
  providerCurrency: ProviderRateCurrency;
  exchangeRateUsdToBdt?: number;
  profitAmount: number;
}): { costPriceBdt: number; sellingPriceBdt: number } {
  const rawRate = Math.max(0, Number(input.rawProviderRate) || 0);
  const profit = Math.max(0, Number(input.profitAmount) || 0);
  const parsedRate = Number(input.exchangeRateUsdToBdt);
  const multiplier =
    input.providerCurrency === 'USD'
      ? Number.isFinite(parsedRate) && parsedRate > 0
        ? parsedRate
        : DEFAULT_USD_TO_BDT_RATE
      : 1;

  const costPriceBdt = Number((rawRate * multiplier).toFixed(4));
  const sellingPriceBdt = Number((costPriceBdt + profit).toFixed(4));
  return { costPriceBdt, sellingPriceBdt };
}

/**
 * Calculates final order cost cleanly:
 * - Standard services: proportional (quantity / 1000) * ratePerThousand
 * - Package services: quantity * packagePrice (not divided by 1000)
 */
export function calculateOrderCharge(
  quantity: number,
  unitPrice: number,
  isPackage: boolean
): number {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0));
  const price = Math.max(0, Number(unitPrice) || 0);
  if (isPackage) {
    return Number((qty * price).toFixed(2));
  }
  return Number(((qty / 1000) * price).toFixed(2));
}
