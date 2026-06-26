import { test, expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';

requireUatCredentials();

test.describe('UX-AUTH-1 Auth and User Settings', () => {
  test('Scenario 1: Login page loads', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/login`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="staging-login-panel"]')).toBeVisible();
  });

  test('Scenario 2: Forgot password link visible', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/login`);
    await expect(page.locator('[data-testid="forgot-password-link"]')).toBeVisible();
  });

  test('Scenario 3: Forgot password form can be opened', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/login`);
    await page.locator('[data-testid="forgot-password-link"]').click();
    await expect(page.locator('[data-testid="forgot-password-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="forgot-password-email-input"]')).toBeVisible();
  });

  test('Scenario 4: Invalid/empty email validation', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/forgot-password`);
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
    await gotoUrl(page, `${getBaseUrl()}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 8: Email/role visible on profile page', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/profile`);
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
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });

  test('Scenario 11: Change password page loads for admin', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/change-password`);
    await expect(page.locator('[data-testid="change-password-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="change-password-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-password-new-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="change-password-confirm-input"]')).toBeVisible();
  });

  test('Scenario 12: Change password validates short password', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/change-password`);
    await page.locator('[data-testid="change-password-new-input"]').fill('abc');
    await page.locator('[data-testid="change-password-confirm-input"]').fill('abc');
    await page.locator('[data-testid="change-password-submit-button"]').click();
    await expect(page.locator('[data-testid="change-password-error"]')).toBeVisible();
  });

  test('Scenario 13: Change password validates mismatch', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/change-password`);
    await page.locator('[data-testid="change-password-new-input"]').fill('password123');
    await page.locator('[data-testid="change-password-confirm-input"]').fill('password456');
    await page.locator('[data-testid="change-password-submit-button"]').click();
    await expect(page.locator('[data-testid="change-password-error"]')).toBeVisible();
  });

  test('Scenario 14: Email settings page loads for admin', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/email`);
    await expect(page.locator('[data-testid="email-settings-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="email-settings-test-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="email-settings-smtp-guide-card"]')).toBeVisible();
  });

  test('Scenario 15: Email settings test form validates invalid email', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/email`);
    await page.locator('[data-testid="email-settings-test-email-input"]').fill('not-an-email');
    await page.locator('[data-testid="email-settings-test-send-button"]').click();
    await expect(page.locator('[data-testid="email-settings-test-result"]')).toBeVisible();
  });

  test('Scenario 16: Email template section can be toggled', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/email`);
    await expect(page.locator('[data-testid="email-settings-template-card"]')).toBeVisible({ timeout: 15000 });
    await page.locator('[data-testid="email-settings-template-card"] button').first().click();
    await expect(page.locator('[data-testid="email-settings-template-preview"]')).toBeVisible();
  });

  test('Scenario 17: Reset password page shows loading then invalid without token', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reset-password`);
    await expect(page.locator('[data-testid="reset-password-page"]')).toBeVisible();
    // Without an email token the page should eventually show the invalid-session banner
    await expect(page.locator('[data-testid="reset-password-invalid-session"]')).toBeVisible({ timeout: 8000 });
  });

  test('Scenario 18: Profile page change-password link points to in-app form', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/settings/profile`);
    await expect(page.locator('[data-testid="profile-change-password-link"]')).toBeVisible({ timeout: 15000 });
    const href = await page.locator('[data-testid="profile-change-password-link"]').getAttribute('href');
    expect(href).toContain('/settings/change-password');
  });
});
