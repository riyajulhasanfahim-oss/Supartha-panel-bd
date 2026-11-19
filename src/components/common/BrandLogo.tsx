import React, { useState } from 'react';
import {
  APP_CONFIG,
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../../config/app.config';
import { useApp } from '../../context/AppContext';

interface BrandLogoProps {
  showTagline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function BrandLogo({ showTagline = false, size = 'md', onClick }: BrandLogoProps) {
  const { systemSettings } = useApp();
  const [imgFailed, setImgFailed] = useState(false);

  const brandName = resolveBrandName(systemSettings?.websiteName);
  const brandTagline = systemSettings?.brandTagline?.trim() || APP_CONFIG.brandTagline;
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);
  const showCustomImage = Boolean(
    logoUrl && (/^https?:\/\//i.test(logoUrl) || logoUrl.startsWith('/')) && !imgFailed
  );
  const primaryColor = systemSettings?.themeColor?.trim() || '#6D28D9';
  const secondaryColor = systemSettings?.secondaryColor?.trim() || '#4F46E5';

  const iconSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-11 w-11' : 'h-9 w-9';
  const titleSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-xl' : 'text-lg';

  const content = (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0">
      <span
        style={
          showCustomImage
            ? undefined
            : { backgroundImage: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }
        }
        className={`${iconSize} relative inline-flex items-center justify-center overflow-hidden ${
          showCustomImage
            ? 'rounded-full bg-slate-950 ring-1 ring-sky-400/50 shadow-sm shadow-sky-500/20'
            : 'rounded-xl text-white shadow-sm shadow-violet-600/25'
        }`}
      >
        {showCustomImage ? (
          <img
            src={logoUrl}
            alt={brandName}
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <svg viewBox="0 0 36 36" fill="none" className="h-6 w-6" aria-hidden="true">
            <path
              d="M7.5 8.5H15.2C20.9 8.5 24.4 11.9 24.4 18C24.4 24.1 20.9 27.5 15.2 27.5H7.5V8.5ZM12.3 12.9V23.1H15C18.1 23.1 19.6 21.3 19.6 18C19.6 14.7 18.1 12.9 15 12.9H12.3Z"
              fill="currentColor"
            />
            <path
              d="M17.5 18.2H20.4L22.2 14.2L24.5 22.1L26.7 16.3L28.3 18.2H30.5"
              stroke="#FACC15"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M27.2 7.5L28.1 10.1L30.7 11L28.1 11.9L27.2 14.5L26.3 11.9L23.7 11L26.3 10.1L27.2 7.5Z"
              fill="#FDE047"
            />
          </svg>
        )}
      </span>
      <span className="flex flex-col text-left leading-none">
        <span className={`${titleSize} font-display font-extrabold tracking-tight text-violet-950`}>
          {brandName}
        </span>
        {showTagline && (
          <span className="mt-0.5 text-[11px] font-medium text-slate-500">
            {brandTagline}
          </span>
        )}
      </span>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2"
      >
        {content}
      </button>
    );
  }

  return content;
}
