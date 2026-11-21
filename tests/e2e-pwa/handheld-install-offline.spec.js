import { expect, test } from '@playwright/test';

const AUTH_KEY = 'sb-pwatest-auth-token';
const USER_ID = '00000000-0000-4000-8000-000000000001';

function fakeSession(expiresInSeconds) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'header.eyJzdWIiOiJ0ZXN0In0.signature',
    refresh_token: 'pwa-test-refresh',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: now + expiresInSeconds,
    user: { id: USER_ID, email: 'staff@example.com', aud: 'authenticated', app_metadata: {}, user_metadata: {} },
  };
}

async function stubSupabase(page, role = 'warehouse_staff') {
  await page.route('https://pwatest.supabase.co/**', (route) => {
    const url = route.request().url();
    if (url.includes('/tgd_user_profiles')) {
      return route.fulfill({ json: { auth_user_id: USER_ID, role, is_active: true, status: 'active', customer_id: null } });
    }
    return route.fulfill({ json: [] });
  });
}

// A route handler answers even under context.setOffline, so requests have to
// be failed explicitly or a token refresh would "succeed" against the stub.
async function cutOffSupabase(page) {
  await page.unrouteAll();
  await page.route('https://pwatest.supabase.co/**', (route) => route.abort('internetdisconnected'));
}

async function expireSession(page) {
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: AUTH_KEY, session: fakeSession(-600) });
}

async function signIn(page) {
  await page.addInitScript(({ key, session, firstRun }) => {
    if (sessionStorage.getItem(firstRun)) return;
    sessionStorage.setItem(firstRun, '1');
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.setItem('tgd_handheld_profile', JSON.stringify({ id: 'staff-a', displayName: 'พนักงาน A', email: 'staff@example.com' }));
  }, { key: AUTH_KEY, session: fakeSession(3600), firstRun: 'pwa-test-seeded' });
}

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    }
    return registration.scope;
  });
}

test('the build is installable: manifest, icons and head tags resolve to real files', async ({ page, request }) => {
  await page.goto('/login');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifestResponse = await request.get(`/${manifestHref.replace(/^\//, '')}`);
  expect(manifestResponse.headers()['content-type']).not.toContain('text/html');
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({ display: 'standalone', start_url: '/', short_name: 'TGC WMS' });

  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  for (const src of [...manifest.icons.map((icon) => icon.src), appleIcon]) {
    const icon = await request.get(src);
    expect(icon.status(), src).toBe(200);
    expect(icon.headers()['content-type'], src).toContain('image/png');
  }
  expect(manifest.icons.some((icon) => icon.purpose === 'maskable')).toBe(true);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#09111c');
});

test('reopens offline with an expired token and lands on the handheld menu', async ({ page, context }) => {
  await stubSupabase(page);
  await signIn(page);

  await page.goto('/handheld');
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();
  await waitForServiceWorker(page);

  // The state a phone is in an hour later, in a cold room.
  await expireSession(page);
  await cutOffSupabase(page);
  await context.setOffline(true);
  const startedAt = Date.now();
  await page.goto('/');

  await expect(page).toHaveURL(/\/handheld/);
  await expect(page.getByTestId('handheld-offline-banner')).toBeVisible();
  expect(Date.now() - startedAt).toBeLessThan(5000);
  await expect(page.getByText('ระบุตำแหน่งสินค้าที่รับเข้าแล้ว')).toHaveCount(0);
  await expect(page.getByText('ใช้ได้แบบออฟไลน์')).toBeVisible();
  await expect(page.getByRole('button', { name: /รับเข้า \(Receiving\)/ })).toBeDisabled();
  await expect(page.getByRole('button', { name: /เบิกออก \(Picking\)/ })).toBeDisabled();

  await page.getByTestId('handheld-mode-count').click();
  await expect(page).toHaveURL(/mode=count/);
});

test('Wi-Fi with no internet reaches the handheld within a few seconds', async ({ page }) => {
  await stubSupabase(page);
  await signIn(page);
  await page.goto('/handheld');
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();
  await waitForServiceWorker(page);

  await expireSession(page);
  await cutOffSupabase(page);
  const startedAt = Date.now();
  await page.goto('/');

  await expect(page.getByTestId('handheld-mode-count')).toBeVisible({ timeout: 20000 });
  expect(Date.now() - startedAt).toBeLessThan(15000);
  await expect(page).toHaveURL(/\/handheld/);
});

test('a session the server rejects goes to login and is not kept alive by the fallback', async ({ page }) => {
  await stubSupabase(page);
  await signIn(page);
  await page.goto('/handheld');
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();

  await expireSession(page);
  await page.unrouteAll();
  await page.route('https://pwatest.supabase.co/auth/**', (route) => route.fulfill({
    status: 400,
    json: { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' },
  }));
  await page.goto('/handheld');

  await expect(page).toHaveURL(/\/login/);
  expect(await page.evaluate((key) => localStorage.getItem(key), AUTH_KEY)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('tgd_offline_role_v1'))).toBeNull();
});

test('reloading into Receiving while offline lands on the menu', async ({ page, context }) => {
  await stubSupabase(page);
  await signIn(page);
  await page.goto('/handheld');
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();
  await waitForServiceWorker(page);

  await cutOffSupabase(page);
  await context.setOffline(true);
  await page.goto('/handheld?mode=receive');

  await expect(page.getByTestId('handheld-offline-banner')).toBeVisible();
  await expect(page.getByRole('button', { name: /รับเข้า \(Receiving\)/ })).toBeDisabled();
});

test('a signed-out device stays at login when offline', async ({ page, context }) => {
  await stubSupabase(page);
  await page.goto('/login');
  await waitForServiceWorker(page);

  await context.setOffline(true);
  await page.goto('/handheld');

  await expect(page).toHaveURL(/\/login/);
});

test('the phone back button returns to the menu and a refresh keeps the mode', async ({ page }) => {
  await stubSupabase(page);
  await signIn(page);
  await page.goto('/handheld');

  await page.getByTestId('handheld-mode-count').click();
  await expect(page).toHaveURL(/mode=count/);

  await page.reload();
  await expect(page).toHaveURL(/mode=count/);
  await expect(page.getByTestId('handheld-mode-count')).toHaveCount(0);

  await page.getByRole('button', { name: 'ย้อนกลับ' }).first().click();
  await expect(page).toHaveURL(/\/handheld$/);
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();

  await page.getByTestId('handheld-mode-count').click();
  await expect(page).toHaveURL(/mode=count/);
  await page.goBack();
  await expect(page).toHaveURL(/\/handheld$/);
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();
});

test('the handheld menu has no sideways scroll at 375px and inputs will not trigger iOS zoom', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await stubSupabase(page);
  await signIn(page);
  await page.goto('/handheld');
  await expect(page.getByTestId('handheld-mode-count')).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const fontSize = await page.evaluate(() => {
    const input = document.createElement('input');
    document.querySelector('.handheld-root').appendChild(input);
    return getComputedStyle(input).fontSize;
  });
  expect(fontSize).toBe('16px');
});
