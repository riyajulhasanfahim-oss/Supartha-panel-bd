import { getFirebaseServices } from '../lib/firebase/client';
import { getActiveFirebaseTargetPayload } from '../lib/firebase/configManager';
import type { PlatformId, ServiceType } from '../types/service.types';

export type ProviderFormat = 'standard_v2';

export interface ProviderCredentials {
  providerId?: string;
  apiUrl: string;
  apiKey: string;
  format?: ProviderFormat | string;
}

export interface ProviderServiceDTO {
  providerServiceId: string;
  name: string;
  category: string;
  type: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  dripfeed: boolean;
  cancel: boolean;
  description: string;
}

export interface ProviderBalanceResult {
  balance: number;
  currency: string;
}

export interface ProviderConnectionResult {
  ok: boolean;
  message: string;
  balance?: number;
  currency?: string;
  serviceCount?: number;
}

export interface ProviderAddOrderInput {
  providerServiceId: string;
  link: string;
  quantity: number;
}

export interface ProviderOrderResult {
  providerOrderId: string;
}

export interface ProviderOrderStatusResult {
  status: string;
  startCount?: number;
  remains?: number;
  charge?: number;
  currency?: string;
}

export interface IProviderAdapter {
  readonly format: ProviderFormat;
  testConnection(config: ProviderCredentials): Promise<ProviderConnectionResult>;
  getServices(config: ProviderCredentials): Promise<ProviderServiceDTO[]>;
  getBalance(config: ProviderCredentials): Promise<ProviderBalanceResult>;
  addOrder(
    config: ProviderCredentials,
    input: ProviderAddOrderInput
  ): Promise<ProviderOrderResult>;
  getOrderStatus(
    config: ProviderCredentials,
    providerOrderId: string
  ): Promise<ProviderOrderStatusResult>;
}

function normalizeErrorText(
  value: unknown,
  fallback: string = 'Provider API request failed.'
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    return value.message?.trim() || fallback;
  }
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => normalizeErrorText(item, ''))
      .filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : fallback;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const field of ['message', 'error', 'detail', 'reason', 'statusText', 'description']) {
      if (record[field] !== undefined && record[field] !== null) {
        const extracted = normalizeErrorText(record[field], '');
        if (extracted) {
          const codePrefix =
            typeof record.code === 'number' || typeof record.code === 'string'
              ? `[${record.code}] `
              : '';
          return `${codePrefix}${extracted}`;
        }
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // fall through
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function sanitizeClientMessage(message: unknown, apiKey: unknown): string {
  const text = normalizeErrorText(message, 'Provider API request failed.');
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (!key) return text;
  return text.split(key).join('[REDACTED]');
}

function parseNumeric(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return fallback;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function parseUpstreamBool(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase();
    return norm === '1' || norm === 'true' || norm === 'yes';
  }
  return false;
}

function unwrapServiceRows(raw: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')
    );
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    for (const key of ['services', 'data', 'result', 'items']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')
        );
      }
    }
    const entries = Object.entries(record);
    if (entries.length > 0 && entries.every(([, v]) => v && typeof v === 'object' && !Array.isArray(v))) {
      return entries.map(([keyId, v]) => {
        const obj = v as Record<string, unknown>;
        return obj.service !== undefined || obj.id !== undefined ? obj : { service: keyId, ...obj };
      });
    }
  }
  return null;
}

function describeProxyNonJson(rawText: string, status: number): string {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return `Provider proxy returned an empty HTTP ${status} response.`;
  }
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(trimmed);
  const snippet = titleMatch?.[1]
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  if (snippet) {
    return `Provider proxy returned HTTP ${status} (${snippet}).`;
  }
  return `Provider proxy returned unexpected HTTP ${status} non-JSON response.`;
}

