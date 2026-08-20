import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';
import { waitForAuthenticatedSidebar, readProfileRole } from './helpers/billingAccess.js';
import { callRpc, queryTable } from './helpers/supabaseApi.js';

requireUatCredentials();

// Real reported discrepancy: OVO Foodtech, temperature=FROZEN, as of
// 2026-08-20. Movement Ledger showed 34,172 boxes / 341,574.57 kg via its
// lot_no-grouped fallback total (used whenever a temperature/product/lot/
// tracking-code filter narrowed the view), while the Stock Balance page's
// RPC — correct because it matches per deposit line/tracking code rather
// than lot_no alone — showed 33,872 boxes / 338,574.57 kg for the same
// scope. Root cause: a single lot_no spanning multiple deposit lines
// (tracking codes), which lot_no-only grouping can't replicate. Fixed by
// having getAuthoritativeBalanceTotals call the RPC directly and filter its
// own rows client-side instead of re-deriving the balance a second way.
const AS_OF_DATE = '2026-08-20';

test.describe('Movement Ledger filtered TOTAL matches Stock Balance (temperature/lot/tracking-code filters)', () => {
  test('OVO + temperature=FROZEN TOTAL คงเหลือ equals the RPC, even though a lot spans multiple tracking codes', async ({ page }) => {
    await login(page);
    await waitForAuthenticatedSidebar(page);
    const role = await readProfileRole(page);
    test.skip(
      !['admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'viewer'].includes(role),
      `Current role (${role}) cannot read both the movement ledger and stock balance data`,
    );

    await gotoUrl(page, `${getBaseUrl()}/reports/movement-ledger`);

    const { data: customers, error: custError } = await queryTable(page, 'tgd_customers', 'name=ilike.*OVO*&select=id,name');
    expect(custError).toBeNull();
    test.skip(!Array.isArray(customers) || customers.length === 0, 'No OVO customer found in this environment');
    const ovoId = customers[0].id;

    // 1. Ground truth: the real RPC, filtered to FROZEN client-side exactly
    // the way getAuthoritativeBalanceTotals now does.
    const { data: balanceRows, error: rpcError } = await callRpc(page, 'tgd_get_customer_stock_balance', {
      p_customer_id: ovoId,
      p_as_of_date: AS_OF_DATE,
    });
    expect(rpcError).toBeNull();
    const frozenRows = (balanceRows ?? []).filter((r) => r.temperature_type === 'FROZEN');
    test.skip(frozenRows.length === 0, `No FROZEN stock balance data for OVO as of ${AS_OF_DATE}`);
    const expectedBoxes = frozenRows.reduce((s, r) => s + Number(r.balance_boxes ?? 0), 0);
    const expectedWeight = frozenRows.reduce((s, r) => s + Number(r.balance_weight ?? 0), 0);

    // Sanity: this scenario is only meaningful if a lot really does span more
    // than one deposit line/tracking code among the rows being summed —
    // otherwise the lot_no fallback this test guards against wouldn't have
    // diverged in the first place.
    const lotToTrackingCodes = new Map();
    for (const r of frozenRows) {
      const set = lotToTrackingCodes.get(r.lot_no) ?? new Set();
      set.add(r.tracking_code);
      lotToTrackingCodes.set(r.lot_no, set);
    }
    const hasMultiTrackingLot = [...lotToTrackingCodes.values()].some((set) => set.size > 1);
    test.skip(!hasMultiTrackingLot, 'No FROZEN lot for OVO currently spans multiple tracking codes — this scenario no longer reproduces the bug');

    // 2. Open Movement Ledger, select OVO + FROZEN + the same as-of date.
    await page.locator('select[name="customerId"]').selectOption(ovoId).catch(async () => {
      await page.locator('input[name="customerId"]').fill(ovoId);
    });
    await page.locator('input[name="dateTo"]').fill(AS_OF_DATE);

    const tempDropdown = page.locator('.form-group', { hasText: 'อุณหภูมิ' }).locator('button.form-control');
    await tempDropdown.click();
    await page.getByText('Frozen — แช่แข็ง', { exact: true }).click();
    await tempDropdown.click(); // close the dropdown

    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.locator('[data-testid="movement-ledger-table"]')).toBeVisible({ timeout: 20000 });

    // 3. Read the authoritative TOTAL from the print/preview template.
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
