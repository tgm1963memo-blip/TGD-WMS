import { test, expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials } from './helpers/uatAuth.js';

requireUatCredentials();

test.describe('UX-AUTH-1 Auth and User Settings', () => {
  test('Scenario 1: Login page loads', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="staging-login-panel"]')).toBeVisible();
  });

  test('Scenario 2: Forgot password link visible', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/login`);
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();
  });

  test('Scenario 3: Forgot password form can be opened', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/login`);
    await page.locator('[data-testid="forgot-password-link"]').click();
    await expect(page.locator('[data-testid="forgot-password-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-email-input"]')).toBeVisible();
  });

  test('Scenario 4: Invalid/empty email validation', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/forgot-password`);
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
    await page.goto(`${getBaseUrl()}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 8: Email/role visible on profile page', async ({ page }) => {
    await login(page);
    await page.goto(`${getBaseUrl()}/settings/profile`);
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
    await page.goto(`${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
