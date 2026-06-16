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
  await expect(appShell).toBeVisible({ timeout: 20000 });
}

export async function switchUser(page, credentials = {}) {
  await logout(page);
  await login(page, credentials);
}

export async function loginAsCustomerAdmin(page) {
  if (!process.env.UAT_CUSTOMER_EMAIL || !process.env.UAT_CUSTOMER_PASSWORD) {
    return false;
  }
  await switchUser(page, {
    email: process.env.UAT_CUSTOMER_EMAIL,
    password: process.env.UAT_CUSTOMER_PASSWORD,
  });
  return true;
}
