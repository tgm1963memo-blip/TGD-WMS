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

test.describe('CUSTOMER-PORTAL-1 Customer Portal Demo', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Customer Portal menu/page opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer`);
    await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-portal-demo-banner"]')).toBeVisible();
  });

  test('Scenario 3: Dashboard quick actions visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer`);
    await expect(page.locator('[data-testid="customer-deposit-request-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-stock-balance-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-withdrawal-request-link"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-request-history-link"]')).toBeVisible();
  });

  test('Scenario 4: Deposit request page opens and demo submit shows success', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/deposit-request`);
    await expect(page.locator('[data-testid="customer-deposit-request-page"]')).toBeVisible();
    await page.locator('[data-testid="customer-product-code-input"]').fill('CUS-CHKN-01');
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-06-15');
    await page.locator('[data-testid="customer-deposit-product-code"]').fill('FRZ-CHKN-01');
    await page.locator('[data-testid="customer-deposit-product-name"]').fill('Frozen Chicken');
    await page.locator('[data-testid="customer-deposit-qty"]').fill('10');
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Demo Contact');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000000');
    await page.locator('[data-testid="customer-deposit-submit-button"]').click();
    await expect(page.locator('[data-testid="customer-deposit-demo-success-alert"]')).toBeVisible();
  });

  test('Scenario 5: Stock balance page opens and demo data badge visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/stock-balance`);
    await expect(page.locator('[data-testid="customer-stock-balance-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-stock-demo-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-stock-balance-table"]')).toBeVisible();
  });

  test('Scenario 6: Withdrawal request page opens and demo submit shows success', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/withdrawal-request`);
    await expect(page.locator('[data-testid="customer-withdrawal-request-page"]')).toBeVisible();
    await page.locator('[data-testid="customer-withdrawal-dispatch-date"]').fill('2026-06-16');
    await page.locator('[data-testid="customer-withdrawal-product-code"]').fill('FRZ-SFOD-02');
    await page.locator('[data-testid="customer-withdrawal-product-name"]').fill('Frozen Seafood');
    await page.locator('[data-testid="customer-withdrawal-qty"]').fill('5');
    await page.locator('[data-testid="customer-withdrawal-pickup-contact"]').fill('Pickup Contact');
    await page.locator('[data-testid="customer-withdrawal-submit-button"]').click();
    await expect(page.locator('[data-testid="customer-withdrawal-demo-success-alert"]')).toBeVisible();
  });

  test('Scenario 7: Request history page opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/requests`);
    await expect(page.locator('[data-testid="customer-request-history-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-request-history-table"]')).toBeVisible();
  });

  test('Scenario 8: Auth user settings still opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/settings/profile`);
    await expect(page.locator('[data-testid="profile-settings-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 9: Billing readiness regression page still opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 10: Forbidden side effects absent', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/operations/receiving`);
    await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
    await page.goto(`${process.env.UAT_BASE_URL}/operations/dispatch`);
    await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
