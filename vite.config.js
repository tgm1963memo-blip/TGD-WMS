import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // No web manifest -- this isn't about making the app installable,
      // only about the handheld "ระบุ Location" page (and everything else)
      // still loading if the tab gets suspended/reopened with zero
      // connectivity, e.g. inside a signal-dead cold room. Precaches only
      // the app's own static JS/CSS/HTML; API data for offline use is
      // handled separately per-feature via IndexedDB (see
      // src/utils/offlineSnapshotStore.js and offlineActionQueue.js) --
      // this service worker never touches Supabase responses.
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallback: 'index.html',
        // The app's main bundle is a few MB (unrelated pre-existing
        // code-splitting debt, see the "chunks larger than 500 kB" build
        // warning) -- Workbox's 2 MiB default would silently skip
        // precaching it, defeating the whole point of this plugin here.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
});

