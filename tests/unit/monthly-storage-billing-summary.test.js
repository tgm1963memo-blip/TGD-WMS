import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6F monthly storage billing summary foundation', () => {
  const servicePath = 'src/services/monthlyStorageBillingSummaryService.js';
  const reportUiFiles = [
    'src/features/reports/MonthlyStorageBillingSummaryPage.jsx',
    'src/features/reports/ReportsPage.jsx',
    'src/components/reports/MonthlyBillingSummaryTable.jsx',
    'src/components/reports/BillingValidationWarningPanel.jsx',
    'src/components/reports/OperationChargePreviewTable.jsx',
    'src/components/reports/AccountingHandoffNote.jsx',
    'src/app/routes.jsx',
  ];

  const forbiddenPostingTerms = [
    'tgd_post_inventory_movement',
    'tgd_post_receiving_document',
    'tgd_post_putaway_document',
    'tgd_post_transfer_document',
    'tgd_post_adjustment_document',
    'tgd_post_withdrawal_allocation',
    'tgd_confirm_withdrawal_request',
    'tgd_confirm_picking_document',
    'tgd_post_dispatch_document',
    'tgd_complete_stock_count_document',
    'tgd_create_adjustment_from_stock_count',
  ];

  it('creates the monthly storage billing summary page and components', () => {
    [
      'src/features/reports/MonthlyStorageBillingSummaryPage.jsx',
      'src/components/reports/MonthlyBillingSummaryTable.jsx',
      'src/components/reports/BillingValidationWarningPanel.jsx',
      'src/components/reports/OperationChargePreviewTable.jsx',
      'src/components/reports/AccountingHandoffNote.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('keeps the monthly storage billing summary service preview-only', () => {
    const source = readProjectFile(servicePath);

    expect(statSync(resolve(projectRoot, servicePath)).isFile()).toBe(true);
    [
      'getMonthlyStorageBillingPreview',
      'getCustomerBillingSummaryPreview',
      'combineStorageAndOperationCharges',
      'validateBillingPreviewRows',
      'summarizeBillingPreviewRows',
      'classifyBillingValidationStatus',
    ].forEach((functionName) => {
      expect(source).toContain(functionName);
    });

    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(source).not.toContain('.rpc(');
    [
      'invoice generation',
      'billing finalization',
      'period lock',
      'accounting post',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('links and routes the monthly storage billing summary report', () => {
    const reportsSource = readProjectFile('src/features/reports/ReportsPage.jsx');
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(reportsSource).toContain('Monthly Storage Billing Summary');
    expect(reportsSource).toContain('/reports/monthly-storage-billing-summary');
    expect(routesSource).toContain('/reports/monthly-storage-billing-summary');
    expect(routesSource).toContain('MonthlyStorageBillingSummaryPage');
  });

  it('renders cold storage monthly summary sections, cards, and table columns', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    [
      'cold storage',
      'Monthly Storage Billing Summary',
      'customer-owned inventory',
      'accounting review',
      'Total Customers',
      'Total Deposit / Inbound Qty',
      'Total Withdrawal / Outbound Qty',
      'Total Remaining Qty',
      'Estimated Chargeable Weight / Qty',
      'Operation Charge Activity Count',
      'Rows Missing Rate',
      'Rows Missing Weight',
      'Rows Requiring Accounting Review',
      'Monthly Billing Summary Table',
      'Operation Charge Preview Section',
      'Missing Data / Validation Warning Section',
      'Accounting Handoff Note',
      'Billing Period',
      'Customer',
      'Warehouse',
      'Deposit / Inbound Qty',
      'Withdrawal / Outbound Qty',
      'Remaining Qty',
      'Average Storage Qty',
      'Chargeable Weight / Qty',
      'Storage Rate',
      'Operation Charge Preview',
      'Estimated Amount',
      'Validation Status',
      'Accounting Note',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('keeps report UI free of posting, stock writes, billing actions, file output, and disallowed terminology', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });

    [
      'Sales Order',
      'sales order',
      'sales invoice',
      'sales revenue',
      'sales margin',
      'order fulfillment',
      'outbound_orders',
      'tgd_outbound_orders',
      'Generate Invoice',
      'Finalize Billing',
      'Lock Period',
      'Post Accounting',
      'Create Export File',
      'Send To Accounting',
      'writeFile',
      'createWriteStream',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, policy, legacy, or Express sync artifacts for this sprint', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/027_monthly_storage_billing_summary.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/007_monthly_storage_billing_summary.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
  });
});
