import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6B movement ledger report foundation', () => {
  const servicePath = 'src/services/movementLedgerReportService.js';
  const reportUiFiles = [
    'src/features/reports/ReportsPage.jsx',
    'src/features/reports/MovementLedgerReportPage.jsx',
    'src/components/reports/ReportFilterPanel.jsx',
    'src/components/reports/ReportSummaryCard.jsx',
    'src/components/reports/MovementTypeBreakdown.jsx',
    'src/components/reports/MovementLedgerTable.jsx',
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

  it('creates the movement ledger report service and read-only functions', () => {
    const source = readProjectFile(servicePath);

    expect(statSync(resolve(projectRoot, servicePath)).isFile()).toBe(true);
    [
      'getMovementLedgerRows',
      'getMovementLedgerSummary',
      'getMovementTypeBreakdown',
      'getMovementByReference',
    ].forEach((functionName) => {
      expect(source).toContain(functionName);
    });
  });

  it('keeps the movement ledger report service read-only', () => {
    const source = readProjectFile(servicePath);

    expect(source).toContain('unifiedMovementReadService.js');
    expect(source).toContain('getUnifiedMovementRows');
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    // getAuthoritativeBalanceTotals calls tgd_get_customer_stock_balance /
    // tgd_get_all_customer_stock_balances directly — the same `stable`,
    // read-only RPCs the stock balance page itself calls
    // (InventoryBalancePage.jsx) — instead of reimplementing their FIFO/
    // exact-match algorithm a second time in JS, so a bare `.rpc(` ban is no
    // longer the right guard; forbiddenPostingTerms below still catches any
    // actual posting/mutation RPC.
    expect(source).not.toMatch(/\.rpc\(\s*['"]tgd_post_|\.rpc\(\s*['"]tgd_confirm_|\.rpc\(\s*['"]tgd_complete_|\.rpc\(\s*['"]tgd_create_adjustment/);

    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('creates report page and report components', () => {
    [
      'src/features/reports/MovementLedgerReportPage.jsx',
      'src/features/reports/ReportsPage.jsx',
      'src/components/reports/ReportFilterPanel.jsx',
      'src/components/reports/ReportSummaryCard.jsx',
      'src/components/reports/MovementTypeBreakdown.jsx',
      'src/components/reports/MovementLedgerTable.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes the movement ledger report', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(routesSource).toContain('/reports');
    expect(routesSource).toContain('/reports/movement-ledger');
    expect(routesSource).toContain('MovementLedgerReportPage');
  });

  it('renders report filters, ledger table, and print actions when data is available', () => {
    const source = readProjectFile('src/features/reports/MovementLedgerReportPage.jsx');

    [
      'ReportFilterPanel',
      'MovementLedgerTable',
      'ReportPrintActions',
      'movement_ledger_report',
      'movement_ledger',
      'Entry-Delivery Inventory Report',
      'getConfirmedDepositReceiptRows',
      'getConfirmedWithdrawalRows',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  // Regression coverage: a real product code search that returned nothing
  // despite the deposit/withdrawal existing, because the "สินค้า" dropdown
  // only lists products already registered in the internal product master
  // (tgd_products) - this direct text search bypasses that dependency
  // entirely, both server-side (movementLedgerReportService.js) and in the
  // page's own client-side filter.
  it('supports searching by the row\'s own product code, independent of the product master dropdown', () => {
    const pageSource = readProjectFile('src/features/reports/MovementLedgerReportPage.jsx');
    const panelSource = readProjectFile('src/components/reports/ReportFilterPanel.jsx');
    const serviceSource = readProjectFile(servicePath);

    expect(panelSource).toContain('showProductCode');
    expect(pageSource).toContain('showProductCode={true}');
    expect(pageSource).toContain('committedFilters.productCode');
    expect(serviceSource).toContain('filters.productCode');
  });

  it('keeps report UI free of posting, stock writes, actions, export engine, and disallowed terminology', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });

    [
      'sales revenue',
      'sales margin',
      'sales invoice',
      'invoice value',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/021_movement_ledger_report.sql'))).toBe(false);
  });
});
