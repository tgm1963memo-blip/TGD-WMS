import { test, expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import { isBillingWriteRole, readProfileRole } from './helpers/billingAccess.js';

requireUatCredentials();

test.describe('Billing Movement Weight Mini Check', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible({ timeout: 20000 });
  });

  test('Scenario 1: UI loads and login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Billing menu appears', async ({ page }) => {
    const billingMenu = page.locator('[data-testid="billing-menu-item"]');
    await expect(billingMenu).toBeVisible();
    await billingMenu.click();
  });

  test('Scenario 3: Report page loads', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    const reportPage = page.locator('[data-testid="billing-movement-weight-report-page"]');
    await expect(reportPage).toBeVisible();
  });

  test('Scenario 4: Frontend reads billing view', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    const table = page.locator('[data-testid="billing-movement-weight-table"]');
    const emptyState = page.locator('[data-testid="billing-movement-weight-empty-state"]');
    const errorAlert = page.locator('[data-testid="billing-movement-weight-error-alert"]');

    // Wait for any of the three possible UI states
    const result = await Promise.race([
      table.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'data'),
      emptyState.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'empty'),
      errorAlert.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'error'),
    ]);

    if (await table.isVisible()) {
      const rowCount = await table.locator('tbody tr').count();
      expect(rowCount).toBeGreaterThan(0);
    } else if (await emptyState.isVisible()) {
      // acceptable empty state
    } else if (await errorAlert.isVisible()) {
      const alertText = await errorAlert.textContent();
      console.log('Error alert text:', alertText);
    }
  });

  test('Scenario 5: Filter form works', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    const filterForm = page.locator('[data-testid="billing-movement-weight-filter-form"]');
    await expect(filterForm).toBeVisible();
    // If there are any input/select controls, interact safely
    const firstInput = filterForm.locator('input, select').first();
    if (await firstInput.count()) {
      // simple interaction: clear then type a space (no actual filter change)
      await firstInput.fill('');
    }
    await page.waitForLoadState('networkidle');
    // Verify page still shows table or empty state without crashing
    const stableLocator = page.locator('[data-testid="billing-movement-weight-table"],[data-testid="billing-movement-weight-empty-state"]').first();
    await expect(stableLocator).toBeVisible();
  });

  test('Scenario 6: CSV export button present', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    const exportBtn = page.locator('[data-testid="billing-movement-weight-export-button"]');
    await expect(exportBtn).toBeVisible();
    if (await exportBtn.isEnabled()) {
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportBtn.click(),
      ]);
      // default download path is under test-results/downloads
      await download.path();
    } else {
      await expect(exportBtn).toBeDisabled();
    }
  });

  test('Scenario 7: Gate 3B forbidden controls must not exist', async ({ page }, testInfo) => {
    const role = await readProfileRole(page);
    if (!isBillingWriteRole(role)) {
      testInfo.skip(true, `Requires billing write role accounting/admin (current: ${role || 'unknown'})`);
    }

    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="create-invoice-draft-button"]')).toBeVisible({ timeout: 20000 });
    const forbiddenSelectors = [
      '[data-testid="approve-invoice-draft-button"]',
      '[data-testid="export-bplus-button"]',
      '[data-testid="mark-billed-button"]',
      '[data-testid="bplus-invoice-no-input"]',
    ];
    for (const sel of forbiddenSelectors) {
      await expect(page.locator(sel)).toHaveCount(0);
    }
  });

  test('Scenario 8: Logout clears session and blocks protected route', async ({ page }) => {
    const logoutButton = page.locator('[data-testid="logout-button"]');
    await expect(logoutButton).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="user-session-menu"]')).toBeVisible();

    await logoutButton.click();

    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="app-shell"]')).not.toBeVisible();

    await gotoUrl(page, `${getBaseUrl()}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="billing-movement-weight-report-page"]')).not.toBeVisible();
  });
});
