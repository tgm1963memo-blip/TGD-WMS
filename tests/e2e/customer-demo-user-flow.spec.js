import { test, expect } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getBaseUrl } from './helpers/uatAuth.js';

dotenv.config({ path: '.env.local' });

test.describe('Customer demo user UAT flow', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.UAT_CUSTOMER_EMAIL || !process.env.UAT_CUSTOMER_PASSWORD) {
      test.skip(true, 'UAT_CUSTOMER_EMAIL / UAT_CUSTOMER_PASSWORD not configured');
    }

    await page.goto(`${getBaseUrl()}/login`);
    await page.locator('[data-testid="login-email-input"], input[type="email"]').fill(process.env.UAT_CUSTOMER_EMAIL);
    await page.locator('[data-testid="login-password-input"], input[type="password"]').fill(process.env.UAT_CUSTOMER_PASSWORD);
    await page.locator('[data-testid="login-submit-button"], button[type="submit"]').click();
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
  });

  test('opens customer portal without scope warning', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer`);
    await expect(page.locator('[data-testid="customer-portal-page"]')).toBeVisible();
    await expect(page.locator('.customer-portal-kpi-grid')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/not linked to a customer|ไม่ได้เชื่อมกับลูกค้า/i)).toHaveCount(0);
  });

  test('customer portal hides item master from navigation', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer`);
    await expect(page.locator('[data-testid="customer-product-catalog-link"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="customer-product-catalog-menu-item"]')).toHaveCount(0);
  });

  test('cannot access customer product catalog page', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/products`);
    await expect(page.locator('[data-testid="permission-denied-notice"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-product-catalog-page"]')).toHaveCount(0);
  });

  test('submits deposit request using catalog product', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="customer-deposit-product-picker-select"]').selectOption({ index: 1 });
    await page.locator('[data-testid="customer-deposit-weight-per-box"]').fill('10');
    await page.locator('[data-testid="customer-deposit-box-count"]').fill('5');
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-12-31');
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Customer Demo Contact');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000099');
    await page.locator('[data-testid="customer-deposit-submit-button"]').click();

    await expect(page.locator('[data-testid="customer-deposit-live-success-alert"]')).toBeVisible({ timeout: 20000 });
  });
});
