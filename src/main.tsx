import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './hooks/usePWAInstall';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    try {
      const key = 'rj_sw_reloaded_ts';
      const last = Number(window.sessionStorage.getItem(key) || 0);
      if (Date.now() - last > 10000) {
        window.sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  });
  registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      registration?.update().catch(() => undefined);
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
