import { resolveActiveFirebaseConfig } from '../firebase/configManager';
import type { AdminStaffRole, FirestoreSettingsDoc, UserAccountRole, UserAccountStatus } from '../firestore/collections';
import type {
  CustomerPaymentRequest,
  CustomerProfile,
  NotificationItem,
  OrderRecord,
  OrderStatsSummary,
  PaymentMethodItem,
  PlatformCategory,
  PlatformId,
  SmmService,
  SupportTicket,
  WalletSummary,
} from '../../types';

export interface PublicStartupSnapshot {
  systemSettings: Partial<FirestoreSettingsDoc> | null;
  platforms: PlatformCategory[];
  services: SmmService[];
  paymentMethods: PaymentMethodItem[];
  selectedPlatform?: PlatformId;
  cachedAt: number;
}

export interface UserStartupSnapshot {
  uid: string;
  profile: CustomerProfile | null;
  accountStatus: UserAccountStatus;
  userRole: UserAccountRole;
  staffRole: AdminStaffRole | null;
  wallet: WalletSummary;
  orderStats: OrderStatsSummary;
  orders: OrderRecord[];
  notifications: NotificationItem[];
  tickets: SupportTicket[];
  paymentRequests: CustomerPaymentRequest[];
  cachedAt: number;
}

const PUBLIC_CACHE_PREFIX = 'spp_public_cache_v2';
const USER_CACHE_PREFIX = 'dvp_user_cache_v1';
const LAST_UID_PREFIX = 'dvp_last_uid_v1';

function getScopeKey(): string {
  const cfg = resolveActiveFirebaseConfig();
  if (!cfg) return 'default';
  return `${cfg.projectId}__${cfg.firestoreDatabaseId || 'default'}`;
}

function getPublicCacheKey(): string {
  return `${PUBLIC_CACHE_PREFIX}::${getScopeKey()}`;
}

function getLastUidKey(): string {
  return `${LAST_UID_PREFIX}::${getScopeKey()}`;
}

function getUserCacheKey(uid: string): string {
  return `${USER_CACHE_PREFIX}::${getScopeKey()}::${uid}`;
}

function sanitizeSystemSettings(
  settings: Partial<FirestoreSettingsDoc> | null
): Partial<FirestoreSettingsDoc> | null {
  if (!settings) return null;
  const clone: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(settings)) {
    if (key === 'updatedAt' || key === 'createdAt') continue;
    clone[key] = val;
  }
  return clone as Partial<FirestoreSettingsDoc>;
}

export function readPublicStartupCache(): PublicStartupSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getPublicCacheKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublicStartupSnapshot>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      systemSettings: parsed.systemSettings ?? null,
      platforms: Array.isArray(parsed.platforms) ? parsed.platforms : [],
      services: Array.isArray(parsed.services) ? parsed.services : [],
      paymentMethods: Array.isArray(parsed.paymentMethods) ? parsed.paymentMethods : [],
      selectedPlatform: parsed.selectedPlatform,
      cachedAt: Number(parsed.cachedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export function writePublicStartupCache(
  snapshot: Omit<PublicStartupSnapshot, 'cachedAt'>
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: PublicStartupSnapshot = {
      systemSettings: sanitizeSystemSettings(snapshot.systemSettings),
      platforms: snapshot.platforms,
      services: snapshot.services,
      paymentMethods: snapshot.paymentMethods,
      selectedPlatform: snapshot.selectedPlatform,
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(getPublicCacheKey(), JSON.stringify(payload));
  } catch {
    // Ignore quota or storage restriction errors
  }
}

export function clearPublicStartupCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(getPublicCacheKey());
  } catch {
    // Ignore
  }
}

export function readLastActiveUid(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const uid = window.localStorage.getItem(getLastUidKey());
    return uid && uid.trim() ? uid.trim() : null;
  } catch {
    return null;
  }
}

export function writeLastActiveUid(uid: string | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (uid && uid.trim()) {
      window.localStorage.setItem(getLastUidKey(), uid.trim());
    } else {
      window.localStorage.removeItem(getLastUidKey());
    }
  } catch {
    // Ignore
  }
}

export function readUserStartupCache(uid: string): UserStartupSnapshot | null {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(getUserCacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserStartupSnapshot>;
    if (!parsed || parsed.uid !== uid) return null;
    return {
      uid,
      profile: parsed.profile ?? null,
      accountStatus: parsed.accountStatus ?? 'active',
      userRole: parsed.userRole ?? 'user',
      staffRole: parsed.staffRole ?? null,
      wallet: parsed.wallet ?? { balance: 0, totalSpent: 0, totalDeposited: 0 },
      orderStats: parsed.orderStats ?? { totalOrders: 0, completedOrders: 0, pendingOrders: 0 },
      orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      tickets: Array.isArray(parsed.tickets) ? parsed.tickets : [],
      paymentRequests: Array.isArray(parsed.paymentRequests) ? parsed.paymentRequests : [],
      cachedAt: Number(parsed.cachedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export function writeUserStartupCache(
  uid: string,
  snapshot: Omit<UserStartupSnapshot, 'uid' | 'cachedAt'>
): void {
  if (!uid || typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: UserStartupSnapshot = {
      uid,
      profile: snapshot.profile,
      accountStatus: snapshot.accountStatus,
      userRole: snapshot.userRole,
      staffRole: snapshot.staffRole,
      wallet: snapshot.wallet,
      orderStats: snapshot.orderStats,
      orders: snapshot.orders.slice(0, 30),
      notifications: snapshot.notifications.slice(0, 30),
      tickets: snapshot.tickets.slice(0, 30),
      paymentRequests: snapshot.paymentRequests.slice(0, 30),
      cachedAt: Date.now(),
    };
    window.localStorage.setItem(getUserCacheKey(uid), JSON.stringify(payload));
  } catch {
    // Ignore storage limits
  }
}

export function clearUserStartupCache(uid?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (uid) {
      window.localStorage.removeItem(getUserCacheKey(uid));
    }
  } catch {
    // Ignore
  }
}

const preloadedBannerUrls = new Set<string>();

export function warmBrandAndBannerAssets(
  settings: Partial<FirestoreSettingsDoc> | null | undefined
): void {
  if (typeof window === 'undefined' || !settings) return;
  const rawBanners = (settings.defaultSettings as { bannerImages?: unknown } | undefined)
    ?.bannerImages;
  if (Array.isArray(rawBanners)) {
    rawBanners.slice(0, 2).forEach((entry) => {
      if (typeof entry === 'string') {
        const url = entry.trim();
        if (/^https?:\/\//i.test(url) && !preloadedBannerUrls.has(url)) {
          preloadedBannerUrls.add(url);
          const img = new Image();
          img.src = url;
        }
      }
    });
  }
  const logoUrl = settings.logo?.trim();
  if (
    logoUrl &&
    (/^https?:\/\//i.test(logoUrl) || logoUrl.startsWith('/')) &&
    !preloadedBannerUrls.has(logoUrl)
  ) {
    preloadedBannerUrls.add(logoUrl);
    const img = new Image();
    img.src = logoUrl;
  }
}
