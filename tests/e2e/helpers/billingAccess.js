import { expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials } from './uatAuth.js';

requireUatCredentials();

const BILLING_READ_ROLES = new Set(['accounting', 'admin', 'warehouse_manager']);
const BILLING_WRITE_ROLES = new Set(['accounting', 'admin']);

export function isBillingWriteRole(role) {
  return BILLING_WRITE_ROLES.has(String(role ?? '').trim().toLowerCase());
}

export function getBillingCredentials() {
  return {
    email: process.env.UAT_BILLING_EMAIL || process.env.UAT_EMAIL,
    password: process.env.UAT_BILLING_PASSWORD || process.env.UAT_PASSWORD,
  };
}

export async function loginAsBillingUser(page) {
  const credentials = getBillingCredentials();
  await login(page, credentials);
}

export async function waitForAuthenticatedSidebar(page) {
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(1500);
}

export async function readProfileRole(page) {
  await page.goto(`${getBaseUrl()}/settings/profile`);
  await expect(page.locator('[data-testid="profile-settings-role"]')).toBeVisible({ timeout: 20000 });
  const roleText = await page.locator('[data-testid="profile-settings-role"]').innerText();
  return roleText.trim().toLowerCase();
}

export function isBillingReadRole(role) {
  return BILLING_READ_ROLES.has(String(role ?? '').trim().toLowerCase());
}

export async function skipUnlessBillingReader(testInfo, page) {
  await loginAsBillingUser(page);
  await waitForAuthenticatedSidebar(page);
  const role = await readProfileRole(page);
  if (!isBillingReadRole(role)) {
    testInfo.skip(true, `Billing E2E requires accounting/admin/warehouse_manager (current role: ${role || 'unknown'})`);
  }
}
