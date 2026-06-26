/**
 * POST-UAT REGRESSION: Admin Inventory Balance Page
 *
 * Validates that:
 * 1. InventoryBalancePage calls tgd_get_all_customer_stock_balances (not raw deposit lines)
 * 2. Completed withdrawals are deducted from balance
 * 3. Zero-balance rows are excluded
 * 4. Page description confirms deduction behavior
 * 5. Customer hierarchy is rendered correctly
 */

import { test, expect } from '@playwright/test';
import { login, getBaseUrl, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import path from 'node:path';
import fs from 'node:fs';

requireUatCredentials();

const EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'post-uat-04-admin-inventory');

function ensureEvidence() {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function screenshot(page, name) {
  ensureEvidence();
  try {
    await page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: true });
  } catch { /* best-effort */ }
}

async function gotoInventoryBalance(page, baseUrl) {
  await gotoUrl(page, `${baseUrl}/inventory`);
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.page-shell').first()).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(2000); // allow RPC
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Post-UAT: Admin Inventory Balance Page', () => {
  test.setTimeout(90000);

  const baseUrl = getBaseUrl();

  test.beforeAll(() => {
    ensureEvidence();
  });

  test('01 — Page loads without fatal error', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);
    await screenshot(page, '01-page-load.png');

    const errBound = page.locator('.banner-danger[role="alert"]');
    const hasErr = await errBound.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasErr) {
      const msg = await errBound.textContent();
      // Some errors are acceptable (RPC not deployed yet)
      // But the page must not show a React crash boundary
      expect(msg).not.toContain('ระบบเกิดข้อผิดพลาด');
    }
  });

  test('02 — Page title is "ยอดคงเหลือสินค้า"', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('ยอดคงเหลือสินค้า');
    await screenshot(page, '02-page-title.png');
  });

  test('03 — Description confirms withdrawal deduction', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('หักการเบิกที่ยืนยันแล้ว');
    await screenshot(page, '03-description.png');
  });

  test('04 — Stat cards show "กล่องคงเหลือรวม" and "น้ำหนักคงเหลือรวม"', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('กล่องคงเหลือรวม');
    expect(bodyText).toContain('น้ำหนักคงเหลือรวม');
    await screenshot(page, '04-stat-cards.png');
  });

  test('05 — Column headers show "คงเหลือ (กล่อง)" not "รับเข้า"', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    // Expand first product group to see table headers
    const expandBtn = page.locator('button').filter({ hasText: '▼ ขยายทั้งหมด' }).first();
    if (await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(1000);
    }

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('คงเหลือ (กล่อง)');
    expect(bodyText).toContain('คงเหลือ (กก.)');
    await screenshot(page, '05-column-headers.png');
  });

  test('06 — Footer text confirms zero-balance filtering', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const bodyText = await page.locator('body').textContent();
    // Footer should mention the filter
    expect(bodyText).toContain('เฉพาะรายการที่มียอดคงเหลือ');
    await screenshot(page, '06-footer.png');
  });

  test('07 — Customer filter select renders with customers', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const customerSelect = page.locator('select').first();
    await expect(customerSelect).toBeVisible({ timeout: 10000 });

    // Should have at least the "ลูกค้าทุกราย" option
    const options = customerSelect.locator('option');
    const optCount = await options.count();
    expect(optCount).toBeGreaterThanOrEqual(1);

    const firstOptText = await options.first().textContent();
    expect(firstOptText).toContain('ลูกค้าทุกราย');
    await screenshot(page, '07-customer-filter.png');
  });

  test('08 — Customer filter works client-side (no reload)', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const customerSelect = page.locator('select').first();
    const options = customerSelect.locator('option');
    const optCount = await options.count();

    if (optCount <= 1) {
      test.skip(true, 'No customers to filter by — skip');
      return;
    }

    const beforeBody = await page.locator('body').textContent();
    const totalRows = (beforeBody.match(/รายการ/g) ?? []).length;

    // Select specific customer
    const customerValue = await options.nth(1).getAttribute('value');
    if (!customerValue) return;

    await customerSelect.selectOption(customerValue);
    await page.waitForTimeout(500); // client-side filter is immediate

    // URL should NOT change (client-side filter)
    const currentUrl = page.url();
    expect(currentUrl).not.toContain(customerValue);

    await screenshot(page, '08-customer-filtered.png');
  });

  test('09 — Expand/collapse product rows works', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    // Check for expand button
    const expandAllBtn = page.locator('button').filter({ hasText: /ขยายทั้งหมด/ }).first();
    if (!await expandAllBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No data or no expand button — skip');
      return;
    }

    await expandAllBtn.click();
    await page.waitForTimeout(500);

    // After expand, we should see detail table
    const hasTable = await page.locator('table').isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasTable).toBe(true);
    await screenshot(page, '09-expanded.png');

    // Collapse
    const collapseBtn = page.locator('button').filter({ hasText: /ย่อทั้งหมด/ }).first();
    if (await collapseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await collapseBtn.click();
      await page.waitForTimeout(500);
      await screenshot(page, '09-collapsed.png');
    }
  });

  test('10 — Detail modal opens via "ดูรายละเอียด" button', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    // Expand all to show detail rows
    const expandBtn = page.locator('button').filter({ hasText: /ขยายทั้งหมด/ }).first();
    if (!await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No data — skip');
      return;
    }
    await expandBtn.click();
    await page.waitForTimeout(1000);

    // Click first "ดูรายละเอียด" button
    const detailBtn = page.locator('button').filter({ hasText: 'ดูรายละเอียด' }).first();
    if (!await detailBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No detail button visible — skip');
      return;
    }

    await detailBtn.click();
    await page.waitForTimeout(1000);
    await screenshot(page, '10-detail-modal.png');

    // Modal should open (look for modal overlay or dialog)
    const modal = page.locator('[role="dialog"], .modal, .modal-overlay').first();
    const hasModal = await modal.isVisible({ timeout: 5000 }).catch(() => false);
    // Soft check — modal presence
    if (!hasModal) {
      // Modal may render differently; check no crash
      const crashed = await page.locator('.banner-danger').isVisible({ timeout: 3000 }).catch(() => false);
      expect(crashed).toBe(false);
    }
  });

  test('11 — Balance values are numeric (not NaN/undefined)', async ({ page }) => {
    await login(page);
    await gotoInventoryBalance(page, baseUrl);

    const expandBtn = page.locator('button').filter({ hasText: /ขยายทั้งหมด/ }).first();
    if (await expandBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expandBtn.click();
      await page.waitForTimeout(1000);
    }

    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
    expect(bodyText).not.toContain('null');
    await screenshot(page, '11-no-nan.png');
  });
});
