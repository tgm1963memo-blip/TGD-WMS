import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
import { getBaseUrl, requireUatCredentials, gotoUrl } from './helpers/uatAuth.js';
import { skipUnlessBillingReader } from './helpers/billingAccess.js';

requireUatCredentials();

// The customer-format Excel statement export on the "billing period" modal of
// /billing/invoice-drafts. Read-only, like the preview suite next to it: it
// previews a period and downloads files, and NEVER clicks "ยืนยันสร้างร่างบิล".
//
// OVO (C003) / October 2026 is the period accounting's own hand-made file
// (212 Frozen rows, 237 Chilled rows) was checked against.
test.describe('Billing statement — customer-format Excel export', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await skipUnlessBillingReader(testInfo, page);
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
  });

  async function previewOvoOctober(page) {
    const openButton = page.locator('[data-testid="open-storage-bill-modal-button"]');
    test.skip(await openButton.count() === 0, 'Current role has no write access — create-bill button not rendered');
    await openButton.click();

    const customerSelect = page.locator('[data-testid="storage-bill-customer-select"]');
    try {
      await expect(customerSelect.locator('option')).not.toHaveCount(1, { timeout: 10000 });
    } catch {
      test.skip(true, 'No customers available to preview against');
    }
    const ovo = customerSelect.locator('option', { hasText: /OVO/i });
    test.skip(await ovo.count() === 0, 'OVO customer not present in this environment');
    await customerSelect.selectOption(await ovo.first().getAttribute('value'));

    await page.locator('[data-testid="storage-bill-start-date-input"]').fill('2026-10-01');
    await page.locator('[data-testid="storage-bill-end-date-input"]').fill('2026-10-31');
    await page.locator('[data-testid="storage-bill-preview-button"]').click();
    await Promise.race([
      page.getByText('รวมทั้งสิ้น').first().waitFor({ state: 'visible', timeout: 30000 }),
      page.locator('.banner-danger').first().waitFor({ state: 'visible', timeout: 30000 }),
    ]);
  }

  async function readDownload(download) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(await download.path());
    return workbook;
  }

  test('downloads a styled statement workbook, one storage sheet per room, with live formulas', async ({ page }) => {
    await previewOvoOctober(page);
    await expect(page.locator('[data-testid="billing-statement-export-bar"]')).toBeVisible();
    // not TGM -> the navy (OVO / THAIMAX) layout is preselected
    await expect(page.locator('[data-testid="billing-statement-theme-select"]')).toHaveValue('NAVY');

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.locator('[data-testid="billing-statement-export-button"]').click(),
    ]);
    expect(download.suggestedFilename()).toBe('C003_ค่าบริการรับฝาก_10.69.xlsx');
    await expect(page.locator('[data-testid="billing-statement-export-error"]')).toHaveCount(0);

    const workbook = await readDownload(download);
    const names = workbook.worksheets.map((ws) => ws.name);
    expect(names).toEqual(expect.arrayContaining(['Frozen 10.69', 'Chilled 10.69', 'Movement Ledger 10.69', 'Stock Report 31.10']));

    const frozen = workbook.getWorksheet('Frozen 10.69');
    expect(frozen.getCell('A1').value).toBe('TG Cold Storage Co., Ltd.');
    expect(frozen.getCell('A8').value).toBe('รหัสสินค้า');
    expect(frozen.getCell('A8').fill.fgColor.argb).toBe('FF1F4E78');
    expect(frozen.getCell('L9').value.formula).toBe('ROUND(H9*J9*K9,2)');
    expect(frozen.getCell('L4').value).toBe('สรุปค่าบริการรวม');

    // The modal is still usable afterwards.
    await expect(page.locator('[data-testid="storage-bill-preview-button"]')).toBeVisible();
  });

  test('switching the layout to the TGM look changes the workbook styling', async ({ page }) => {
    await previewOvoOctober(page);
    await page.locator('[data-testid="billing-statement-theme-select"]').selectOption('LIGHT');
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 60000 }),
      page.locator('[data-testid="billing-statement-export-button"]').click(),
    ]);
    const frozen = (await readDownload(download)).getWorksheet('Frozen 10.69');
    expect(frozen.getCell('A10').value).toBe('รหัสสินค้า');
    expect(frozen.getCell('A10').fill.fgColor.argb).toBe('FFBDD7EE');
    expect(frozen.getCell('K3').value).toBe('สรุปค่าบริการรวม');
  });

  test('says so instead of downloading when the period has no overtime', async ({ page }) => {
    await previewOvoOctober(page);
    await page.locator('[data-testid="billing-statement-export-ot-button"]').click();
    const error = page.locator('[data-testid="billing-statement-export-error"]');
    const downloaded = page.waitForEvent('download', { timeout: 30000 }).then(() => 'download').catch(() => null);
    const outcome = await Promise.race([
      error.waitFor({ state: 'visible', timeout: 30000 }).then(() => 'message'),
      downloaded,
    ]);
    // Either is correct, depending on whether OVO had OT that month; what
    // must not happen is a silent no-op.
    expect(['message', 'download']).toContain(outcome);
    if (outcome === 'message') await expect(error).toContainText('ไม่มีรายการค่าล่วงเวลา');
  });
});