async function postProviderProxy<T>(
  action: 'testConnection' | 'services' | 'balance' | 'add' | 'status',
  config: ProviderCredentials,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const services = getFirebaseServices();
  const currentUser = services?.auth.currentUser;
  if (!currentUser) {
    throw new Error('Admin authentication required to contact provider API.');
  }

  const providerId = typeof config.providerId === 'string' ? config.providerId.trim() : '';
  const apiUrl = typeof config.apiUrl === 'string' ? config.apiUrl.trim() : '';
  const apiKey = typeof config.apiKey === 'string' ? config.apiKey.trim() : '';

  if (!providerId && (!apiUrl || !apiKey)) {
    throw new Error('Provider API URL and API Key are required.');
  }

  const idToken = await currentUser.getIdToken();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50000);
  let response: Response;
  try {
    response = await fetch('/api/provider/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action,
        format: config.format || 'standard_v2',
        ...(providerId ? { providerId } : { apiUrl, apiKey }),
        ...getActiveFirebaseTargetPayload(),
        ...extra,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Provider API request timed out waiting for server response.');
    }
    throw new Error('Unable to reach internal provider proxy service.');
  } finally {
    clearTimeout(timer);
  }

  let rawText = '';
  try {
    rawText = (await response.text()).replace(/^\uFEFF/, '');
  } catch {
    throw new Error(`Failed to read provider proxy response (HTTP ${response.status}).`);
  }

  let parsedJson: unknown = null;
  if (rawText.trim()) {
    try {
      parsedJson = JSON.parse(rawText);
    } catch {
      throw new Error(sanitizeClientMessage(describeProxyNonJson(rawText, response.status), apiKey));
    }
  }

  const payload =
    parsedJson && typeof parsedJson === 'object' && !Array.isArray(parsedJson)
      ? (parsedJson as { ok?: boolean; data?: T; error?: unknown; message?: unknown })
      : null;

  if (!response.ok || !payload?.ok || payload.data === undefined) {
    const rawErrorSource =
      payload?.error ??
      payload?.message ??
      (Array.isArray(parsedJson) ? null : parsedJson) ??
      `Provider API call failed (HTTP ${response.status}).`;
    const msg = normalizeErrorText(
      rawErrorSource,
      `Provider API call failed (HTTP ${response.status}).`
    );
    throw new Error(sanitizeClientMessage(msg, apiKey));
  }

  return payload.data;
}

/**
 * Standard SMM Panel API v2 Adapter (POST key/action endpoints).
 * Isolated for Admin operations & future automated order dispatch without modifying Customer UI.
 */
export class StandardSmmV2Adapter implements IProviderAdapter {
  readonly format: ProviderFormat = 'standard_v2';

  async testConnection(config: ProviderCredentials): Promise<ProviderConnectionResult> {
    return postProviderProxy<ProviderConnectionResult>('testConnection', config);
  }

  async getBalance(config: ProviderCredentials): Promise<ProviderBalanceResult> {
    return postProviderProxy<ProviderBalanceResult>('balance', config);
  }

  async getServices(config: ProviderCredentials): Promise<ProviderServiceDTO[]> {
    const rawPayload = await postProviderProxy<unknown>('services', config);
    const rawList = unwrapServiceRows(rawPayload);
    if (!rawList) {
      throw new Error('Provider did not return a valid list of services.');
    }
    return rawList
      .map((item) => {
        const providerServiceId = String(
          item.service ?? item.id ?? item.service_id ?? ''
        ).trim();
        const name = String(item.name ?? item.service_name ?? '').trim();
        if (!providerServiceId || !name) return null;

        const min = Math.max(1, Math.floor(parseNumeric(item.min ?? item.min_order, 10)));
        const max = Math.max(min, Math.floor(parseNumeric(item.max ?? item.max_order, 10000)));
        const rate = Math.max(0, parseNumeric(item.rate ?? item.price, 0));

        return {
          providerServiceId,
          name,
          category: String(item.category ?? item.category_name ?? 'General').trim() || 'General',
          type: String(item.type ?? 'Default').trim() || 'Default',
          rate,
          min,
          max,
          refill: parseUpstreamBool(item.refill),
          dripfeed: parseUpstreamBool(item.dripfeed),
          cancel: parseUpstreamBool(item.cancel),
          description:
            typeof item.desc === 'string'
              ? item.desc.trim()
              : typeof item.description === 'string'
                ? item.description.trim()
                : '',
        } satisfies ProviderServiceDTO;
      })
      .filter((entry): entry is ProviderServiceDTO => entry !== null);
  }

