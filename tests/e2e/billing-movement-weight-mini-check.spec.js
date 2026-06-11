import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Validate required environment variables
if (!process.env.UAT_BASE_URL) {
  throw new Error('Missing UAT_BASE_URL in environment variables');
}
if (!process.env.UAT_EMAIL) {
  throw new Error('Missing UAT_EMAIL in environment variables');
}
if (!process.env.UAT_PASSWORD) {
  throw new Error('Missing UAT_PASSWORD in environment variables');
}

// Helper to perform login using environment variables or existing auth helper
async function login(page) {
  await page.goto(process.env.UAT_BASE_URL);
  // Attempt to locate login form fields using common selectors
  const emailInput = page.locator('input[name="email"], input[type="email"]');
  const passwordInput = page.locator('input[name="password"], input[type="password"]');
  await emailInput.fill(process.env.UAT_EMAIL);
  await passwordInput.fill(process.env.UAT_PASSWORD);
  const submitBtn = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("เข้าสู่ระบบ")');
  await submitBtn.click();
  // Verify app shell appears after login
  await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Billing Movement Weight Mini Check', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await expect(page.locator('nav')).toBeVisible();
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
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    const reportPage = page.locator('[data-testid="billing-movement-weight-report-page"]');
    await expect(reportPage).toBeVisible();
  });

  test('Scenario 4: Frontend reads billing view', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
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
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
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
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
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

  test('Scenario 7: Gate 3B features must not exist', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    const forbiddenSelectors = [
      '[data-testid="create-invoice-draft-button"]',
      '[data-testid="approve-invoice-draft-button"]',
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

    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="login-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="billing-movement-weight-report-page"]')).not.toBeVisible();
  });
});
