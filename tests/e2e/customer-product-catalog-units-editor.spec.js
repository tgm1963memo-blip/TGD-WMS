import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';
import { waitForAuthenticatedSidebar, readProfileRole } from './helpers/billingAccess.js';

requireUatCredentials();

// Real end-to-end check for the new packaging-unit conversion feature
// (ลัง/แพ็ค): adds a unit to a real catalog product via the admin UI, saves,
// reloads the page, and confirms the unit is actually persisted -- then
// removes it again so no test data lingers.
test.describe('Customer product catalog — packaging units editor', () => {
  test('add a packaging unit to a product, save, reload, confirm it persisted, then remove it', async ({ page }) => {
    await login(page);
    await waitForAuthenticatedSidebar(page);
    const role = await readProfileRole(page);
    test.skip(!['admin', 'accounting'].includes(role), `Current role (${role}) cannot manage the customer product catalog`);

    await gotoUrl(page, `${getBaseUrl()}/admin/customer-products`);
    await expect(page.locator('[data-testid="customer-product-catalog-admin-page"]')).toBeVisible({ timeout: 20000 });

    // Filter to TGM (C002) and open the first product's edit modal.
    const customerFilter = page.locator('select').first();
    const optionTexts = await customerFilter.locator('option').allTextContents();
    const c002Label = optionTexts.find((o) => o.includes('C002'));
    await customerFilter.selectOption({ label: c002Label });
    await page.waitForTimeout(1000);

    const firstEditButton = page.getByRole('button', { name: 'แก้ไข' }).first();
    await firstEditButton.click();

    const modal = page.getByText('แก้ไขสินค้า').first();
    await expect(modal).toBeVisible({ timeout: 10000 });

    // Add a unit row: "ทดสอบลัง" = 10 boxes/unit, 5 kg/unit (bookkeeping value).
    await page.getByRole('button', { name: '+ เพิ่มหน่วย' }).click();
    const unitRow = page.locator('input[placeholder="ชื่อหน่วย เช่น ลัง"]').first();
    await unitRow.fill('ทดสอบลัง E2E');
    await page.locator('input[placeholder="กล่อง/หน่วย (ไม่บังคับ)"]').first().fill('10');
    await page.locator('input[placeholder="กก./หน่วย"]').first().fill('5');

    await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await expect(page.getByText('บันทึกสำเร็จ').or(page.getByText('บันทึกข้อมูลเรียบร้อย'))).toBeVisible({ timeout: 10000 }).catch(() => {});

    // Reopen the same product's edit modal to confirm the unit persisted.
    await page.waitForTimeout(1000);
    await page.locator('select').first().selectOption({ label: c002Label });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'แก้ไข' }).first().click();
    await expect(page.getByText('แก้ไขสินค้า').first()).toBeVisible({ timeout: 10000 });

    const persistedLabel = page.locator('input[value="ทดสอบลัง E2E"]');
    await expect(persistedLabel).toBeVisible({ timeout: 10000 });

    // Cleanup: remove the test unit and save again.
    const row = persistedLabel.locator('xpath=ancestor::div[contains(@style,"grid-template-columns")]').first();
    await row.getByRole('button', { name: 'ลบ' }).click();
    await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
    await page.waitForTimeout(1000);
  });
});