  async addOrder(
    config: ProviderCredentials,
    input: ProviderAddOrderInput
  ): Promise<ProviderOrderResult> {
    const result = await postProviderProxy<{ order: string }>('add', config, {
      service: input.providerServiceId,
      link: input.link,
      quantity: input.quantity,
    });
    return {
      providerOrderId: result.order ?? '',
    };
  }

  async getOrderStatus(
    config: ProviderCredentials,
    providerOrderId: string
  ): Promise<ProviderOrderStatusResult> {
    const res = await postProviderProxy<Record<string, unknown>>('status', config, {
      order: providerOrderId,
    });
    return {
      status: String(res.status ?? 'Pending'),
      startCount: res.start_count !== undefined ? Number(res.start_count) : undefined,
      remains: res.remains !== undefined ? Number(res.remains) : undefined,
      charge: res.charge !== undefined ? Number(res.charge) : undefined,
      currency: typeof res.currency === 'string' ? res.currency : undefined,
    };
  }
}

const ADAPTER_REGISTRY: Record<string, IProviderAdapter> = {
  standard_v2: new StandardSmmV2Adapter(),
};

export function getProviderAdapter(format: string = 'standard_v2'): IProviderAdapter {
  return ADAPTER_REGISTRY[format] ?? ADAPTER_REGISTRY.standard_v2;
}

/**
 * Helper to suggest a local platform category ID & ServiceType from an imported provider service row.
 * Uses word-boundary checks to avoid false substring matches (e.g. "10x" or "max" matching X).
 */
export function suggestPlatformAndTypeFromImported(
  serviceName: string,
  providerCategory: string,
  fallbackCategoryId: string = 'instagram'
): { categoryId: PlatformId; serviceType: ServiceType } {
  const combined = `${providerCategory} ${serviceName}`.toLowerCase();

  let categoryId: PlatformId = (fallbackCategoryId || 'more') as PlatformId;
  if (/\b(instagram|insta|igtv|reels)\b|\big\b/i.test(combined)) {
    categoryId = 'instagram';
  } else if (/\b(youtube|yt\s*shorts|youtube\s*shorts)\b|\byt\b/i.test(combined)) {
    categoryId = 'youtube';
  } else if (/\b(facebook|fb\s*page|fb\s*post|fb\s*reels)\b|\bfb\b/i.test(combined)) {
    categoryId = 'facebook';
  } else if (/\b(tiktok|tik\s*tok)\b/i.test(combined)) {
    categoryId = 'tiktok';
  } else if (/\b(telegram)\b|\btg\b/i.test(combined)) {
    categoryId = 'telegram';
  } else if (
    /\b(twitter|tweet|tweets|retweet|retweets|x\.com)\b/i.test(combined) ||
    /(?:^|[\s|/(\[])twitter\s*\/\s*x(?:$|[\s|/)\]])/i.test(combined) ||
    /(?:^|[\s|/(\[])x\s*(?:\(twitter\)|\/\s*twitter)(?:$|[\s|/)\]])/i.test(combined) ||
    (/(?:^|[\s|/:\[(])x(?:$|[\s|/:\])])/.test(combined) &&
      /\b(follower|followers|like|likes|view|views|repost|comment|impression|profile|post|retweet)\b/i.test(
        combined
      ))
  ) {
    categoryId = 'x';
  } else if (/\b(linkedin|linked\s*in)\b/i.test(combined)) {
    categoryId = 'linkedin';
  } else if (
    /\b(web\s*traffic|website\s*traffic|webtraffic|site\s*traffic|organic\s*traffic|google\s*traffic|seo\s*traffic|traffic)\b/i.test(
      combined
    )
  ) {
    categoryId = 'webtraffic';
  }

  let serviceType: ServiceType = 'Other';
  if (/\b(follower|followers)\b/i.test(combined)) serviceType = 'Followers';
  else if (/\b(subscriber|subscribers|sub)\b/i.test(combined)) serviceType = 'Subscribers';
  else if (/\b(member|members)\b/i.test(combined)) serviceType = 'Members';
  else if (/\b(like|likes|reaction|reactions)\b/i.test(combined)) serviceType = 'Likes';
  else if (/\b(view|views|watch\s*time|watchtime|impression|impressions)\b/i.test(combined))
    serviceType = 'Views';
  else if (/\b(comment|comments)\b/i.test(combined)) serviceType = 'Comments';
  else if (/\b(share|shares|repost|reposts|retweet|retweets)\b/i.test(combined))
    serviceType = 'Shares';

  return { categoryId, serviceType };
}

