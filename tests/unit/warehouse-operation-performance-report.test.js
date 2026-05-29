import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6E warehouse operation performance report foundation', () => {
  const servicePath = 'src/services/warehouseOperationPerformanceService.js';
  const reportUiFiles = [
    'src/features/reports/WarehouseOperationPerformanceReportPage.jsx',
    'src/features/reports/ReportsPage.jsx',
    'src/components/reports/WarehouseOperationPerformanceTable.jsx',
    'src/components/reports/OperationStatusBreakdown.jsx',
    'src/components/reports/OperationVolumeSummary.jsx',
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
    'tgd_confirm_withdrawal_request',
  ];

  it('creates the warehouse operation performance service with read-only functions', () => {
    const source = readProjectFile(servicePath);

    expect(statSync(resolve(projectRoot, servicePath)).isFile()).toBe(true);
    [
      'getOperationPerformanceRows',
      'getOperationPerformanceSummary',
      'getOperationVolumeByCustomer',
      'getOperationVolumeByWarehouse',
      'getOperationVolumeByType',
      'getOperationStatusBreakdown',
      'getPendingOperationSummary',
      'getOperationChargeActivityPreview',
    ].forEach((functionName) => {
      expect(source).toContain(functionName);
    });

    expect(source).toContain('.select(');
    expect(source).not.toMatch(/\.(insert|update|delete|upsert)\s*\(/);
    expect(source).not.toContain('.rpc(');
    forbiddenPostingTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('does not add workflow action calls to the performance service', () => {
    const source = readProjectFile(servicePath);

    [
      'confirmWithdrawalRequest(',
      'confirmPickingDocument(',
      'postDispatchDocument(',
      'postReceivingDocument(',
      'postPutawayDocument(',
      'postTransferDocument(',
      'postAdjustmentDocument(',
      'completeStockCountDocument(',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('creates the report page and report components', () => {
    [
      'src/features/reports/WarehouseOperationPerformanceReportPage.jsx',
      'src/components/reports/WarehouseOperationPerformanceTable.jsx',
      'src/components/reports/OperationStatusBreakdown.jsx',
      'src/components/reports/OperationVolumeSummary.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('links and routes the warehouse operation performance report', () => {
    const reportsSource = readProjectFile('src/features/reports/ReportsPage.jsx');
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(reportsSource).toContain('Warehouse Operation Performance Report');
    expect(reportsSource).toContain('/reports/warehouse-operation-performance');
    expect(routesSource).toContain('/reports/warehouse-operation-performance');
    expect(routesSource).toContain('WarehouseOperationPerformanceReportPage');
  });

  it('renders cold storage operation metrics, sections, and table columns', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    [
      'cold storage',
      'warehouse operation',
      'customer-owned inventory',
      'Total Operations',
      'Receiving Count',
      'Putaway Count',
      'Transfer Count',
      'Adjustment Count',
      'Withdrawal Request Count',
      'Picking Count',
      'Dispatch Count',
      'Pending Operations',
      'Completed Operations',
      'Operation Charge Activity Count',
      'Operation Performance Table',
      'Operation Status Breakdown',
      'Customer Operation Volume',
      'Warehouse Operation Volume',
      'Operation Charge Activity Preview',
      'Operation Date',
      'Operation Type',
      'Document No',
      'Customer',
      'Warehouse',
      'Status',
      'Qty / Weight',
      'Charge Type',
      'Reference',
      'Created At',
      'Created By',
      'Billing Relevance Note',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('keeps report UI free of posting, stock writes, billing/file engines, workflow action buttons, and disallowed terminology', () => {
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
      'Post Document',
      'Confirm Document',
      'Complete Document',
      'Post Operation',
      'Confirm Operation',
      'Complete Operation',
      'writeFile',
      'createWriteStream',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, policy, legacy, or Express sync artifacts for this sprint', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/026_warehouse_operation_performance_report.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/006_warehouse_operation_performance_report.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
  });
});
