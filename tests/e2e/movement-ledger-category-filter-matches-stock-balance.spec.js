import { test, expect } from '@playwright/test';
import { getBaseUrl, requireUatCredentials, gotoUrl, login } from './helpers/uatAuth.js';
import { waitForAuthenticatedSidebar, readProfileRole } from './helpers/billingAccess.js';
import { callRpc, queryTable } from './helpers/supabaseApi.js';

requireUatCredentials();

// Real reported discrepancy: TGM (C002), filtering by product category
// (FG/RM) as of 2026-08-31, showed a different TOTAL "คงเหลือ" on the
// Movement Ledger report than on the Stock Balance page. Root cause: the
// movement ledger's authoritative-totals path (getAuthoritativeBalanceTotals)
// didn't resolve productCategory at all, so canUseAuthoritativeTotals bailed
// out to the old lot_no-grouped fallback whenever a category filter was
// active — the same class of bug already fixed for temperature/lot/
// tracking-code filters earlier. Real TGM data has 51 "Raw material" and 41
// "Finished Goods" lots spanning multiple tracking codes (deposit lines),
// exactly the shape lot_no-only grouping can't replicate correctly.
const AS_OF_DATE = '2026-08-31';
const CATEGORIES = ['Raw material', 'Finished Goods'];

test.describe('Movement Ledger filtered by product category matches Stock Balance', () => {
  for (const category of CATEGORIES) {
    test(`TGM + category="${category}" TOTAL คงเหลือ equals the RPC as of ${AS_OF_DATE}`, async ({ page }) => {
      await login(page);
      await waitForAuthenticatedSidebar(page);
      const role = await readProfileRole(page);
      test.skip(
        !['admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff', 'viewer'].includes(role),
        `Current role (${role}) cannot read both the movement ledger and stock balance data`,
      );

      await gotoUrl(page, `${getBaseUrl()}/reports/movement-ledger`);

      const { data: customers, error: custError } = await queryTable(page, 'tgd_customers', 'customer_code=eq.C002&select=id,name');
      expect(custError).toBeNull();
      test.skip(!Array.isArray(customers) || customers.length === 0, 'TGM (C002) not found in this environment');
      const tgmId = customers[0].id;

      // 1. Ground truth: the real RPC, filtered to this category client-side
      // exactly the way getAuthoritativeBalanceTotals now does.
      const { data: balanceRows, error: rpcError } = await callRpc(page, 'tgd_get_customer_stock_balance', {
        p_customer_id: tgmId,
        p_as_of_date: AS_OF_DATE,
      });
      expect(rpcError).toBeNull();
      const { data: catalogRows, error: catalogError } = await queryTable(
        page, 'tgd_customer_products', `customer_id=eq.${tgmId}&select=customer_product_code,product_category`,
      );
      expect(catalogError).toBeNull();
      const categoryMap = new Map((catalogRows ?? []).map((c) => [c.customer_product_code, c.product_category]));
      const filteredRows = (balanceRows ?? []).filter((r) => categoryMap.get(r.customer_product_code) === category);
      test.skip(filteredRows.length === 0, `No stock balance data for TGM/${category} as of ${AS_OF_DATE}`);
      const expectedBoxes = filteredRows.reduce((s, r) => s + Number(r.balance_boxes ?? 0), 0);
      const expectedWeight = filteredRows.reduce((s, r) => s + Number(r.balance_weight ?? 0), 0);

      // 2. Open Movement Ledger, select TGM + this category + the same as-of date.
      const customerSelect = page.locator('select[name="customerId"]');
      await customerSelect.selectOption(tgmId).catch(async () => {
        await page.locator('input[name="customerId"]').fill(tgmId);
      });
      await page.locator('input[name="dateTo"]').fill(AS_OF_DATE);

      const categoryDropdown = page.locator('.form-group', { hasText: 'ประเภทสินค้า' }).locator('button.form-control');
      await categoryDropdown.click();
      await page.getByText(category, { exact: true }).click();
      await categoryDropdown.click(); // close the dropdown

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
  }
});
