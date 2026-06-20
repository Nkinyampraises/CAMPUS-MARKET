import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // ── Progressive Web App ────────────────────────────────────────────────
    // Additive only: generates manifest + service worker into dist. The SW is
    // built for production only and is registered manually (see src/pwa.ts) so
    // it never runs inside the Capacitor native app. It must NEVER touch the
    // same-origin API (/make-server-50b25a4f/* and /api/*).
    VitePWA({
      registerType: 'autoUpdate',
      // We register the SW ourselves (guarded for prod + non-Capacitor).
      injectRegister: false,
      // Inject the apple-touch-icon / favicon <link> tags from pwa-assets.config.ts.
      pwaAssets: { config: true },
      // SW must not run in `vite dev` — production builds only (security req).
      devOptions: { enabled: false },
      includeAssets: ['favicon.ico', 'favicon.png', 'apple-touch-icon-180x180.png', 'offline.html'],
      manifest: {
        name: 'UNITRADE — Campus Marketplace',
        short_name: 'UNITRADE',
        description:
          'Buy, sell, and rent safely on your Cameroon campus marketplace. Verified students, escrow-protected payments.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#005A30',
        background_color: '#FFFFFF',
        lang: 'en',
        dir: 'ltr',
        categories: ['shopping', 'business', 'lifestyle'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Marketplace', short_name: 'Market', url: '/marketplace', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Sell an item', short_name: 'Sell', url: '/add-listing', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Messages', short_name: 'Messages', url: '/messages', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
          { name: 'Dashboard', short_name: 'Dashboard', url: '/dashboard', icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        // Precache the app shell only. Exclude the heavy ONNX/wasm AI assets so
        // installs stay small and Lighthouse stays green — they load on demand.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        globIgnores: ['**/ort*.*', '**/*.wasm', '**/ort-wasm*'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Offline SPA shell — but API routes must always hit the network.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/make-server-50b25a4f/, /^\/api\//],
        runtimeCaching: [
          {
            // App API: never cached, never intercepted beyond a passthrough.
            urlPattern: ({ url }: { url: URL }) =>
              url.pathname.startsWith('/make-server-50b25a4f') || url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            // Same-origin images/static media.
            urlPattern: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
              sameOrigin && request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'image-cache',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Google Fonts stylesheets + files.
            urlPattern: ({ url }: { url: URL }) =>
              url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/make-server-50b25a4f': {
        target: 'http://localhost:8002',
        changeOrigin: true,
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
