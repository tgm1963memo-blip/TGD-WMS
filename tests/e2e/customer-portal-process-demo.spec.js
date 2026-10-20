import { test, expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import {
  expectCustomerPortalLiveBanner,
  expectDepositSubmitOutcome,
  fillFirstDepositLine,
  isGoLiveTarget,
  selectProxyCustomerIfPresent,
} from './helpers/customerPortalHelpers.js';

requireUatCredentials();

const goLiveTarget = isGoLiveTarget(getBaseUrl());

test.describe('CUSTOMER-PORTAL-1B Process Demo', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Deposit page shows product picker and timeline', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-product-picker-select"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-deposit-status-timeline"]')).toBeVisible();
  });

  test('Scenario 3: Deposit attachment can be selected', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'packing-list-demo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('demo'),
    });
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).toContainText('packing-list-demo.pdf');
  });

  test('Scenario 4: Attachment file appears and can be removed', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'product-photo-demo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('demo'),
    });
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).toContainText('product-photo-demo.jpg');
    await page.locator('[data-testid="customer-deposit-attachment-remove-button"]').click();
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).not.toContainText('product-photo-demo.jpg');
  });

  test('Scenario 5: Deposit with attachment submits in live mode or shows scope guard', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/deposit-request/new`);
    await fillFirstDepositLine(page, { qty: '10' });
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(futureDate);
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Demo Contact');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000000');
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'temperature-record-demo.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('demo'),
    });
    await page.locator('[data-testid="customer-deposit-submit-button"]').click();
    await expectDepositSubmitOutcome(page);
  });

  test('Scenario 6: Admin deposit review opens with live table', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/admin/deposit-review`);
    await expect(page.locator('[data-testid="admin-deposit-review-table"]')).toBeVisible({ timeout: 15000 });
    await expectCustomerPortalLiveBanner(page, getBaseUrl());
  });

  test('Scenario 11: Withdrawal form shows product picker, source deposit and LOT fields', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/withdrawal-request/new`);
    await selectProxyCustomerIfPresent(page, 'customer-withdrawal-proxy-customer-select');
    await expect(page.locator('[data-testid="customer-withdrawal-lines-table"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-withdrawal-product-picker-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="withdrawal-source-deposit-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="withdrawal-lot-select"]')).toBeVisible();
  });

  test('Scenario 12: Admin withdrawal review opens', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/admin/withdrawal-review`);
    await expect(page.locator('[data-testid="admin-withdrawal-review-table"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 16: Request history table is visible', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/customer/requests`);
    await expect(page.locator('[data-testid="customer-request-history-table"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 17: Forbidden side effects remain absent', async ({ page }) => {
    await gotoUrl(page, `${getBaseUrl()}/operations/receiving`);
    await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="storage-upload-button"]')).toHaveCount(0);
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