const PLATFORM_ALIASES: Record<string, string[]> = {
  facebook: ['facebook', 'fb'],
  instagram: ['instagram', 'insta', 'ig'],
  youtube: ['youtube', 'yt'],
  tiktok: ['tiktok', 'tik tok'],
  telegram: ['telegram', 'tg'],
  x: ['x', 'twitter', 'x (twitter)', 'twitter / x'],
  linkedin: ['linkedin', 'linked in'],
  webtraffic: ['webtraffic', 'web-traffic', 'web traffic', 'website traffic', 'traffic'],
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function resolveCategoryForImportedService<
  TCat extends { id: string; name: string },
>(
  serviceName: string,
  providerCategory: string,
  existingCategories: TCat[]
): { categoryId: string; categoryName: string; serviceType: ServiceType } {
  const defaultCat =
    existingCategories.find((c) => ['other', 'general', 'more'].includes(c.id.toLowerCase())) ??
    existingCategories[0];
  const fallbackId = defaultCat?.id ?? '';
  const suggested = suggestPlatformAndTypeFromImported(
    serviceName,
    providerCategory,
    fallbackId || 'more'
  );

  if (existingCategories.length === 0) {
    return {
      categoryId: suggested.categoryId,
      categoryName: suggested.categoryId,
      serviceType: suggested.serviceType,
    };
  }

  const combined = `${providerCategory} ${serviceName}`.toLowerCase();

  // 1. Match suggested canonical platform against existing categories (exact ID, alias ID, or name)
  const aliases = PLATFORM_ALIASES[suggested.categoryId] ?? [suggested.categoryId];
  const canonicalMatch = existingCategories.find((cat) => {
    const cid = String(cat.id ?? '').trim().toLowerCase();
    const cname = String(cat.name ?? '').trim().toLowerCase();
    if (cid === suggested.categoryId) return true;
    return aliases.some(
      (alias) =>
        cid === alias ||
        cname === alias ||
        (alias.length >= 3 && (cid.includes(alias) || cname.includes(alias)))
    );
  });

  if (canonicalMatch && suggested.categoryId !== (fallbackId || 'more')) {
    return {
      categoryId: canonicalMatch.id,
      categoryName: canonicalMatch.name,
      serviceType: suggested.serviceType,
    };
  }

  // 2. Dynamically check all existing category names/IDs (e.g. Discord, Spotify, Snapchat, Pinterest, Threads, Twitch)
  const dynamicMatch = existingCategories.find((cat) => {
    const cid = String(cat.id ?? '').trim().toLowerCase();
    const cname = String(cat.name ?? '').trim().toLowerCase();
    const candidates = Array.from(
      new Set([
        cid,
        cname,
        ...cname.split(/[\s/&(),.-]+/).filter((token) => token.length >= 3),
      ])
    ).filter((token) => token.length >= 2 && !['social', 'media', 'more', 'other'].includes(token));

    return candidates.some((token) =>
      new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(combined)
    );
  });

  if (dynamicMatch) {
    return {
      categoryId: dynamicMatch.id,
      categoryName: dynamicMatch.name,
      serviceType: suggested.serviceType,
    };
  }

  // 3. Safe fallback to an existing category document (satisfies Firestore category existence rules)
  const safeFallback = canonicalMatch ?? defaultCat ?? existingCategories[0];
  return {
    categoryId: safeFallback.id,
    categoryName: safeFallback.name,
    serviceType: suggested.serviceType,
  };
}
