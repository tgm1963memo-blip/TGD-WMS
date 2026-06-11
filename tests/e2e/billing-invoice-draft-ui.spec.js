import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

if (!process.env.UAT_BASE_URL) throw new Error('Missing UAT_BASE_URL in environment variables');
if (!process.env.UAT_EMAIL) throw new Error('Missing UAT_EMAIL in environment variables');
if (!process.env.UAT_PASSWORD) throw new Error('Missing UAT_PASSWORD in environment variables');

async function login(page) {
  await page.goto(process.env.UAT_BASE_URL);
  await page.locator('input[name="email"], input[type="email"]').fill(process.env.UAT_EMAIL);
  await page.locator('input[name="password"], input[type="password"]').fill(process.env.UAT_PASSWORD);
  await page.locator('button[type="submit"], button:has-text("Login"), button:has-text("เข้าสู่ระบบ")').click();
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Gate 3B-2 Billing Invoice Draft UI', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Billing menu shows Invoice Drafts', async ({ page }) => {
    await expect(page.locator('[data-testid="billing-menu-item"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-invoice-drafts-menu-item"]')).toBeVisible();
  });

  test('Scenario 3: Invoice Draft List page loads', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-filter-form"]')).toBeVisible();
  });

  test('Scenario 4: Billing Movement Weight page allows selecting billable rows', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="billing-movement-weight-report-page"]')).toBeVisible();

    const table = page.locator('[data-testid="billing-movement-weight-table"]');
    const emptyState = page.locator('[data-testid="billing-movement-weight-empty-state"]');
    await Promise.race([
      table.waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    if (await table.isVisible()) {
      const enabledCheckbox = page.locator('[data-testid="billing-movement-row-checkbox"]:enabled').first();
      if (await enabledCheckbox.count()) {
        await expect(enabledCheckbox).toBeVisible();
      }
    }
  });

  test('Scenario 5: Create Draft button appears but forbidden controls absent', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="create-invoice-draft-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="approve-invoice-draft-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bplus-invoice-no-input"]')).toHaveCount(0);
  });

  test('Scenario 6: Create Draft from valid selected rows', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    const table = page.locator('[data-testid="billing-movement-weight-table"]');
    const emptyState = page.locator('[data-testid="billing-movement-weight-empty-state"]');
    await Promise.race([
      table.waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    test.skip(!(await table.isVisible()), 'No billing movement rows available for draft creation');

    const enabledCheckboxes = page.locator('[data-testid="billing-movement-row-checkbox"]:enabled');
    const count = await enabledCheckboxes.count();
    test.skip(count === 0, 'No selectable billable rows available');

    await enabledCheckboxes.first().click();
    const createButton = page.locator('[data-testid="create-invoice-draft-button"]');
    await expect(createButton).toBeEnabled();
    await createButton.click();

    await expect(page.locator('[data-testid="billing-invoice-draft-detail-page"]')).toBeVisible({ timeout: 20000 });
  });

  test('Scenario 7: Draft detail page loads', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
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
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
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
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
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
