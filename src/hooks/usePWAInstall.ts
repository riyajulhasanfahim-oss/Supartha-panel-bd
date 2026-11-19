import { useCallback, useEffect, useState } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let capturedDeferredPrompt: BeforeInstallPromptEvent | null = null;
const promptSubscribers = new Set<(event: BeforeInstallPromptEvent | null) => void>();

function notifyPromptSubscribers(event: BeforeInstallPromptEvent | null) {
  capturedDeferredPrompt = event;
  promptSubscribers.forEach((cb) => cb(event));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    notifyPromptSubscribers(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    notifyPromptSubscribers(null);
  });
}

function checkIsStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function checkIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isTouchMac =
    window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(ua) || isTouchMac;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => capturedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => checkIsStandalone());
  const [isIOS] = useState<boolean>(() => checkIsIOS());

  useEffect(() => {
    const syncPrompt = (event: BeforeInstallPromptEvent | null) => {
      setDeferredPrompt(event);
    };
    promptSubscribers.add(syncPrompt);
    setDeferredPrompt(capturedDeferredPrompt);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = () => {
      setIsInstalled(checkIsStandalone());
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      notifyPromptSubscribers(null);
    };

    mediaQuery.addEventListener?.('change', handleDisplayModeChange);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      promptSubscribers.delete(syncPrompt);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = useCallback(async (): Promise<{
    triggered: boolean;
    outcome?: 'accepted' | 'dismissed';
  }> => {
    const activePrompt = deferredPrompt || capturedDeferredPrompt;
    if (!activePrompt) {
      return { triggered: false };
    }

    await activePrompt.prompt();
    const { outcome } = await activePrompt.userChoice;
    if (outcome === 'accepted') {
      notifyPromptSubscribers(null);
    }
    return { triggered: true, outcome };
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    install,
  };
}
