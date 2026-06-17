import { test, expect } from '@playwright/test';
import { getBaseUrl, login, requireUatCredentials } from './helpers/uatAuth.js';
import {
  expectCustomerPortalLiveBanner,
  expectDepositSubmitOutcome,
  fillFirstDepositLine,
  isGoLiveTarget,
} from './helpers/customerPortalHelpers.js';

requireUatCredentials();

const goLiveTarget = isGoLiveTarget(getBaseUrl());

test.describe('CUSTOMER-PORTAL-1B Process Demo', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Deposit page shows product picker and timeline', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/deposit-request/new`);
    await expect(page.locator('[data-testid="customer-deposit-product-picker-select"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="customer-deposit-status-timeline"]')).toBeVisible();
  });

  test('Scenario 3: Deposit attachment can be selected', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/deposit-request/new`);
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'packing-list-demo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('demo'),
    });
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).toContainText('packing-list-demo.pdf');
  });

  test('Scenario 4: Attachment file appears and can be removed', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/deposit-request/new`);
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
    await page.goto(`${getBaseUrl()}/customer/deposit-request/new`);
    await fillFirstDepositLine(page, { qty: '10' });
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-06-15');
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
    await page.goto(`${getBaseUrl()}/customer/admin/deposit-review`);
    await expect(page.locator('[data-testid="admin-deposit-review-table"]')).toBeVisible({ timeout: 15000 });
    await expectCustomerPortalLiveBanner(page, getBaseUrl());
  });

  test('Scenario 7: Warehouse receiving opens', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo receiving widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="receiving-document-select"]')).toBeVisible();
  });

  test('Scenario 8: Pallet can be added and sticker is visible', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo receiving widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/receiving`);
    await page.locator('[data-testid="add-pallet-button"]').click();
    await expect(page.locator('[data-testid="pallet-card"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="pallet-sticker-preview"]')).toBeVisible();
  });

  test('Scenario 9: Packing list and box sticker are visible', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo receiving widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="packing-list-table"]')).toContainText('BOX-DEMO-001');
    await expect(page.locator('[data-testid="box-sticker-preview"]')).toBeVisible();
  });

  test('Scenario 10: Receiving verification notification preview opens', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo verification widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/admin/receiving-verification`);
    await expect(page.locator('[data-testid="receiving-variance-panel"]')).toBeVisible();
    await page.locator('[data-testid="notify-customer-preview-button"]').click();
    await expect(page.locator('[data-testid="customer-notification-preview"]')).toContainText('was not sent');
  });

  test('Scenario 11: Withdrawal source and picking rule are selectable', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/withdrawal-request/new`);
    await expect(page.locator('[data-testid="withdrawal-source-deposit-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="withdrawal-lot-select"]')).toBeVisible();
    await page.locator('[data-testid="withdrawal-picking-rule-select"]').selectOption('SPECIFIC_LOT');
    await expect(page.locator('[data-testid="withdrawal-picking-rule-select"]')).toHaveValue('SPECIFIC_LOT');
  });

  test('Scenario 12: Admin withdrawal review opens', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/admin/withdrawal-review`);
    await expect(page.locator('[data-testid="admin-withdrawal-review-table"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 13: Picking and loading page opens', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo picking widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/picking-loading`);
    await expect(page.locator('[data-testid="picking-instruction-panel"]')).toBeVisible();
  });

  test('Scenario 14: Mock barcode input works', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo picking widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/picking-loading`);
    await page.locator('[data-testid="pallet-barcode-input"]').fill('PLT-DEMO-001');
    await page.locator('[data-testid="box-barcode-input"]').fill('BOX-DEMO-001');
    await expect(page.locator('[data-testid="box-barcode-input"]')).toHaveValue('BOX-DEMO-001');
  });

  test('Scenario 15: Picked and loaded confirmations remain demo only', async ({ page }) => {
    test.skip(goLiveTarget, 'Demo picking widgets are hidden in go-live presentation');
    await page.goto(`${getBaseUrl()}/customer/warehouse/picking-loading`);
    await page.locator('[data-testid="confirm-picked-demo-button"]').click();
    await page.locator('[data-testid="confirm-loaded-demo-button"]').click();
    await expect(page.getByText(/No stock or dispatch record was changed/)).toBeVisible();
  });

  test('Scenario 16: Request history table is visible', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/requests`);
    await expect(page.locator('[data-testid="customer-request-history-table"]')).toBeVisible({ timeout: 15000 });
  });

  test('Scenario 17: Forbidden side effects remain absent', async ({ page }) => {
    await page.goto(`${getBaseUrl()}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="storage-upload-button"]')).toHaveCount(0);
    await page.goto(`${getBaseUrl()}/customer/warehouse/picking-loading`);
    await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
    await page.goto(`${getBaseUrl()}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
