import { test, expect } from '@playwright/test';
import { getBaseUrl, login , gotoUrl } from './helpers/uatAuth.js';

const CUSTOMER_EMAIL = process.env.UAT_CUSTOMER_EMAIL || 'customer.demo@tgd-wms.local';
const CUSTOMER_PASSWORD = process.env.UAT_PASSWORD
  || process.env.UAT_DEMO_PASSWORD
  || process.env.UAT_CUSTOMER_PASSWORD;

test.describe('Customer demo user UAT flow', () => {
  test.beforeEach(async ({ page }) => {
    if (!CUSTOMER_PASSWORD) {
      test.skip(true, 'UAT_CUSTOMER_PASSWORD / UAT_PASSWORD not configured');
    }

    await login(page, { email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD });
  });

  test('opens customer portal without scope warning', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer`);
    await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible();
    await expect(page.locator('.customer-portal-kpi-grid')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/not linked to a customer|ไม่ได้เชื่อมกับลูกค้า/i)).toHaveCount(0);
  });

  test('customer portal hides item master from navigation', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer`);
    await expect(page.locator('[data-testid="customer-product-catalog-link"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="customer-product-catalog-menu-item"]')).toHaveCount(0);
  });

  test('cannot access customer product catalog page', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/products`);
    await expect(page.locator('[data-testid="permission-denied-notice"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-product-catalog-page"]')).toHaveCount(0);
  });

  test('submits deposit request using catalog product', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 15000 });

    const picker = page.locator('[data-testid="customer-deposit-product-picker-select"]');
    const optionCount = await picker.locator('option').count();
    if (optionCount <= 1) {
      test.skip(true, 'No catalog products configured for this customer — add products via admin catalog first');
      return;
    }
    await picker.selectOption({ index: 1 });
    await page.locator('[data-testid="customer-deposit-weight-per-box"]').fill('10');
    await page.locator('[data-testid="customer-deposit-box-count"]').fill('5');
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-12-31');
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Customer Demo Contact');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000099');
    await page.locator('[data-testid="customer-deposit-submit-button"]').click();

    await expect(page.locator('[data-testid="customer-deposit-live-success-alert"]')).toBeVisible({ timeout: 20000 });
  });
});
