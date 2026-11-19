import React from 'react';
import { Globe } from 'lucide-react';
import type { PlatformId } from '../../types';

interface PlatformIconProps {
  platform: PlatformId | string;
  name?: string;
  icon?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

function matchSpecificPlatform(raw: string): string | null {
  if (!raw) return null;

  if (
    raw === 'instagram' ||
    raw.includes('instagram') ||
    /\binsta\b/.test(raw) ||
    /(?:^|[\s_/-])ig(?:$|[\s_/-])/.test(raw)
  ) {
    return 'instagram';
  }
  if (
    raw === 'youtube' ||
    raw.includes('youtube') ||
    /(?:^|[\s_/-])yt(?:$|[\s_/-])/.test(raw)
  ) {
    return 'youtube';
  }
  if (
    raw === 'facebook' ||
    raw.includes('facebook') ||
    /(?:^|[\s_/-])fb(?:$|[\s_/-])/.test(raw)
  ) {
    return 'facebook';
  }
  if (raw === 'tiktok' || raw.includes('tiktok') || /tik[\s_-]*tok/.test(raw)) {
    return 'tiktok';
  }
  if (
    raw === 'telegram' ||
    raw.includes('telegram') ||
    /(?:^|[\s_/-])tg(?:$|[\s_/-])/.test(raw)
  ) {
    return 'telegram';
  }
  if (
    raw === 'x' ||
    raw.includes('twitter') ||
    /(?:^|[\s_/-])x(?:$|[\s_/(:-])/.test(raw)
  ) {
    return 'x';
  }
  if (raw === 'linkedin' || raw.includes('linkedin') || /linked[\s_-]*in/.test(raw)) {
    return 'linkedin';
  }
  if (
    raw === 'webtraffic' ||
    raw === 'web-traffic' ||
    raw === 'web_traffic' ||
    raw.includes('traffic')
  ) {
    return 'webtraffic';
  }

  return null;
}

export function resolvePlatformIconKey(platform?: string, name?: string, icon?: string): string {
  const ordered = [platform, name, icon]
    .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
    .map((v) => v.toLowerCase().trim());

  for (const candidate of ordered) {
    const matched = matchSpecificPlatform(candidate);
    if (matched) return matched;
  }

  for (const candidate of ordered) {
    if (candidate === 'more' || candidate === 'other') return 'more';
  }

  return ordered[0] ?? '';
}

export function PlatformIcon({ platform, name, icon, size = 'md' }: PlatformIconProps) {
  const boxClass =
    size === 'xs'
      ? 'h-5 w-5 rounded-md'
      : size === 'sm'
        ? 'h-7 w-7 rounded-lg'
        : size === 'lg'
          ? 'h-11 w-11 rounded-2xl'
          : 'h-9 w-9 rounded-xl';

  const iconClass =
    size === 'xs'
      ? 'h-3 w-3'
      : size === 'sm'
        ? 'h-4 w-4'
        : size === 'lg'
          ? 'h-6 w-6'
          : 'h-5 w-5';

  const resolved = resolvePlatformIconKey(String(platform || ''), name, icon);

  switch (resolved) {
    case 'instagram':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" className={iconClass}>
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
          </svg>
        </span>
      );
    case 'youtube':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#FF0000] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8L15.6 12 10 15.2Z" />
          </svg>
        </span>
      );
    case 'facebook':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#1877F2] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5Z" />
          </svg>
        </span>
      );
    case 'tiktok':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-slate-950 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3 0 .6.04.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66 6.34 6.34 0 0 0 15.68 16v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4c-.29-.03-.58-.18-.86-.43Z" />
          </svg>
        </span>
      );
    case 'telegram':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#229ED9] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M20.665 3.717 2.935 10.554c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434Z" />
          </svg>
        </span>
      );
    case 'x':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-slate-950 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
          </svg>
        </span>
      );
    case 'linkedin':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-[#0A66C2] text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3.5A1.96 1.96 0 1 0 5.25 7.42A1.96 1.96 0 1 0 5.25 3.5ZM20.44 13.02C20.44 9.88 18.76 8.22 16.16 8.22C14.37 8.22 13.48 9.2 13.02 9.93V8.5H9.65C9.7 9.48 9.65 19.5 9.65 19.5H13.02V13.36C13.02 13.02 13.05 12.69 13.15 12.45C13.42 11.78 14.03 11.09 15.07 11.09C16.41 11.09 17.06 12.11 17.06 13.6V19.5H20.44V13.02Z" />
          </svg>
        </span>
      );
    case 'webtraffic':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-gradient-to-tr from-emerald-500 to-cyan-600 text-white shadow-xs`}
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={iconClass}
          >
            <path d="M21 12.5a9 9 0 1 1-9.5-9" />
            <path d="M3.6 9.5h8.2" />
            <path d="M3.8 15h14.4" />
            <path d="M11 3.5a13.5 13.5 0 0 0 0 18" />
            <path d="M14.5 3.5H20V9" />
            <path d="M12.5 11L20 3.5" />
          </svg>
        </span>
      );
    case 'more':
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-violet-100 text-violet-700`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className={iconClass}>
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </span>
      );
    default:
      return (
        <span
          className={`${boxClass} inline-flex shrink-0 items-center justify-center bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xs`}
          aria-hidden="true"
        >
          <Globe className={iconClass} />
        </span>
      );
  }
}
