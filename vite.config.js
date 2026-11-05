import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Installable on phones, and the handheld "ระบุ Location" page (and
      // everything else) still loads when reopened with zero connectivity,
      // e.g. inside a signal-dead cold room. Precaches only the app's own
      // static files; API data for offline use is handled separately
      // per-feature via IndexedDB (see src/utils/offlineSnapshotStore.js and
      // offlineActionQueue.js) -- this service worker never touches Supabase
      // responses. start_url is '/' because DefaultHomeRedirect already sends
      // each role to its own home.
      manifest: {
        id: '/',
        name: 'TGC WMS',
        short_name: 'TGC WMS',
        description: 'ระบบจัดการคลังห้องเย็น TGC',
        lang: 'th',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#09111c',
        theme_color: '#09111c',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        // The app's main bundle is a few MB (unrelated pre-existing
        // code-splitting debt, see the "chunks larger than 500 kB" build
        // warning) -- Workbox's 2 MiB default would silently skip
        // precaching it, defeating the whole point of this plugin here.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        // Without these the Thai screen font falls back to a system font
        // whenever the app opens offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**', 'tests/e2e-pwa/**'],
  },
});

