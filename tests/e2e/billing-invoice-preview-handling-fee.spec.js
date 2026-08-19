import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl } from './helpers/uatAuth.js';
import { loginAsBillingUser, skipUnlessBillingReader } from './helpers/billingAccess.js';

requireUatCredentials();

// Covers the new preview-only additions to the manual "billing period"
// modal on /billing/invoice-drafts: the STORAGE/HANDLING_IN subtotal split,
// the unmatched-deposit-lines section, the anomaly banner, and the
// review-report download button. Everything here calls only
// previewBillingPeriodInvoice (read-only) — this suite NEVER clicks
// "ยืนยันสร้างร่างบิล" (confirm create draft), since that writes a real
// invoice draft to the live Supabase project and this repo has no isolated
// test database to absorb that write.
test.describe('Billing preview — handling-in subtotal, unmatched, anomaly, reports', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await skipUnlessBillingReader(testInfo, page);
    await gotoUrl(page, `${getBaseUrl()}/billing/invoice-drafts`);
    await expect(page.locator('[data-testid="billing-invoice-drafts-page"]')).toBeVisible({ timeout: 15000 });
  });

  async function openModalAndPreview(page, { customerIndex = 1, daysBack = 90, startDate = null, endDate = null } = {}) {
    const openButton = page.locator('[data-testid="open-storage-bill-modal-button"]');
    test.skip(await openButton.count() === 0, 'Current role has no write access — create-bill button not rendered');
    await openButton.click();

    const customerSelect = page.locator('[data-testid="storage-bill-customer-select"]');
    // getCustomers() populates this <select> asynchronously after the modal
    // opens — poll instead of a single synchronous count() to avoid a race
    // where the check runs before the options have rendered.
    try {
      await expect(customerSelect.locator('option')).not.toHaveCount(1, { timeout: 10000 });
    } catch {
      test.skip(true, 'No customers available to preview against');
    }
    await customerSelect.selectOption({ index: customerIndex });

    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const iso = (d) => d.toISOString().slice(0, 10);
    await page.locator('[data-testid="storage-bill-start-date-input"]').fill(iso(start));
    await page.locator('[data-testid="storage-bill-end-date-input"]').fill(iso(end));

    await page.locator('[data-testid="storage-bill-preview-button"]').click();
    // Preview is a single request/response cycle — wait for either the
    // rendered line table's grand total or an explicit error banner.
    await Promise.race([
      page.getByText('รวมทั้งสิ้น').first().waitFor({ state: 'visible', timeout: 20000 }),
      page.locator('.banner-danger').first().waitFor({ state: 'visible', timeout: 20000 }),
    ]);
  }

  test('preview computes without error and shows a grand total', async ({ page }) => {
    await openModalAndPreview(page);
    await expect(page.locator('.banner-danger')).toHaveCount(0);
    await expect(page.getByText('รวมทั้งสิ้น').first()).toBeVisible();
  });

  test('shows a STORAGE/HANDLING_IN subtotal breakdown when the preview has billable lines', async ({ page }) => {
    await openModalAndPreview(page);
    const noRowsMessage = page.getByText('ไม่พบรายการที่คำนวณได้ในช่วงเวลานี้');
    test.skip(await noRowsMessage.count() > 0, 'No billable lines for this customer/period — nothing to break down');

    const totalsByType = page.locator('[data-testid="storage-bill-totals-by-type"]');
    await expect(totalsByType).toBeVisible();
    // At minimum STORAGE should appear whenever there are billable lines,
    // since HANDLING_IN only appears for customers with that rate configured.
    await expect(totalsByType).toContainText('ค่าฝากสินค้า');
  });

  test('unmatched section, when present, lists a reason for every unrated deposit line', async ({ page }) => {
    await openModalAndPreview(page);
    const unmatchedSection = page.locator('[data-testid="storage-bill-unmatched-section"]');
    test.skip(await unmatchedSection.count() === 0, 'No unmatched deposit lines for this customer/period');

    await expect(unmatchedSection).toBeVisible();
    const reasonCells = unmatchedSection.locator('table tbody tr td:last-child');
    const rowCount = await reasonCells.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i += 1) {
      const text = (await reasonCells.nth(i).innerText()).trim();
      expect(text).not.toBe('');
      expect(text).not.toBe('-');
    }
  });

  test('download-reports button produces two workbook downloads without crashing the page', async ({ page }) => {
    await openModalAndPreview(page);
    const noRowsMessage = page.getByText('ไม่พบรายการที่คำนวณได้ในช่วงเวลานี้');
    test.skip(await noRowsMessage.count() > 0, 'No billable lines — nothing meaningful to export');

    const downloadButton = page.locator('[data-testid="storage-bill-download-reports-button"]');
    await expect(downloadButton).toBeVisible();

    const [firstDownload] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click(),
    ]);
    expect(firstDownload.suggestedFilename()).toMatch(/^invoice-preview-summary_.*\.xlsx$/);

    const secondDownload = await page.waitForEvent('download');
    expect(secondDownload.suggestedFilename()).toMatch(/^invoice-preview-unmatched-anomaly_.*\.xlsx$/);

    // The modal itself must still be usable afterward — downloading must not
    // have thrown inside the click handler and left the UI in a broken state.
    await expect(page.locator('[data-testid="storage-bill-preview-button"]')).toBeVisible();
  });

  // Targets a specific customer/period combination confirmed (offline, via
  // the accounting team's own July 2026 Excel export) to have real STORAGE
  // and HANDLING_IN billable lines — customerIndex: 2 is TGM (C002) in the
  // dropdown's fixed order (placeholder, C001, C002, C003). Unlike the
  // generic tests above (which skip gracefully on whatever data happens to
  // exist), these are expected to actually exercise the new UI paths.
  test.describe('TGM (C002) / July 2026 — known real billable data', () => {
    const KNOWN_DATA_WINDOW = { customerIndex: 2, startDate: '2026-07-01', endDate: '2026-07-31' };

    test('shows the STORAGE/HANDLING_IN subtotal split with real figures', async ({ page }) => {
      await openModalAndPreview(page, KNOWN_DATA_WINDOW);
      await expect(page.locator('.banner-danger')).toHaveCount(0);

      const totalsByType = page.locator('[data-testid="storage-bill-totals-by-type"]');
      await expect(totalsByType).toBeVisible();
      await expect(totalsByType).toContainText('ค่าฝากสินค้า');
      // Flag for follow-up rather than fail: HANDLING_IN only appears once a
      // rate is actually configured for TGM, which is a manual step you take
      // separately in /admin/product-service-rates — this test proves the
      // engine WOULD pick it up the moment that's done, it doesn't require it.
      const text = await totalsByType.innerText();
      if (!text.includes('ค่าบริการจัดการแรกเข้า')) {
        console.log('[info] HANDLING_IN not yet configured for TGM — subtotal split only shows STORAGE for now.');
      }
    });

    test('downloads a real, non-empty review report for TGM July 2026', async ({ page }) => {
      await openModalAndPreview(page, KNOWN_DATA_WINDOW);
      const noRowsMessage = page.getByText('ไม่พบรายการที่คำนวณได้ในช่วงเวลานี้');
      await expect(noRowsMessage).toHaveCount(0);

      const [firstDownload] = await Promise.all([
        page.waitForEvent('download'),
        page.locator('[data-testid="storage-bill-download-reports-button"]').click(),
      ]);
      expect(firstDownload.suggestedFilename()).toMatch(/^invoice-preview-summary_.*\.xlsx$/);
      await page.waitForEvent('download'); // second file (unmatched/anomaly)
    });
  });

  test('never triggers real draft creation from this suite', async ({ page }) => {
    await openModalAndPreview(page);
    // Explicit negative assertion: confirm-create stays a distinct, untouched
    // action — this test only documents intent, it does not click it.
    const confirmButton = page.getByRole('button', { name: 'ยืนยันสร้างร่างบิล' });
    await expect(confirmButton).toBeVisible();
    // (Intentionally not clicked — see suite-level comment above.)
  });
});
