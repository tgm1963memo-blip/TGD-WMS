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
    await expect(page.locator('[data-testid="billing-menu-item"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="billing-invoice-drafts-menu-item"]')).toBeVisible({ timeout: 20000 });
  });

  test('Scenario 3: Invoice Draft List page loads', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-filter-form"]')).toBeVisible();
  });

  test('Scenario 4: Billing Movement Weight page allows selecting billable rows', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
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
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="create-invoice-draft-button"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="approve-invoice-draft-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bplus-invoice-no-input"]')).toHaveCount(0);
  });

  test('Scenario 6: Create Draft from valid selected rows', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
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

test.describe('Gate 3B-3 Billing Invoice Draft Approval', () => {
  test.skip(
    process.env.RUN_INVOICE_DRAFT_APPROVAL_E2E !== 'true',
    'Approval E2E is opt-in because it creates and approves a UAT draft',
  );

  test.beforeEach(async ({ page }, testInfo) => {
    await skipUnlessBillingReader(testInfo, page);
  });

  test('Scenario 11: Created draft can be approved and becomes read-only', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    const table = page.locator('[data-testid="billing-movement-weight-table"]');
    const emptyState = page.locator('[data-testid="billing-movement-weight-empty-state"]');
    await Promise.race([
      table.waitFor({ state: 'visible', timeout: 10000 }),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }),
    ]);

    test.skip(!(await table.isVisible()), 'No billing movement rows available for approval E2E');

    const enabledCheckbox = page.locator('[data-testid="billing-movement-row-checkbox"]:enabled').first();
    test.skip(!(await enabledCheckbox.count()), 'No selectable billable rows available for approval E2E');

    await enabledCheckbox.click();
    await page.locator('[data-testid="create-invoice-draft-button"]').click();
    await expect(page.locator('[data-testid="billing-invoice-draft-detail-page"]')).toBeVisible({ timeout: 20000 });

    const approveButton = page.locator('[data-testid="invoice-draft-approve-button"]');
    await expect(approveButton).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await approveButton.click();

    await expect(page.locator('[data-testid="invoice-draft-approve-success-alert"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="invoice-draft-status-badge"]')).toContainText('APPROVED');
    await expect(page.locator('[data-testid="invoice-draft-approve-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="invoice-draft-cancel-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="bplus-invoice-no-input"]')).toHaveCount(0);
  });
});
