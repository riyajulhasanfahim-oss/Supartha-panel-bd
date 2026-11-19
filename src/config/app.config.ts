/**
 * White-label application configuration.
 * In Phase 2+, brand settings, active currency, and backend provider bindings
 * can be hydrated dynamically from the Admin Panel & App Initialization layer.
 */
export const BRAND_LOGO_PATH = '/assets/aistudio/IMG-20261118-WA0008_046cde3e.jpg';

const LEGACY_BRAND_NAMES = new Set([
  'rj world bd',
  'dukhu vibes panel',
  'dukhu vibes',
  'smm panel',
]);

export interface AppBrandConfig {
  brandName: string;
  brandTagline: string;
  brandLogoUrl: string;
  currencySymbol: string;
  currencyCode: string;
  supportEmail: string;
  supportHours: string;
  dataSourceMode: 'demo' | 'remote';
}

export const APP_CONFIG: AppBrandConfig = {
  brandName: 'Supartha Panel',
  brandTagline: 'SMM Panel',
  brandLogoUrl: BRAND_LOGO_PATH,
  currencySymbol: '৳',
  currencyCode: 'BDT',
  supportEmail: 'support@suparthapanel.com',
  supportHours: '24/7 Live Assistance',
  dataSourceMode: 'remote',
};

export function resolveBrandName(rawName?: string | null): string {
  const trimmed = rawName?.trim() ?? '';
  if (!trimmed || LEGACY_BRAND_NAMES.has(trimmed.toLowerCase())) {
    return APP_CONFIG.brandName;
  }
  return trimmed;
}

export function resolveBrandLogoUrl(rawLogo?: string | null): string {
  const trimmed = rawLogo?.trim() ?? '';
  if (trimmed && (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/'))) {
    return trimmed;
  }
  return APP_CONFIG.brandLogoUrl;
}

export function resolveBrandFaviconUrl(rawFavicon?: string | null): string {
  const trimmed = rawFavicon?.trim() ?? '';
  if (trimmed && (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/'))) {
    return trimmed;
  }
  return APP_CONFIG.brandLogoUrl;
}
