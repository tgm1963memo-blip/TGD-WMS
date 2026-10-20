import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import { loginAsBillingUser, skipUnlessBillingReader } from './helpers/billingAccess.js';

requireUatCredentials();

test.describe('Gate 3B-2 Billing Invoice Draft UI', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await skipUnlessBillingReader(testInfo, page);
  });

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Billing menu shows Invoice Drafts', async ({ page }) => {
    await expect(page.locator('[data-testid="billing-invoice-drafts-menu-item"]')).toBeVisible({ timeout: 20000 });
  });

  test('Scenario 3: Invoice Draft List page loads', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-filter-form"]')).toBeVisible();
  });

  test('Scenario 7: Draft detail page loads', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    const viewLink = page.locator('[data-testid="billing-invoice-drafts-table"] a').first();
    if (await viewLink.count()) {
      await viewLink.click();
      await expect(page.locator('[data-testid="billing-invoice-draft-detail-page"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="invoice-draft-lines-table"]')).toBeVisible();
    } else {
      await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible();
    }
  });

  test('Scenario 8: Cancel Draft works if status cancellable', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    const viewLink = page.locator('[data-testid="billing-invoice-drafts-table"] a').first();
    test.skip(!(await viewLink.count()), 'No invoice drafts available to cancel');

    await viewLink.click();
    const cancelButton = page.locator('[data-testid="invoice-draft-cancel-button"]');
    if (await cancelButton.count()) {
      page.once('dialog', (dialog) => dialog.accept('E2E_TEST cancel'));
      page.once('dialog', (dialog) => dialog.accept());
      await cancelButton.click();
      await expect(page.locator('[data-testid="invoice-draft-status-badge"]')).toContainText('CANCELLED', { timeout: 15000 });
    }
  });

  test('Scenario 9: Logout still works', async ({ page }) => {
    await page.locator('[data-testid="logout-button"]').click();
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 10: Gate 3B forbidden controls are absent on draft detail', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    const viewLink = page.locator('[data-testid="billing-invoice-drafts-table"] a').first();
    if (await viewLink.count()) {
      await viewLink.click();
    }
    await expect(page.locator('[data-testid="approve-invoice-draft-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bplus-invoice-no-input"]')).toHaveCount(0);
  });
});
