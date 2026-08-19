import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';

requireUatCredentials();

const TEST_NOTE = 'E2E_TEST overtime rate';

// Covers Part G: configures a real OVERTIME rate (unit_basis PER_HOUR) for
// a real customer, confirms it appears as a selectable auxiliary-service
// checkbox on the withdrawal request create page — proving the new
// tgd_customer_withdrawal_request_services table/RPCs and the
// billingRateEngineService.js wiring work end-to-end — then deletes the
// test rate so no test data is left behind. Never actually creates or
// submits a withdrawal request (that would leave a real draft record with
// no simple staff-only cleanup path), so this stops at "the checkbox
// renders correctly," matching the same scope boundary used for Part D's
// contract-terms E2E coverage.
//
// IMPORTANT ordering lesson from an earlier version of this test: don't
// create real test data and only THEN call test.skip() inside a
// try/finally, expecting `finally` to clean it up — Playwright's
// test.skip() does not reliably unwind through a surrounding try/finally,
// and it left a real rate row behind in production once already. Check
// every skip precondition BEFORE writing anything.
test.describe('Withdrawal auxiliary services (Part G)', () => {
  test('OVERTIME rate configured for a customer shows up as a checkbox on their withdrawal request page', async ({ page }) => {
    await login(page);

    // Check the skip precondition FIRST, with zero side effects, before
    // creating any real data. useCustomerPortalProfile() resolves the
    // profile (and therefore isRequestProxy) asynchronously after mount —
    // wait for the picker to actually appear rather than taking an
    // immediate count() snapshot, which would race the fetch and produce a
    // false skip.
    await gotoUrl(page, `${getBaseUrl()}/customer/withdrawal-request/new`);
    await expect(page.locator('[data-testid="customer-withdrawal-request-create-page"]')).toBeVisible({ timeout: 15000 });
    const proxyPicker = page.locator('[data-testid="customer-withdrawal-proxy-customer-select"]');
    const proxyPickerAppeared = await proxyPicker.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false);
    test.skip(!proxyPickerAppeared, 'Current account is not a request-proxy role — cannot select a customer here');

    // 1. Create the test rate.
    await gotoUrl(page, `${getBaseUrl()}/admin/product-service-rates`);
    await expect(page.locator('[data-testid="product-service-rates-page"]')).toBeVisible({ timeout: 20000 });

    await page.locator('[data-testid="add-service-rate-button"]').click();
    const customerSelect = page.locator('[data-testid="rate-form-customer-select"]');
    await customerSelect.selectOption({ index: 1 });
    const customerLabel = await customerSelect.locator('option:checked').innerText();

    // Service type must be set BEFORE picking the product/scope dropdown —
    // the "ทุกรายการ (all items)" option only renders once serviceType is
    // no longer 'STORAGE' (STORAGE is scoped by temperature category only).
    await page.locator('[data-testid="rate-form-service-type-input"]').fill('OVERTIME');

    const productSelect = page.locator('[data-testid="rate-form-product-select"]');
    await expect(productSelect.locator('option')).not.toHaveCount(1, { timeout: 10000 });
    await productSelect.selectOption({ label: '— ทุกรายการ (ทุกอุณหภูมิ) —' });

    await page.locator('[data-testid="rate-form-rate-input"]').fill('150');
    await page.locator('[data-testid="rate-form-unit-basis-select"]').selectOption('PER_HOUR');
    await page.locator('label:has-text("หมายเหตุ") input.form-control').last().fill(TEST_NOTE);
    await page.locator('[data-testid="rate-form-save-button"]').click();
    await expect(page.locator('.banner-danger')).toHaveCount(0);
    await expect(page.getByText(TEST_NOTE)).toBeVisible({ timeout: 10000 });

    try {
      // 2. Confirm it appears as an aux-service checkbox for that same customer
      //    on the withdrawal create page.
      await gotoUrl(page, `${getBaseUrl()}/customer/withdrawal-request/new`);
      await expect(page.locator('[data-testid="customer-withdrawal-request-create-page"]')).toBeVisible({ timeout: 15000 });

      // Match by the customer's own name text rather than id, since the two
      // pickers list customers in different orders/formats. selectOption's
      // label matcher requires an exact string (no RegExp support), so
      // resolve the matching <option>'s value directly instead.
      const customerName = customerLabel.split('—').pop().trim();
      const proxySelect = page.locator('[data-testid="customer-withdrawal-proxy-customer-select"]');
      const matchingOptionValue = await proxySelect
        .locator('option', { hasText: customerName })
        .first()
        .getAttribute('value');
      expect(matchingOptionValue).toBeTruthy();
      await proxySelect.selectOption(matchingOptionValue);

      const auxSection = page.locator('[data-testid="customer-withdrawal-aux-services-section"]');
      await expect(auxSection).toBeVisible({ timeout: 10000 });
      await expect(auxSection).toContainText(TEST_NOTE);
      await expect(auxSection).toContainText('150.00');
    } finally {
      // 3. Clean up — delete the test rate regardless of what happened above.
      //
      // IMPORTANT lesson from two earlier broken versions of this cleanup:
      // do NOT reload/navigate immediately after clicking delete. A page
      // reload aborts any in-flight network request in the browser — if the
      // delete RPC round-trip hadn't finished yet, reloading right after the
      // click cancels it before the server ever processes it. The row then
      // vanishes from the CURRENT view (stale local React state) and a
      // same-page toHaveCount(0) check passes, but the row was never
      // actually deleted — confirmed twice by direct DB queries after this
      // test reported green. Fix: wait for the row to disappear from the
      // table via a real auto-retrying assertion on the SAME page (proving
      // the app's own post-delete loadRates() re-fetch confirmed it) BEFORE
      // ever navigating/reloading again.
      await gotoUrl(page, `${getBaseUrl()}/admin/product-service-rates`);
      await expect(page.locator('[data-testid="product-service-rates-page"]')).toBeVisible({ timeout: 20000 });
      const testRow = page.locator('[data-testid="storage-rate-table"] tr', { hasText: TEST_NOTE });
      if ((await testRow.count()) > 0) {
        page.once('dialog', (dialog) => dialog.accept());
        await testRow.first().getByRole('button', { name: 'ลบ' }).click();
        await expect(page.locator('.banner-danger')).toHaveCount(0);
        await expect(testRow).toHaveCount(0, { timeout: 15000 });
      }
      // Only now confirm against a truly fresh fetch.
      await page.reload();
      await expect(page.locator('[data-testid="product-service-rates-page"]')).toBeVisible({ timeout: 20000 });
      await expect(page.locator('[data-testid="storage-rate-table"] tr', { hasText: TEST_NOTE })).toHaveCount(0);
    }
  });
});
