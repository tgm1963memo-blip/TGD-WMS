import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';
import { waitForAuthenticatedSidebar, readProfileRole } from './helpers/billingAccess.js';
import { callRpc } from './helpers/supabaseApi.js';

requireUatCredentials();

// Real date this exact discrepancy was found and confirmed against
// (Movement Ledger showed 84,690 boxes / 689,526.35 kg vs the Stock
// Balance page's correct 83,514 boxes / 678,657.68 kg for the same
// customers/date, before the timeline-event date-classification fix).
const AS_OF_DATE = '2026-08-18';

test.describe('Movement Ledger TOTAL "คงเหลือ" matches Stock Balance at the same as-of date', () => {
  test('grand TOTAL คงเหลือ equals tgd_get_all_customer_stock_balances at the same as-of date', async ({ page }) => {
    await login(page);
    await waitForAuthenticatedSidebar(page);
    const role = await readProfileRole(page);
    test.skip(
      !['admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'viewer'].includes(role),
      `Current role (${role}) cannot read both the movement ledger and stock balance data`,
    );

    // 1. Ground truth: the same RPC the Stock Balance page itself uses,
    // called directly so this doesn't depend on that page's own UI.
    await gotoUrl(page, `${getBaseUrl()}/reports/movement-ledger`);
    const { data: balanceRows, error: rpcError } = await callRpc(page, 'tgd_get_all_customer_stock_balances', { p_as_of_date: AS_OF_DATE });
    expect(rpcError).toBeNull();
    test.skip(!Array.isArray(balanceRows) || balanceRows.length === 0, `No stock balance data as of ${AS_OF_DATE} to cross-check against — pick a date with real historical activity`);
    const expectedBoxes = balanceRows.reduce((s, r) => s + Number(r.balance_boxes ?? 0), 0);
    const expectedWeight = balanceRows.reduce((s, r) => s + Number(r.balance_weight ?? 0), 0);

    // 2. Open Movement Ledger, set End Date to the same as-of date, all
    // customers, no other narrowing filter (so the authoritative total path
    // is used — see canUseAuthoritativeTotals in MovementLedgerReportPage.jsx).
    await page.locator('input[name="dateTo"]').fill(AS_OF_DATE);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('[data-testid="movement-ledger-table"]')).toBeVisible({ timeout: 20000 });

    // 3. The on-screen table has no grand-total row — the authoritative
    // TOTAL only renders in the print/preview template's last page.
    await page.locator('[data-testid="operational-report-preview-action"]').click();
    const template = page.locator('[data-testid="inventory-movement-report-template"]');
    await expect(template).toBeVisible({ timeout: 20000 });

    const totalBoxesText = await page.locator('[data-testid="movement-ledger-total-balance-boxes"]').innerText();
    const totalWeightText = await page.locator('[data-testid="movement-ledger-total-balance-weight"]').innerText();
    const actualBoxes = Number(totalBoxesText.replace(/,/g, ''));
    const actualWeight = Number(totalWeightText.replace(/,/g, ''));

    expect(actualBoxes).toBe(expectedBoxes);
    expect(actualWeight).toBeCloseTo(expectedWeight, 2);
  });
});
