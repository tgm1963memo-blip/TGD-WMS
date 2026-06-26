import { test, expect } from '@playwright/test';
import { login, getBaseUrl, requireUatCredentials, gotoUrl } from './helpers/uatAuth.js';
import path from 'node:path';
import fs from 'node:fs';

requireUatCredentials();

const EVIDENCE_DIR = path.join(process.cwd(), 'uat-evidence', 'post-uat-13-warehouse-layout');
if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

test.describe('Warehouse Layout Occupancy', () => {
  test('occupied location shows correct inventory popup', async ({ page }) => {
    const baseUrl = getBaseUrl();
    await login(page);
    await gotoUrl(page, `${baseUrl}/dashboard`);

    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(2000);

    const occupiedDots = page.locator(
      'div[style*="rgb(245, 158, 11)"], div[style*="#f59e0b"]',
    );

    const count = await occupiedDots.count();
    if (count === 0) {
      test.skip(true, 'No occupied warehouse layout cells in current UAT data');
      return;
    }

    const firstOccupied = occupiedDots.first();
    await firstOccupied.hover();
    await expect(page.getByText('🟠 มีสินค้า')).toBeVisible({ timeout: 10000 });
    await firstOccupied.click();
    await expect(page.getByText('รายละเอียดสินค้าใน Location')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('ไม่มีสินค้าใน Location นี้')).not.toBeVisible();
    await expect(page.getByText('จำนวนคงเหลือ').first()).toBeVisible();
    await expect(page.getByText('จำนวนพร้อมจ่าย').first()).toBeVisible();
    await page.screenshot({ path: path.join(EVIDENCE_DIR, 'evidence-warehouse-layout-popup.png') });
  });
});
