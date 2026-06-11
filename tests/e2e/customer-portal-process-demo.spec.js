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

test.describe('CUSTOMER-PORTAL-1B Process Demo', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('Scenario 1: Login works', async ({ page }) => {
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
  });

  test('Scenario 2: Deposit page shows customer product code and timeline', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/deposit-request`);
    await expect(page.locator('[data-testid="customer-product-code-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="customer-deposit-status-timeline"]')).toContainText('CUSTOMER_NOTIFIED');
  });

  test('Scenario 3: Deposit attachment can be selected', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/deposit-request`);
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'packing-list-demo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('demo'),
    });
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).toContainText('packing-list-demo.pdf');
  });

  test('Scenario 4: Attachment file appears and can be removed', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/deposit-request`);
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'product-photo-demo.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('demo'),
    });
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).toContainText('product-photo-demo.jpg');
    await page.locator('[data-testid="customer-deposit-attachment-remove-button"]').click();
    await expect(page.locator('[data-testid="customer-deposit-attachment-list"]')).not.toContainText('product-photo-demo.jpg');
  });

  test('Scenario 5: Deposit with attachment submits in demo mode', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/deposit-request`);
    await page.locator('[data-testid="customer-product-code-input"]').fill('CUS-CHICKEN-01');
    await page.locator('[data-testid="customer-deposit-product-code"]').fill('FRZ-CHKN-01');
    await page.locator('[data-testid="customer-deposit-product-name"]').fill('Frozen Chicken');
    await page.locator('[data-testid="customer-deposit-qty"]').fill('10');
    await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill('2026-06-15');
    await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Demo Contact');
    await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000000');
    await page.locator('[data-testid="customer-deposit-attachment-input"]').setInputFiles({
      name: 'temperature-record-demo.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('demo'),
    });
    await page.locator('[data-testid="customer-deposit-submit-button"]').click();
    await expect(page.locator('[data-testid="customer-deposit-demo-success-alert"]')).toContainText('temperature-record-demo.xlsx');
  });

  test('Scenario 6: Admin deposit review opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/admin/deposit-review`);
    await expect(page.locator('[data-testid="admin-deposit-review-table"]')).toContainText('CUS-CHICKEN-01');
  });

  test('Scenario 7: Warehouse receiving opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="receiving-document-select"]')).toBeVisible();
  });

  test('Scenario 8: Pallet can be added and sticker is visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/receiving`);
    await page.locator('[data-testid="add-pallet-button"]').click();
    await expect(page.locator('[data-testid="pallet-card"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="pallet-sticker-preview"]')).toBeVisible();
  });

  test('Scenario 9: Packing list and box sticker are visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="packing-list-table"]')).toContainText('BOX-DEMO-001');
    await expect(page.locator('[data-testid="box-sticker-preview"]')).toBeVisible();
  });

  test('Scenario 10: Receiving verification notification preview opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/admin/receiving-verification`);
    await expect(page.locator('[data-testid="receiving-variance-panel"]')).toBeVisible();
    await page.locator('[data-testid="notify-customer-preview-button"]').click();
    await expect(page.locator('[data-testid="customer-notification-preview"]')).toContainText('was not sent');
  });

  test('Scenario 11: Withdrawal source and picking rule are selectable', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/withdrawal-request`);
    await expect(page.locator('[data-testid="withdrawal-source-deposit-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="withdrawal-lot-select"]')).toBeVisible();
    await page.locator('[data-testid="withdrawal-picking-rule-select"]').selectOption('SPECIFIC_LOT');
    await expect(page.locator('[data-testid="withdrawal-picking-rule-select"]')).toHaveValue('SPECIFIC_LOT');
  });

  test('Scenario 12: Admin withdrawal review opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/admin/withdrawal-review`);
    await expect(page.locator('[data-testid="admin-withdrawal-review-table"]')).toBeVisible();
  });

  test('Scenario 13: Picking and loading page opens', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/picking-loading`);
    await expect(page.locator('[data-testid="picking-instruction-panel"]')).toBeVisible();
  });

  test('Scenario 14: Mock barcode input works', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/picking-loading`);
    await page.locator('[data-testid="pallet-barcode-input"]').fill('PLT-DEMO-001');
    await page.locator('[data-testid="box-barcode-input"]').fill('BOX-DEMO-001');
    await expect(page.locator('[data-testid="box-barcode-input"]')).toHaveValue('BOX-DEMO-001');
  });

  test('Scenario 15: Picked and loaded confirmations remain demo only', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/picking-loading`);
    await page.locator('[data-testid="confirm-picked-demo-button"]').click();
    await page.locator('[data-testid="confirm-loaded-demo-button"]').click();
    await expect(page.getByText(/No stock or dispatch record was changed/)).toBeVisible();
  });

  test('Scenario 16: Request history timeline is visible', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/requests`);
    await expect(page.locator('[data-testid="customer-request-status-timeline"]').first()).toBeVisible();
  });

  test('Scenario 17: Forbidden side effects remain absent', async ({ page }) => {
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/receiving`);
    await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="storage-upload-button"]')).toHaveCount(0);
    await page.goto(`${process.env.UAT_BASE_URL}/customer/warehouse/picking-loading`);
    await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
    await page.goto(`${process.env.UAT_BASE_URL}/reports/billing-movement-weight`);
    await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
  });
});
