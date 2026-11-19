export interface BannerSliderItem {
  imageUrl: string;
  videoUrl: string;
}

const YOUTUBE_ROOT_DOMAINS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] as const;
const FACEBOOK_ROOT_DOMAINS = ['facebook.com', 'fb.watch', 'fb.com'] as const;

function matchesRootDomain(hostname: string, domains: readonly string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.+$/, '');
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return /^https?:\/\//i.test(trimmed);
  }
}

export function normalizeVideoUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

export function getVideoPlatform(raw: string): 'youtube' | 'facebook' | null {
  const normalized = normalizeVideoUrl(raw);
  if (!normalized) return null;
  try {
    const { hostname } = new URL(normalized);
    if (matchesRootDomain(hostname, YOUTUBE_ROOT_DOMAINS)) return 'youtube';
    if (matchesRootDomain(hostname, FACEBOOK_ROOT_DOMAINS)) return 'facebook';
    return null;
  } catch {
    return null;
  }
}

export function isSupportedSliderVideoUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  return getVideoPlatform(trimmed) !== null;
}

export function normalizeBannerSliders(defaultSettings: unknown): BannerSliderItem[] {
  if (!defaultSettings || typeof defaultSettings !== 'object') {
    return [];
  }

  const record = defaultSettings as {
    bannerItems?: unknown;
    bannerImages?: unknown;
  };

  const legacyUrls: string[] = Array.isArray(record.bannerImages)
    ? record.bannerImages
        .filter((item): item is string => typeof item === 'string')
        .map((url) => url.trim())
        .filter((url) => isValidHttpUrl(url))
    : [];

  if (Array.isArray(record.bannerItems) && record.bannerItems.length > 0) {
    const parsedItems: BannerSliderItem[] = [];
    for (const entry of record.bannerItems) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as { imageUrl?: unknown; videoUrl?: unknown };
      const imageUrl = typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
      if (!isValidHttpUrl(imageUrl)) continue;
      const rawVideo = typeof item.videoUrl === 'string' ? item.videoUrl.trim() : '';
      const validVideo =
        rawVideo && isSupportedSliderVideoUrl(rawVideo) ? normalizeVideoUrl(rawVideo) : '';
      parsedItems.push({
        imageUrl,
        videoUrl: validVideo,
      });
    }

    if (parsedItems.length > 0) {
      // Preserve any legacy bannerImages appended externally if bannerItems fell behind
      if (legacyUrls.length === 0 || parsedItems.length >= legacyUrls.length) {
        return parsedItems;
      }
      const videoByImage = new Map<string, string>();
      for (const item of parsedItems) {
        if (item.videoUrl && !videoByImage.has(item.imageUrl)) {
          videoByImage.set(item.imageUrl, item.videoUrl);
        }
      }
      return legacyUrls.map((imageUrl, idx) => ({
        imageUrl,
        videoUrl:
          parsedItems[idx]?.imageUrl === imageUrl
            ? parsedItems[idx].videoUrl
            : videoByImage.get(imageUrl) ?? '',
      }));
    }
  }

  return legacyUrls.map((imageUrl) => ({
    imageUrl,
    videoUrl: '',
  }));
}
