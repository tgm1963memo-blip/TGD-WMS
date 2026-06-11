import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.UAT_BASE_URL) throw new Error('Missing UAT_BASE_URL in environment variables');
if (!process.env.UAT_EMAIL) throw new Error('Missing UAT_EMAIL in environment variables');
if (!process.env.UAT_PASSWORD) throw new Error('Missing UAT_PASSWORD in environment variables');

async function login(page) {
  await page.goto(`${process.env.UAT_BASE_URL}/login`);
  await page.locator('[data-testid="login-email-input"], input[type="email"]').fill(process.env.UAT_EMAIL);
  await page.locator('[data-testid="login-password-input"], input[type="password"]').fill(process.env.UAT_PASSWORD);
  await page.locator('[data-testid="login-submit-button"], button[type="submit"]').click();
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 15000 });
}

test.describe('UX-AUTH-1 Auth and User Settings', () => {
  test('Scenario 1: Login page loads', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="staging-login-panel"]')).toBeVisible();
  });

  test('Scenario 2: Forgot password link visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/login`);
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();
  });

  test('Scenario 3: Forgot password form can be opened', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/login`);
    await page.locator('[data-testid="forgot-password-link"]').click();
    await expect(page.locator('[data-testid="forgot-password-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-email-input"]')).toBeVisible();
  });

  test('Scenario 4: Invalid/empty email validation', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/forgot-password`);
    await page.locator('[data-testid="forgot-password-submit-button"]').click();
    await expect(page.locator('[data-testid="forgot-password-error"]')).toBeVisible();
  });

  test('Scenario 5: Existing login still works', async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 6: User menu opens with session identity', async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-testid="user-session-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="user-session-email"]')).toBeVisible();
  });

  test('Scenario 7: Profile/settings page opens', async ({ page }) => {
    await login(page);
    await page.goto(`${process.env.UAT_BASE_URL}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 8: Email/role visible on profile page', async ({ page }) => {
    await login(page);
    await page.goto(`${process.env.UAT_BASE_URL}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-settings-role"]')).toBeVisible();
  });

  test('Scenario 9: Logout still works', async ({ page }) => {
    await login(page);
    await page.locator('[data-testid="logout-button"]').click();
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 10: Billing RLS regression still passes for accounting', async ({ page }) => {
    await login(page);
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
