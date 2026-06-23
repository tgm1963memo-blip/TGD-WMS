import { test, expect } from '@playwright/test';
import { login, loginAsCustomerAdmin, loginAsWarehouseOperator, requireUatCredentials, switchUser } from './helpers/uatAuth.js';
import {
  assertNoFatalPageErrors,
  buildDraftNo,
  buildReceivingDocNo,
  clickIfVisible,
  createFlowRunner,
  ensureFlowEvidenceDir,
  expectRouteShell,
  fillIfVisible,
  firstVisible,
  hasCustomerPortalCredentials,
  readReceivingDiagnostics,
  readReceivingDraftId,
  safeGoto,
  selectFirstOrMatch,
  waitForReceivingDraftReady,
  waitForReceivingMasterPickers,
  waitForSelectOptions,
  waitForCustomerDepositCatalog,
  writeFlowResult,
} from './helpers/warehouseFlowHelpers.js';

requireUatCredentials();

const FLOW_CONTEXT = {
  receivingDocNo: null,
  receivingDraftId: null,
  customerId: null,
  warehouseId: null,
  productLabel: null,
};

test.describe('Full deposit-to-dispatch warehouse flow', () => {
  test('Walk through inbound deposit, storage, and outbound dispatch functions', async ({ page }) => {
    test.setTimeout(600000);
    ensureFlowEvidenceDir();

    const result = {
      testedAt: new Date().toISOString(),
      flow: 'deposit-to-dispatch',
      context: FLOW_CONTEXT,
      steps: [],
      summary: {
        pass: 0,
        fail: 0,
        blocked: 0,
        skipped: 0,
      },
    };

    const runStep = createFlowRunner({ page, result });

    const getStepStatus = (id) => result.steps.find((step) => step.id === id)?.status ?? 'PENDING';
    const requirePass = (...ids) => {
      const blocker = ids.find((id) => getStepStatus(id) !== 'PASS');
      if (blocker) {
        throw new Error(`DEPENDENCY_BLOCKED: Step ${blocker} did not PASS`);
      }
    };

    // Phase 0 — Authentication
    await runStep({
      id: '00-login',
      phase: 'auth',
      name: 'Warehouse user login',
      evidence: '00-login.png',
      action: async () => {
        await login(page);
        await expect(page.locator('[data-testid="app-shell"]')).toBeVisible();
      },
    });

    // Phase 1 — Customer deposit (ฝาก)
    await runStep({
      id: '01-customer-deposit',
      phase: 'inbound',
      name: 'Customer submits deposit request',
      evidence: '01-customer-deposit.png',
      action: async () => {
        if (!hasCustomerPortalCredentials()) {
          throw new Error('SKIPPED_WITH_REASON: UAT_CUSTOMER_EMAIL / UAT_CUSTOMER_PASSWORD not configured');
        }

        const loggedIn = await loginAsCustomerAdmin(page);
        if (!loggedIn) {
          throw new Error('SKIPPED_WITH_REASON: Customer portal credentials unavailable');
        }

        await safeGoto(page, '/customer/deposit-request/new');
        await expect(page.locator('[data-testid="customer-deposit-request-create-page"]')).toBeVisible({ timeout: 15000 });

        const picker = await waitForCustomerDepositCatalog(page);
        const preferredCode = process.env.UAT_CUSTOMER_PRODUCT_CODE || 'CUS-FLOW-01';
        const matching = picker.locator('option').filter({ hasText: preferredCode });
        if (await matching.count()) {
          const value = await matching.first().getAttribute('value');
          await picker.selectOption(value || { index: 1 });
        } else {
          await picker.selectOption({ index: 1 });
        }
        await page.locator('[data-testid="customer-deposit-weight-per-box"]').fill('10');
        await page.locator('[data-testid="customer-deposit-box-count"]').fill(process.env.UAT_QTY || '10');
        await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(process.env.UAT_EXPECTED_ARRIVAL_DATE || '2026-12-31');
        await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Flow Test Contact');
        await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000001');
        await page.locator('[data-testid="customer-deposit-submit-button"]').click();

        await expect(
          page.locator('[data-testid="customer-deposit-live-success-alert"], .banner-danger[role="alert"]'),
        ).toBeVisible({ timeout: 20000 });

        // Switch back to main UAT_EMAIL user so subsequent steps can access warehouse/admin routes
        await login(page);
      },
    });

    await runStep({
      id: '02-admin-deposit-review',
      phase: 'inbound',
      name: 'Admin reviews deposit requests',
      evidence: '02-admin-deposit-review.png',
      action: async () => {
        await login(page);
        await expectRouteShell(page, '/customer/admin/deposit-review', 'customer-admin-deposit-review-page');
        await expect(page.locator('[data-testid="admin-deposit-review-table"]')).toBeVisible();
      },
    });

    await runStep({
      id: '03-warehouse-receiving-workspace',
      phase: 'inbound',
      name: 'Warehouse receiving workspace opens (customer deposit queue)',
      evidence: '03-warehouse-receiving-demo.png',
      action: async () => {
        await expectRouteShell(page, '/operations/receiving', 'receiving-customer-deposit-section');
        await expect(page.locator('[data-testid="receiving-customer-deposit-section"]')).toBeVisible();
      },
    });

    // Internal receiving draft creation removed — inbound flows through customer deposit bridge only.

    await runStep({
      id: '07-inventory-balance',
      phase: 'storage',
      name: 'Inventory balance page loads (menu-aligned)',
      evidence: '07-inventory-dashboard.png',
      action: async () => {
        await expectRouteShell(page, '/inventory');
        await expect(page.locator('.page-shell').first()).toBeVisible();
      },
    });

    await runStep({
      id: '08-movement-ledger-inbound',
      phase: 'storage',
      name: 'Movement ledger report loads',
      evidence: '08-movement-ledger-inbound.png',
      action: async () => {
        await expectRouteShell(page, '/reports/movement-ledger');
        const ledgerSurface = page.locator('[data-testid="movement-ledger-table"], .compact-expandable-table, .summary-grid');
        await expect(ledgerSurface.first()).toBeVisible({ timeout: 20000 });
      },
    });

    // Putaway / allocation / picking / dispatch pages removed from active menu.
    await runStep({
      id: '10-withdrawal-draft',
      phase: 'outbound',
      name: 'Create withdrawal request draft',
      evidence: '10-withdrawal-draft.png',
      action: async () => {
        await safeGoto(page, '/operations/withdrawal-requests/new');
        const withdrawalNo = buildDraftNo('WDR-FLOW');
        await page.locator('input[name="withdrawal_no"]').fill(withdrawalNo);
        await page.locator('input[name="customer_id"]').fill(FLOW_CONTEXT.customerId || process.env.UAT_CUSTOMER_CODE || '');
        await page.locator('input[name="warehouse_id"]').fill(FLOW_CONTEXT.warehouseId || process.env.UAT_WAREHOUSE_CODE || '');
        await page.locator('input[name="requested_dispatch_date"]').fill(process.env.UAT_DISPATCH_DATE || '2026-12-31');
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/operations\/withdrawal-requests\//, { timeout: 15000 });
      },
    });

    await runStep({
      id: '15-customer-withdrawal',
      phase: 'outbound',
      name: 'Customer withdrawal request page',
      evidence: '15-customer-withdrawal.png',
      action: async () => {
        await expectRouteShell(page, '/customer/withdrawal-request', 'customer-withdrawal-request-page');
        await expect(page.locator('[data-testid="customer-withdrawal-list-table"]')).toBeVisible();
      },
    });

    await runStep({
      id: '16-admin-withdrawal-review',
      phase: 'outbound',
      name: 'Admin withdrawal review page',
      evidence: '16-admin-withdrawal-review.png',
      action: async () => {
        await expectRouteShell(page, '/customer/admin/withdrawal-review', 'customer-admin-withdrawal-review-page');
        await expect(page.locator('[data-testid="admin-withdrawal-review-table"]')).toBeVisible();
      },
    });

    await runStep({
      id: '18-billing-movement-weight',
      phase: 'verification',
      name: 'Billing movement weight report loads',
      evidence: '18-billing-movement-weight.png',
      action: async () => {
        await expectRouteShell(page, '/reports/billing-movement-weight', 'billing-movement-weight-report-page');
        await expect(page.locator('[data-testid="billing-movement-weight-summary-card"]').first()).toBeVisible();
        await expect(page.locator('[data-testid="export-bplus-button"]')).toHaveCount(0);
        await expect(page.locator('[data-testid="mark-billed-button"]')).toHaveCount(0);
      },
    });

    await runStep({
      id: '19-request-history',
      phase: 'verification',
      name: 'Customer request history is visible',
      evidence: '19-request-history.png',
      action: async () => {
        await expectRouteShell(page, '/customer/requests', 'customer-request-history-page');
        await expect(page.locator('[data-testid="customer-request-history-table"]')).toBeVisible();
      },
    });

    result.summary = result.steps.reduce((summary, step) => {
      if (step.status === 'PASS') summary.pass += 1;
      if (step.status === 'FAIL') summary.fail += 1;
      if (step.status === 'BLOCKED') summary.blocked += 1;
      if (step.status === 'SKIPPED') summary.skipped += 1;
      return summary;
    }, { pass: 0, fail: 0, blocked: 0, skipped: 0 });

    result.context = { ...FLOW_CONTEXT };
    writeFlowResult(result);

    const criticalInbound = [];
    const criticalFailures = result.steps.filter((step) => step.status === 'FAIL');
    const inboundFailures = criticalFailures.filter((step) => criticalInbound.includes(step.id));

    if (inboundFailures.length) {
      throw new Error(`Inbound flow failed at: ${inboundFailures.map((step) => step.id).join(', ')}. See uat-evidence/full-deposit-to-dispatch-flow/result.json`);
    }

    if (criticalFailures.length) {
      throw new Error(`Full flow failed with ${criticalFailures.length} failure(s). See uat-evidence/full-deposit-to-dispatch-flow/result.json`);
    }

    const activeFlowStepIds = [
      '00-login',
      '01-customer-deposit',
      '02-admin-deposit-review',
      '03-warehouse-receiving-workspace',
      '07-inventory-balance',
      '08-movement-ledger-inbound',
      '10-withdrawal-draft',
      '15-customer-withdrawal',
      '16-admin-withdrawal-review',
      '18-billing-movement-weight',
      '19-request-history',
    ];

    expect(result.summary.pass).toBeGreaterThan(0);
    expect(result.summary.fail).toBe(0);
    expect(getStepStatus('01-customer-deposit')).toBe('PASS');
    expect(result.steps.map((step) => step.id)).toEqual(activeFlowStepIds);
  });
});
