import { test, expect } from '@playwright/test';
import { login, getBaseUrl, requireUatCredentials , gotoUrl } from './helpers/uatAuth.js';
import path from 'node:path';
import fs from 'node:fs';

requireUatCredentials();

const EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'post-uat-12-admin-review-columns');

function ensureEvidence() {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function screenshot(page, name) {
  ensureEvidence();
  try {
    await page.screenshot({ path: path.join(EVIDENCE_DIR, name), fullPage: true });
  } catch { /* best-effort */ }
}

const baseUrl = getBaseUrl();

test.describe('Post-UAT: Admin Review Columns', () => {
  test.setTimeout(90000);

  test.beforeAll(() => ensureEvidence());

  test('01 — Admin withdrawal review table shows requested_weight, requested_boxes, requested_quantity', async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${baseUrl}/customer/admin/withdrawal-review`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('[data-testid="customer-admin-withdrawal-review-page"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('[data-testid="admin-withdrawal-review-table"]')).toBeVisible({ timeout: 20000 });

    const reviewBtn = page.locator('[data-testid^="admin-withdrawal-review-select-"]').first();
    if (!await reviewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      test.skip(true, 'No withdrawal rows in UAT data');
      return;
    }
    await reviewBtn.click();

    const modal = page.locator('.modal, [role="dialog"]').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    const modalText = await modal.textContent();
    expect(modalText).not.toContain('ระบบเกิดข้อผิดพลาด');
    expect(modalText).toMatch(/น้ำหนักที่ขอ/);
    expect(modalText).toMatch(/กล่องที่ขอ/);
    expect(modalText).toMatch(/จำนวนที่ขอ/);

    await screenshot(page, '01-admin-review-columns.png');
  });
});
