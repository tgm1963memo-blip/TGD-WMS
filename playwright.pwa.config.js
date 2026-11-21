import { defineConfig, devices } from '@playwright/test';

// The service worker and manifest only exist in a production build, so this
// suite runs against `vite preview`, not the dev server the main config uses.
// Supabase is a dummy host stubbed per test: nothing here touches real data.
const PORT = 4173;

export default defineConfig({
  testDir: './tests/e2e-pwa',
  timeout: 60000,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: 'allow',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      VITE_SUPABASE_URL: 'https://pwatest.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'pwa-test-anon-key',
    },
  },
});
