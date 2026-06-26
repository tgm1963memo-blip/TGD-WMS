/**
 * Phase 12 — Production validation screenshots
 * Run against: https://tgc-wms.vercel.app
 */
import { test, expect } from '@playwright/test';
import { login } from './helpers/uatAuth.js';
import path from 'node:path';
import fs from 'node:fs';

const EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'production-validation-phase12');

test.describe('Phase 12 — Production Validation', () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test('PROD-01: Storage Aging page loads on production', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    await expect(page.locator('.page-shell')).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'PROD-01-page-loaded.png'), fullPage: true });
  });

  test('PROD-02: Summary KPI cards on production', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    await expect(page.locator('[data-testid="summary-avg-age"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="summary-avg-shelf-life"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-expired"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-near-expiry"]')).toBeVisible();
    await expect(page.locator('[data-testid="summary-no-expiry"]')).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'PROD-02-summary-cards.png'), fullPage: true });
  });

  test('PROD-03: Table columns on production', async ({ page }) => {
    await login(page);
    await page.goto('/reports/storage-aging');
    const table = page.locator('.tgd-table').first();
    await table.waitFor({ timeout: 20000 });
    const headerText = await table.locator('thead').innerText();
    expect(headerText).toContain('วันหมดอายุ');
    expect(headerText).toContain('อายุสินค้าคงเหลือ (วัน)');
    expect(headerText).toContain('สถานะหมดอายุ');
    expect(headerText).toContain('อายุจัดเก็บ (วัน)');
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'PROD-03-table-columns.png'), fullPage: true });
  });

  test('PROD-04: No console errors on production', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await login(page);
    await page.goto('/reports/storage-aging');
    await page.locator('.tgd-table').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);
    const realErrors = errors.filter(e => !e.includes('favicon') && !e.includes('service-worker') && !e.includes('ResizeObserver'));
    expect(realErrors).toHaveLength(0);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'PROD-04-no-console-errors.png'), fullPage: true });
  });

  test('PROD-05: No failed API requests on production', async ({ page }) => {
    const failed = [];
    page.on('response', res => {
      if (res.status() >= 400 && !res.url().includes('favicon')) {
        failed.push({ url: res.url(), status: res.status() });
      }
    });
    await login(page);
    await page.goto('/reports/storage-aging');
    await page.locator('.tgd-table').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(2000);
    expect(failed).toHaveLength(0);
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'PROD-05-no-failed-api.png'), fullPage: true });
  });
});
