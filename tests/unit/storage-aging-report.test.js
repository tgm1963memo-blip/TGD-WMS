import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6D storage aging report foundation', () => {
  const servicePath = 'src/services/storageAgingReportService.js';
  const reportUiFiles = [
    'src/features/reports/StorageAgingReportPage.jsx',
    'src/features/reports/ReportsPage.jsx',
    'src/components/reports/StorageAgingTable.jsx',
    'src/components/reports/ExpiryAlertTable.jsx',
    'src/components/reports/AgingBucketSummary.jsx',
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

  it('creates the storage aging report service with read-only functions and pure classifiers, sourced from the live balance (not tgd_stock_balances)', () => {
    const source = readProjectFile(servicePath);

    expect(statSync(resolve(projectRoot, servicePath)).isFile()).toBe(true);
    [
      'getStorageAgingRows',
      'getStorageAgingSummary',
      'getExpiryAlertRows',
      'getChargeableDaysPreview',
      'groupAgingByCustomer',
      'groupAgingByProduct',
      'classifyAgingBucket',
      'classifyExpiryStatus',
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

  it('creates the storage aging report page and report components', () => {
    [
      'src/features/reports/StorageAgingReportPage.jsx',
      'src/components/reports/StorageAgingTable.jsx',
      'src/components/reports/ExpiryAlertTable.jsx',
      'src/components/reports/AgingBucketSummary.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('links and routes the storage aging report', () => {
    const reportsSource = readProjectFile('src/features/reports/ReportsPage.jsx');
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(reportsSource).toContain('Storage Aging / Lot / Expiry / Chargeable Days Report');
    expect(reportsSource).toContain('/reports/storage-aging');
    expect(routesSource).toContain('/reports/storage-aging');
    expect(routesSource).toContain('StorageAgingReportPage');
  });

  it('renders cold storage aging sections, summary cards, and table columns', () => {
    const source = reportUiFiles.map(readProjectFile).join('\n');

    // English section-level strings that appear in the bilingual titles / report definitions
    [
      'cold storage',
      'Storage Aging / Lot / Expiry / Chargeable Days Report',
      '/reports/storage-aging',
      'Storage Aging Table',
      'Expiry Alert Section',
    ].forEach((term) => {
      expect(source).toContain(term);
    });

    // Summary card test-IDs required by Phase 5 (Single Source of Truth)
    [
      'summary-avg-age',
      'summary-avg-shelf-life',
      'summary-expired',
      'summary-near-expiry',
      'summary-no-expiry',
    ].forEach((testId) => {
      expect(source).toContain(testId);
    });

    // Phase 4: Thai column headers that MUST appear in the Storage Aging Table
    // (Expiry Date, Remaining Days, Expiry Status, Storage Age)
    [
      'วันหมดอายุ',              // Expiry Date
      'อายุสินค้าคงเหลือ (วัน)', // Remaining Days
      'สถานะหมดอายุ',            // Expiry Status
      'อายุจัดเก็บ (วัน)',        // Storage Age / Aging Days
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('keeps report UI free of posting, stock writes, billing actions, expiry actions, and disallowed terminology', () => {
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
      'expiry write-off',
      'stock hold',
      'stock release',
      'writeFile',
      'createWriteStream',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, policy, legacy, or Express sync artifacts for this sprint', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/025_storage_aging_report.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/005_storage_aging_report.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
  });
});
