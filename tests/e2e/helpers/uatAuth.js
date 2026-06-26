import { expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export function getBaseUrl() {
  const raw = process.env.PLAYWRIGHT_BASE_URL || process.env.UAT_BASE_URL || 'http://localhost:5173';
  return raw.replace(/\/$/, '');
}

export function requireUatCredentials() {
  if (!process.env.UAT_EMAIL) throw new Error('Missing UAT_EMAIL in environment variables');
  if (!process.env.UAT_PASSWORD) throw new Error('Missing UAT_PASSWORD in environment variables');
}

async function waitForLoginForm(page) {
  await expect(page.locator('[data-testid="login-email-input"], input[type="email"]')).toBeVisible({
    timeout: 20000,
  });
}

export async function logout(page) {
  const baseUrl = getBaseUrl();
  const logoutButton = page.locator('[data-testid="logout-button"]');

  if (await logoutButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/login(?:\?.*)?$/, { timeout: 20000 });
    await waitForLoginForm(page);
    return;
  }

  await page.goto(`${baseUrl}/login`);
  await waitForLoginForm(page);
}

export async function login(page, credentials = {}) {
  requireUatCredentials();
  const baseUrl = getBaseUrl();
  const email = credentials.email ?? process.env.UAT_EMAIL;
  const password = credentials.password ?? process.env.UAT_PASSWORD;

  const appShell = page.locator('[data-testid="app-shell"]');
  const sessionEmail = page.locator('[data-testid="user-session-email"]');

  if (await appShell.isVisible({ timeout: 2000 }).catch(() => false)) {
    const currentEmail = (await sessionEmail.textContent().catch(() => ''))?.trim();
    if (currentEmail === email) {
      return;
    }
    await logout(page);
  } else {
    await page.goto(`${baseUrl}/login`);
    await waitForLoginForm(page);
  }

  await page.locator('[data-testid="login-email-input"], input[type="email"]').fill(email);
  await page.locator('[data-testid="login-password-input"], input[type="password"]').fill(password);
  await page.locator('[data-testid="login-submit-button"], button[type="submit"]').click();

  const handheldPage = page.locator('[data-testid="handheld-page"]');
  await expect(appShell.or(handheldPage).first()).toBeVisible({ timeout: 20000 });
  
  // Explicitly wait for the critical permission queries to finish before allowing navigation
  // This prevents Playwright's page.goto from aborting these requests and corrupting the HTTP/2 stream
  await page.waitForResponse(res => res.url().includes('tgd_user_profiles'), { timeout: 5000 }).catch(() => {});
  await page.waitForResponse(res => res.url().includes('tgd_role_definitions'), { timeout: 5000 }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
}

export async function gotoUrl(page, url) {
  // Wait for any pending requests from previous tests to finish before hard-navigating.
  // This prevents Playwright's page.goto from aborting in-flight Supabase requests 
  // and corrupting the Chromium HTTP/2 multiplexed connection pool.
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.goto(url);
}

export async function switchUser(page, credentials = {}) {
  await login(page, credentials);
}

export async function loginAsWarehouseOperator(page) {
  const email = process.env.UAT_WAREHOUSE_EMAIL
    || process.env.UAT_OPERATOR_EMAIL
    || process.env.UAT_EMAIL
    || 'staff.demo@tgd-wms.local';
  const password = process.env.UAT_WAREHOUSE_PASSWORD
    || process.env.UAT_OPERATOR_PASSWORD
    || process.env.UAT_PASSWORD;

  if (!password) {
    return false;
  }

  await switchUser(page, { email, password });
  return true;
}

export async function loginAsCustomerAdmin(page) {
  const email = process.env.UAT_CUSTOMER_EMAIL || 'customer.test@tgd-wms.local';
  const password = process.env.UAT_CUSTOMER_PASSWORD
    || process.env.UAT_PASSWORD
    || process.env.UAT_DEMO_PASSWORD;

  if (!password) {
    return false;
  }

  await switchUser(page, { email, password });
  return true;
}
