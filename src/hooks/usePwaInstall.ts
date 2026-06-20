import { useEffect, useState } from 'react';

// Shared PWA-install state. The browser fires `beforeinstallprompt` exactly once
// and the captured event can only be used by whoever calls prompt() first, so we
// keep it in a single module-level store that both the navbar button and the
// install banner consume. Listeners are attached at import time (before render)
// so the event is never missed.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isBrowser = typeof window !== 'undefined';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach((fn) => fn());

const isCapacitor = (): boolean => {
  const cap = (globalThis as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  const protocol = isBrowser ? location.protocol : '';
  return protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:';
};

export const isIosDevice = (): boolean => {
  if (!isBrowser) return false;
  const ua = navigator.userAgent || '';
  const iOS = /iphone|ipad|ipod/i.test(ua);
  const iPadOS = navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1;
  return iOS || iPadOS;
};

const detectInstalled = (): boolean => {
  if (!isBrowser) return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

if (isBrowser && !isCapacitor()) {
  installed = detectInstalled();
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    deferredPrompt = null;
    try { localStorage.setItem('pwa-install-dismissed', 'installed'); } catch { /* ignore */ }
    notify();
  });
}

export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  if (choice.outcome === 'accepted') {
    installed = true;
  }
  deferredPrompt = null;
  notify();
  return choice.outcome;
}

export interface PwaInstallState {
  /** Browser offered a native install prompt (Android / Chromium desktop). */
  canInstall: boolean;
  /** App is already running as an installed PWA. */
  isInstalled: boolean;
  /** iOS Safari — needs manual "Add to Home Screen" instructions. */
  isIos: boolean;
  /** Running inside the Capacitor native shell (no install UI needed). */
  isCapacitorApp: boolean;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): PwaInstallState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const onChange = () => forceRender((n) => n + 1);
    subscribers.add(onChange);
    return () => { subscribers.delete(onChange); };
  }, []);

  const capacitorApp = isCapacitor();
  return {
    canInstall: Boolean(deferredPrompt) && !installed && !capacitorApp,
    isInstalled: installed,
    isIos: isIosDevice() && !installed && !capacitorApp,
    isCapacitorApp: capacitorApp,
    promptInstall,
  };
}
