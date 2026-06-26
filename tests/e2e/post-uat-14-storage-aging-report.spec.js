import { test, expect } from '@playwright/test';
import { login } from './helpers/uatAuth.js';
import path from 'node:path';
import fs from 'node:fs';

const EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'post-uat-14-storage-aging');

test.describe('post-uat-14-storage-aging-report', () => {

  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('01 — Page loads and displays Storage Aging Report', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    await expect(page.locator('.page-shell')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '01-page-loaded.png'), fullPage: true });
  });

  test('02 — Summary section renders with correct KPI cards', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    
    // Wait for summary cards to render
    await expect(page.locator('[data-testid="summary-avg-age"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="summary-avg-shelf-life"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-near-expiry"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-no-expiry"]')).toBeVisible();

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '02-summary-cards.png'), fullPage: true });
  });

  test('03 — Table displays expiry columns', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    
    // Wait for table to load
    const table = page.locator('.tgd-table');
    await table.first().waitFor({ timeout: 15000 });

    // Verify column headers exist
    const headerText = await table.first().locator('thead').innerText();
    expect(headerText).toContain('วันหมดอายุ');
    expect(headerText).toContain('อายุสินค้าคงเหลือ (วัน)');
    expect(headerText).toContain('สถานะหมดอายุ');
    expect(headerText).toContain('อายุจัดเก็บ (วัน)');

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '03-table-columns.png'), fullPage: true });
  });

  test('04 — Summary values match aggregated table data (Single Source of Truth)', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');

    // Wait for summary to load
    await expect(page.locator('[data-testid="summary-expired"]')).toBeVisible({ timeout: 15000 });
    
    // Wait for table rows to render
    const rows = page.locator('.tgd-table').first().locator('tbody tr');
    await rows.first().waitFor({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Count statuses from the table
    let expiredCount = 0;
    let nearExpiryCount = 0;
    let noExpiryCount = 0;

    for (let i = 0; i < count; i++) {
      const text = await rows.nth(i).innerText();
      if (text.includes('EXPIRED') && !text.includes('NO_EXPIRY') && !text.includes('NEAR_EXPIRY')) expiredCount++;
      if (text.includes('NEAR_EXPIRY')) nearExpiryCount++;
      if (text.includes('NO_EXPIRY_DATE')) noExpiryCount++;
    }

    // Read summary values
    const summaryExpired = parseInt(await page.locator('[data-testid="summary-expired"] .kpi-value').innerText());
    const summaryNearExpiry = parseInt(await page.locator('[data-testid="summary-near-expiry"] .kpi-value').innerText());
    const summaryNoExpiry = parseInt(await page.locator('[data-testid="summary-no-expiry"] .kpi-value').innerText());

    // They MUST match
    expect(summaryExpired).toBe(expiredCount);
    expect(summaryNearExpiry).toBe(nearExpiryCount);
    expect(summaryNoExpiry).toBe(noExpiryCount);

    await page.screenshot({ path: path.join(EVIDENCE_DIR, '04-summary-match.png'), fullPage: true });
  });

  test('05 — No console errors on the page', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await login(page);
    await page.goto('/reports/storage-aging');
    await page.locator('.tgd-table').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Filter out known noise
    const realErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('service-worker') &&
      !e.includes('ResizeObserver')
    );

    expect(realErrors).toHaveLength(0);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '05-no-console-errors.png'), fullPage: true });
  });

  test('06 — No failed API requests', async ({ page }) => {
    const failedRequests = [];
    page.on('response', response => {
      if (response.status() >= 400 && !response.url().includes('favicon')) {
        failedRequests.push({ url: response.url(), status: response.status() });
      }
    });

    await login(page);
    await page.goto('/reports/storage-aging');
    await page.locator('.tgd-table').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);

    expect(failedRequests).toHaveLength(0);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, '06-no-failed-api.png'), fullPage: true });
  });
});
