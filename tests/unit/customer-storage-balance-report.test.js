import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6C customer storage balance report foundation', () => {
  const servicePath = 'src/services/customerStorageBalanceReportService.js';
  const reportUiFiles = [
    'src/features/reports/CustomerStorageBalanceReportPage.jsx',
    'src/features/reports/ReportsPage.jsx',
    'src/components/reports/CustomerStorageBalanceTable.jsx',
    'src/components/reports/CustomerStorageSummaryCard.jsx',
    'src/app/routes.jsx',
  ];

  const forbiddenPostingTerms = [
    'tgd_post_inventory_movement',
    'tgd_post_receiving_document',
    'tgd_post_putaway_document',
    'tgd_post_transfer_document',
    'tgd_post_adjustment_document',
    'tgd_post_withdrawal_allocation',
    'tgd_confirm_picking_document',
    'tgd_post_dispatch_document',
    'tgd_complete_stock_count_document',
    'tgd_create_adjustment_from_stock_count',
  ];

  it('keeps the customer storage balance service available and read-only, sourced from the live balance (not tgd_stock_balances)', () => {
    const source = readProjectFile(servicePath);

    expect(statSync(resolve(projectRoot, servicePath)).isFile()).toBe(true);
    [
      'getCustomerStorageBalanceRows',
      'getCustomerStorageBalanceSummary',
      'getStorageBalanceByCustomer',
      'getStorageBalanceByProduct',
      'getStorageBalanceByLot',
    ].forEach((functionName) => {
      expect(source).toContain(functionName);
    });

    // Sourced from the same live, freshly-computed balance the "ยอดคงเหลือ"
    // pages use — not the separately-maintained tgd_stock_balances ledger,
    // which is what previously made this report disagree with ยอดคงเหลือ.
    expect(source).toContain('getAllCustomerStockBalances');
    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(source).not.toContain('.rpc(');
    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('creates the customer storage balance report page and report components', () => {
    [
      'src/features/reports/CustomerStorageBalanceReportPage.jsx',
      'src/components/reports/CustomerStorageBalanceTable.jsx',
      'src/components/reports/CustomerStorageSummaryCard.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('links and routes the customer storage balance report', () => {
    const reportsSource = readProjectFile('src/features/reports/ReportsPage.jsx');
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(reportsSource).toContain('Customer Storage Balance Report');
    expect(reportsSource).toContain('/reports/customer-storage-balance');
    expect(routesSource).toContain('/reports/customer-storage-balance');
    expect(routesSource).toContain('CustomerStorageBalanceReportPage');
  });

  it('renders cold storage balance report sections, summary cards, and table columns', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    [
      'cold storage',
      'customer-owned inventory',
      'Total Customers',
      'Total Products / SKUs',
      'Total Lots',
      'Total Stock Qty (Boxes)',
      'Total Stock Weight (kg)',
      'Customer Storage Balance Table',
      'Customer Summary',
      'Lot Summary',
      'Customer',
      'Product',
      'Lot',
      'Stock Qty (Boxes)',
      'Stock Weight (kg)',
      'UOM',
      'Received',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('keeps report UI free of posting, stock writes, billing engine, file output, and disallowed terminology', () => {
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
      'billing engine',
      'invoice generation',
      'export file generation',
      'writeFile',
      'createWriteStream',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, policy, legacy, or Express sync artifacts for this sprint', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/024_customer_storage_balance_report.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/004_customer_storage_balance_report.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
  });
});
