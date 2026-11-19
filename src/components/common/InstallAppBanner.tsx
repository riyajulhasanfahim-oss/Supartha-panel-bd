import React, { useState } from 'react';
import { Download, MoreVertical, PlusSquare, Share, X } from 'lucide-react';
import {
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';

const DISMISS_STORAGE_KEY = 'rj_install_banner_dismissed';

function getInitialDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(DISMISS_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function InstallAppBanner() {
  const { viewMode, systemSettings } = useApp();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState<boolean>(getInitialDismissed);
  const [installing, setInstalling] = useState(false);
  const [guideMode, setGuideMode] = useState<'ios' | 'browser' | null>(null);

  if (isInstalled || dismissed || viewMode === 'admin') {
    return null;
  }

  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);
  const primaryColor = systemSettings?.themeColor?.trim() || '#6D28D9';

  const handleDismiss = () => {
    setDismissed(true);
    setGuideMode(null);
    try {
      window.sessionStorage.setItem(DISMISS_STORAGE_KEY, '1');
    } catch {
      // Ignore storage failures in restricted contexts
    }
  };

  const handleInstallClick = async () => {
    if (installing) return;

    if (isInstallable) {
      setInstalling(true);
      try {
        const result = await install();
        if (result.outcome === 'accepted') {
          setDismissed(true);
        }
      } finally {
        setInstalling(false);
      }
      return;
    }

    if (isIOS) {
      setGuideMode('ios');
      return;
    }

    setGuideMode('browser');
  };

  const positionClass =
    viewMode === 'dashboard'
      ? 'bottom-16 lg:bottom-5'
      : 'bottom-4';

  return (
    <>
      <div
        role="region"
        aria-label="Install App"
        className={`fixed left-1/2 -translate-x-1/2 ${positionClass} z-40 w-[calc(100%-1.5rem)] max-w-md`}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-white/95 px-3.5 py-2.5 shadow-xl shadow-slate-900/12 backdrop-blur-md">
          <img
            src={logoUrl}
            alt={brandName}
            className="h-11 w-11 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/50 shadow-xs"
          />

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900 leading-tight">
              Install App
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Install {brandName} for quick access
            </p>
          </div>

          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            style={{ backgroundColor: primaryColor }}
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-sm transition hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {installing ? 'Installing...' : 'Install'}
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Close install prompt"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {guideMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 backdrop-blur-xs sm:items-center"
          onClick={() => setGuideMode(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="h-10 w-10 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/50 shadow-xs"
                />
                <div>
                  <h2
                    id="pwa-install-guide-title"
                    className="text-base font-bold text-slate-900"
                  >
                    Install {brandName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {guideMode === 'ios'
                      ? 'Add to your iPhone or iPad Home Screen'
                      : 'Install directly from your browser'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuideMode(null)}
                aria-label="Close instructions"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {guideMode === 'ios' ? (
              <ol className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <Share className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <span>
                    1. Tap the <strong>Share</strong> button in Safari.
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <PlusSquare className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <span>
                    2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  </span>
                </li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-slate-700">
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <MoreVertical className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <span>
                    1. Open your browser menu (<strong>⋮</strong> or address bar install icon).
                  </span>
                </li>
                <li className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                  <Download className="h-4 w-4 shrink-0 text-violet-700" aria-hidden="true" />
                  <span>
                    2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                  </span>
                </li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideMode(null)}
              style={{ backgroundColor: primaryColor }}
              className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl text-sm font-bold text-white hover:opacity-95"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
