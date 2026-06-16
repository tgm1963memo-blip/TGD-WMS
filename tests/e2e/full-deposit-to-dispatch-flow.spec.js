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

        await safeGoto(page, '/customer/deposit-request');
        await expect(page.locator('[data-testid="customer-deposit-request-page"]')).toBeVisible({ timeout: 15000 });

        const picker = page.locator('[data-testid="customer-deposit-product-picker-select"]');
        if (await picker.isVisible({ timeout: 3000 }).catch(() => false)) {
          await picker.selectOption({ index: 1 });
        } else {
          await page.locator('[data-testid="customer-product-code-input"]').fill(process.env.UAT_CUSTOMER_PRODUCT_CODE || 'CUS-FLOW-01');
          await page.locator('[data-testid="customer-deposit-product-code"]').fill(process.env.UAT_PRODUCT_CODE || 'FRZ-FLOW-01');
          await page.locator('[data-testid="customer-deposit-product-name"]').fill(process.env.UAT_PRODUCT_NAME || 'Flow Test Product');
        }
        await page.locator('[data-testid="customer-deposit-qty"]').fill(process.env.UAT_QTY || '10');
        await page.locator('[data-testid="customer-deposit-expected-arrival-date"]').fill(process.env.UAT_EXPECTED_ARRIVAL_DATE || '2026-12-31');
        await page.locator('[data-testid="customer-deposit-contact-name"]').fill('Flow Test Contact');
        await page.locator('[data-testid="customer-deposit-contact-phone"]').fill('0800000001');
        await page.locator('[data-testid="customer-deposit-submit-button"]').click();

        await expect(
          page.locator('[data-testid="customer-deposit-live-success-alert"], .banner-danger[role="alert"]'),
        ).toBeVisible({ timeout: 20000 });

        await switchUser(page);
      },
    });

    await runStep({
      id: '02-admin-deposit-review',
      phase: 'inbound',
      name: 'Admin reviews deposit requests',
      evidence: '02-admin-deposit-review.png',
      action: async () => {
        await expectRouteShell(page, '/customer/admin/deposit-review', 'customer-admin-deposit-review-page');
        await expect(page.locator('[data-testid="admin-deposit-review-table"]')).toBeVisible();
      },
    });

    await runStep({
      id: '03-warehouse-receiving-demo',
      phase: 'inbound',
      name: 'Warehouse receiving workspace opens',
      evidence: '03-warehouse-receiving-demo.png',
      action: async () => {
        await expectRouteShell(page, '/customer/warehouse/receiving', 'customer-warehouse-receiving-page');
        await expect(page.locator('[data-testid="receiving-document-select"]')).toBeVisible();
        await expect(page.locator('[data-testid="receiving-post-button"]')).toHaveCount(0);
      },
    });

    // Phase 2 — Operations receiving (รับเข้าจริง)
    await runStep({
      id: '04-receiving-create-draft',
      phase: 'inbound',
      name: 'Create internal receiving draft',
      evidence: '04-receiving-create-draft.png',
      action: async () => {
        const switched = await loginAsWarehouseOperator(page);
        if (!switched) {
          throw new Error('BLOCKED: warehouse operator credentials required for receiving draft creation');
        }

        await safeGoto(page, '/operations/receiving/create');
        await waitForReceivingMasterPickers(page);

        FLOW_CONTEXT.receivingDocNo = buildReceivingDocNo();
        FLOW_CONTEXT.customerId = await selectFirstOrMatch(
          page,
          ['select[aria-label="Customer"]'],
          process.env.UAT_CUSTOMER_NAME || process.env.UAT_CUSTOMER_CODE || 'Demo Customer Alpha',
        );
        FLOW_CONTEXT.warehouseId = await selectFirstOrMatch(
          page,
          ['select[aria-label="Warehouse"]'],
          process.env.UAT_WAREHOUSE_NAME || process.env.UAT_WAREHOUSE_CODE,
        );
        await fillIfVisible(page, ['input[aria-label="Document No"]'], FLOW_CONTEXT.receivingDocNo);
        await clickIfVisible(page, ['button:has-text("Save Draft")']);
        await waitForReceivingDraftReady(page);

        const draftCreated = await firstVisible(page, ['[data-testid="receiving-draft-created"]', 'h3:has-text("Draft Created")']);
        if (draftCreated) {
          FLOW_CONTEXT.receivingDraftId = await readReceivingDraftId(page);
          return;
        }

        const diagnostics = await readReceivingDiagnostics(page);
        if (diagnostics.includes('DRAFT_ID_MISSING')) {
          throw new Error(`BLOCKED: DRAFT_ID_MISSING\n${diagnostics}`);
        }

        const rpcErrorLine = diagnostics.match(/Save draft RPC error:\s*([^\n]+)/)?.[1]?.trim();
        if (rpcErrorLine && rpcErrorLine !== 'None') {
          throw new Error(`FAIL: Save draft RPC error: ${rpcErrorLine}`);
        }

        const pageError = await page.locator('.alert-error-panel').first().textContent().catch(() => '');
        if (pageError?.trim()) {
          throw new Error(`FAIL: ${pageError.trim()}`);
        }

        throw new Error(`BLOCKED: Receiving draft was not created\n${diagnostics}`);
      },
    });

    await runStep({
      id: '05-receiving-add-line',
      phase: 'inbound',
      name: 'Add receiving line',
      evidence: '05-receiving-add-line.png',
      action: async () => {
        requirePass('04-receiving-create-draft');

        FLOW_CONTEXT.productLabel = await selectFirstOrMatch(
          page,
          ['select[aria-label="Product"]'],
          process.env.UAT_PRODUCT_NAME || process.env.UAT_PRODUCT_CODE,
        );
        await fillIfVisible(
          page,
          ['input[aria-label="Lot No"]', 'select[aria-label="Lot"]'],
          process.env.UAT_LOT_NO || `LOT-FLOW-${Date.now()}`,
        );
        await fillIfVisible(page, ['input[aria-label="Pallet No"]'], process.env.UAT_PALLET_NO || `PLT-FLOW-${Date.now()}`);
        await waitForSelectOptions(page, ['select[aria-label="Location"]']);
        await selectFirstOrMatch(
          page,
          ['select[aria-label="Location"]'],
          process.env.UAT_RECEIVING_LOCATION,
        );
        await fillIfVisible(page, ['input[aria-label="Quantity"]'], process.env.UAT_QTY || '1');
        await clickIfVisible(page, ['button:has-text("Add Line")']);
        await expect(page.locator('button:has-text("Confirm/Post Receiving")')).toBeVisible({ timeout: 10000 });
      },
    });

    await runStep({
      id: '06-receiving-confirm-post',
      phase: 'inbound',
      name: 'Confirm/post receiving',
      evidence: '06-receiving-confirm-post.png',
      action: async () => {
        requirePass('05-receiving-add-line');
        await clickIfVisible(page, ['button:has-text("Confirm/Post Receiving")']);
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
        await assertNoFatalPageErrors(page, '/operations/receiving/create');
      },
    });

    // Phase 3 — Storage visibility
    await runStep({
      id: '07-inventory-dashboard',
      phase: 'storage',
      name: 'Inventory dashboard reflects stock',
      evidence: '07-inventory-dashboard.png',
      action: async () => {
        requirePass('06-receiving-confirm-post');
        await expectRouteShell(page, '/dashboard/inventory');
        await expect(page.locator('.tgd-table, .kpi-grid').first()).toBeVisible();
      },
    });

    await runStep({
      id: '08-movement-ledger-inbound',
      phase: 'storage',
      name: 'Movement ledger shows inbound activity',
      evidence: '08-movement-ledger-inbound.png',
      action: async () => {
        requirePass('06-receiving-confirm-post');
        await expectRouteShell(page, '/reports/movement-ledger');
        await expect(page.locator('[data-testid="movement-ledger-table"], .compact-expandable-table').first()).toBeVisible();
        const tableText = await page.locator('[data-testid="movement-ledger-table"], .compact-expandable-table').first().innerText();
        if (!/RECEIVE|INBOUND|PUTAWAY/i.test(tableText) && !tableText.includes('Detail')) {
          throw new Error('BLOCKED: Movement ledger has no inbound movement rows yet');
        }
      },
    });

    await runStep({
      id: '09-putaway-draft',
      phase: 'storage',
      name: 'Create putaway draft from receiving',
      evidence: '09-putaway-draft.png',
      action: async () => {
        requirePass('04-receiving-create-draft');
        await safeGoto(page, '/operations/putaway/new');
        const putawayNo = buildDraftNo('PUT-FLOW');
        await page.locator('input[name="putaway_no"]').fill(putawayNo);
        await page.locator('input[name="customer_id"]').fill(FLOW_CONTEXT.customerId || process.env.UAT_CUSTOMER_CODE || '');
        await page.locator('input[name="warehouse_id"]').fill(FLOW_CONTEXT.warehouseId || process.env.UAT_WAREHOUSE_CODE || '');
        if (FLOW_CONTEXT.receivingDraftId) {
          await page.locator('input[name="source_id"]').fill(FLOW_CONTEXT.receivingDraftId);
        }
        await page.locator('button[type="submit"]').click();
        await page.waitForURL(/\/operations\/putaway\//, { timeout: 15000 });
        await assertNoFatalPageErrors(page, '/operations/putaway');
      },
    });

    // Phase 4 — Outbound request (เบิก)
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
      id: '11-allocation-page',
      phase: 'outbound',
      name: 'Allocation list is operational',
      evidence: '11-allocation-page.png',
      action: async () => {
        await expectRouteShell(page, '/operations/allocations');
        await expect(page.locator('.tgd-table').first()).toBeVisible();
      },
    });

    await runStep({
      id: '12-picking-page',
      phase: 'outbound',
      name: 'Picking list is operational',
      evidence: '12-picking-page.png',
      action: async () => {
        await expectRouteShell(page, '/operations/picking');
        await expect(page.locator('.tgd-table').first()).toBeVisible();
      },
    });

    await runStep({
      id: '13-dispatch-page',
      phase: 'outbound',
      name: 'Dispatch list is operational',
      evidence: '13-dispatch-page.png',
      action: async () => {
        await expectRouteShell(page, '/operations/dispatch');
        await expect(page.locator('.tgd-table').first()).toBeVisible();
        await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
      },
    });

    await runStep({
      id: '14-outbound-operations',
      phase: 'outbound',
      name: 'Outbound operations workspace opens',
      evidence: '14-outbound-operations.png',
      action: async () => {
        await expectRouteShell(page, '/operations/outbound');
        await expect(page.getByText('Outbound Documents')).toBeVisible();
      },
    });

    // Phase 5 — Customer outbound UX (จ่ายออก)
    await runStep({
      id: '15-customer-withdrawal',
      phase: 'outbound',
      name: 'Customer withdrawal request page',
      evidence: '15-customer-withdrawal.png',
      action: async () => {
        await expectRouteShell(page, '/customer/withdrawal-request', 'customer-withdrawal-request-page');
        await expect(page.locator('[data-testid="withdrawal-source-deposit-select"]')).toBeVisible();
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
      id: '17-picking-loading-demo',
      phase: 'outbound',
      name: 'Picking and loading confirmation demo',
      evidence: '17-picking-loading-demo.png',
      action: async () => {
        await expectRouteShell(page, '/customer/warehouse/picking-loading', 'customer-warehouse-picking-loading-page');
        await page.locator('[data-testid="pallet-barcode-input"]').fill(process.env.UAT_PALLET_NO || 'PLT-FLOW-001');
        await page.locator('[data-testid="box-barcode-input"]').fill('BOX-FLOW-001');
        await page.locator('[data-testid="confirm-picked-demo-button"]').click();
        await page.locator('[data-testid="confirm-loaded-demo-button"]').click();
        await expect(page.getByText(/No stock or dispatch record was changed/i)).toBeVisible();
        await expect(page.locator('[data-testid="dispatch-confirm-button"]')).toHaveCount(0);
      },
    });

    // Phase 6 — Reporting / audit trail
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

    const criticalInbound = ['04-receiving-create-draft', '05-receiving-add-line', '06-receiving-confirm-post'];
    const criticalFailures = result.steps.filter((step) => step.status === 'FAIL');
    const inboundFailures = criticalFailures.filter((step) => criticalInbound.includes(step.id));

    if (inboundFailures.length) {
      throw new Error(`Inbound flow failed at: ${inboundFailures.map((step) => step.id).join(', ')}. See uat-evidence/full-deposit-to-dispatch-flow/result.json`);
    }

    if (criticalFailures.length) {
      throw new Error(`Full flow failed with ${criticalFailures.length} failure(s). See uat-evidence/full-deposit-to-dispatch-flow/result.json`);
    }

    expect(result.summary.pass).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThanOrEqual(15);
  });
});
