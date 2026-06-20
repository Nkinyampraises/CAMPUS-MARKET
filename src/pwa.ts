// Service-worker registration — guarded so it ONLY runs in a real production
// browser over http(s). It is intentionally skipped in dev and inside the
// Capacitor native Android app (where a SW would interfere with the webview).
//
// `virtual:pwa-register` is provided by vite-plugin-pwa at build time. In dev
// (devOptions.enabled = false) the module is a harmless no-op stub.

const isCapacitor = (): boolean => {
  const cap = (globalThis as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
    return true;
  }
  // Capacitor serves over capacitor:// (Android) or ionic:// schemes.
  const protocol = typeof location !== 'undefined' ? location.protocol : '';
  return protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:';
};

export function registerPWA() {
  if (!import.meta.env.PROD) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (isCapacitor()) return;

  // Dynamic import keeps the virtual module out of the dev graph.
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        // autoUpdate strategy — silently activate the new SW; it applies on the
        // next navigation. No user prompt (per chosen update behavior).
        onRegisteredSW(_swUrl, registration) {
          // Check for updates roughly hourly while the app stays open.
          if (registration) {
            setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
          }
        },
        onRegisterError(error) {
          console.error('Service worker registration failed:', error);
        },
      });
    })
    .catch((error) => {
      console.error('PWA register import failed:', error);
    });
}

registerPWA();
