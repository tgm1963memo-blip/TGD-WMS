import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';

requireUatCredentials();

// Covers Part J: per-customer email notification preferences on
// /master/customers. Verifies (a) the page still loads cleanly now that
// getCustomers()/upsertCustomer() select/write 3 new columns — the same
// class of "column does not exist" regression Part I's migration caught —
// and (b) a toggle genuinely persists to the database and back, restoring
// the original value afterward so this test leaves no net change on
// whichever real customer it happens to open.
test.describe('Customer email notification preferences', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await gotoUrl(page, `${getBaseUrl()}/master/customers`);
  });

  test('customer list loads without error after the notification-preference columns were added', async ({ page }) => {
    await expect(page.locator('.banner-danger')).toHaveCount(0);
    const table = page.locator('table.data-table');
    await expect(table).toBeVisible({ timeout: 15000 });
  });

  test('editing a customer shows all 3 notification checkboxes, defaulting to checked', async ({ page }) => {
    const editButton = page.getByRole('button', { name: 'แก้ไข' }).first();
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    const section = page.locator('[data-testid="customer-notification-settings-section"]');
    await expect(section).toBeVisible();
    await expect(page.locator('[data-testid="customer-notify-deposit-confirmed-checkbox"]')).toBeChecked();
    await expect(page.locator('[data-testid="customer-notify-withdrawal-completed-checkbox"]')).toBeChecked();
    await expect(page.locator('[data-testid="customer-notify-invoice-approved-checkbox"]')).toBeChecked();
  });

  test('toggling a notification preference persists across reload, then restores cleanly', async ({ page }) => {
    const editButton = page.getByRole('button', { name: 'แก้ไข' }).first();
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await editButton.click();

    const checkbox = page.locator('[data-testid="customer-notify-deposit-confirmed-checkbox"]');
    await expect(checkbox).toBeChecked();

    // Turn it off and save.
    await checkbox.uncheck();
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.locator('.banner-danger')).toHaveCount(0);

    // Reopen the SAME row and confirm the unchecked state actually persisted
    // (not just local React state) — reload the page first to rule out a
    // stale in-memory list masking a write that never really happened.
    await page.reload();
    const editButtonAfter = page.getByRole('button', { name: 'แก้ไข' }).first();
    await expect(editButtonAfter).toBeVisible({ timeout: 15000 });
    await editButtonAfter.click();
    await expect(page.locator('[data-testid="customer-notify-deposit-confirmed-checkbox"]')).not.toBeChecked();

    // Restore it — this test must leave no net change on real customer data.
    await page.locator('[data-testid="customer-notify-deposit-confirmed-checkbox"]').check();
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.locator('.banner-danger')).toHaveCount(0);

    await page.reload();
    const editButtonFinal = page.getByRole('button', { name: 'แก้ไข' }).first();
    await expect(editButtonFinal).toBeVisible({ timeout: 15000 });
    await editButtonFinal.click();
    await expect(page.locator('[data-testid="customer-notify-deposit-confirmed-checkbox"]')).toBeChecked();
  });
});
