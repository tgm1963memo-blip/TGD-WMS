import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5C internal operation UI structure', () => {
  const internalUiFiles = [
    'src/app/routes.jsx',
    'src/features/operations/TransferPage.jsx',
    'src/features/operations/AdjustmentPage.jsx',
    'src/features/operations/transfer/TransferListPage.jsx',
    'src/features/operations/transfer/TransferDetailPage.jsx',
    'src/features/operations/transfer/TransferCreatePage.jsx',
    'src/features/operations/adjustment/AdjustmentListPage.jsx',
    'src/features/operations/adjustment/AdjustmentDetailPage.jsx',
    'src/features/operations/adjustment/AdjustmentCreatePage.jsx',
    'src/features/stock-count/StockCountPage.jsx',
    'src/features/stock-count/StockCountListPage.jsx',
    'src/features/stock-count/StockCountDetailPage.jsx',
    'src/features/stock-count/StockCountCreatePage.jsx',
  ];

  it('creates transfer, adjustment, and stock count list/detail/create pages', () => {
    [
      'src/features/operations/transfer/TransferListPage.jsx',
      'src/features/operations/transfer/TransferDetailPage.jsx',
      'src/features/operations/transfer/TransferCreatePage.jsx',
      'src/features/operations/adjustment/AdjustmentListPage.jsx',
      'src/features/operations/adjustment/AdjustmentDetailPage.jsx',
      'src/features/operations/adjustment/AdjustmentCreatePage.jsx',
      'src/features/stock-count/StockCountListPage.jsx',
      'src/features/stock-count/StockCountDetailPage.jsx',
      'src/features/stock-count/StockCountCreatePage.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes list, new, and detail pages', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/transfer',
      '/operations/transfer/new',
      '/operations/transfer/:id',
      '/operations/adjustment',
      '/operations/adjustment/new',
      '/operations/adjustment/:id',
      '/stock-count',
      '/stock-count/new',
      '/stock-count/:id',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });
  });

  it('keeps internal operation UI free of posting, completion, and stock update behavior', () => {
    const source = internalUiFiles.map(readProjectFile).join('\n');

    [
      'tgd_post_transfer_document',
      'tgd_post_adjustment_document',
      'tgd_complete_stock_count_document',
      'tgd_create_adjustment_from_stock_count',
      'tgd_post_inventory_movement',
      'tgd_stock_balances',
      'PICK_CONFIRM',
      'PICK_ALLOCATE',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('uses services for read and draft-create access only', () => {
    const transferList = readProjectFile('src/features/operations/transfer/TransferListPage.jsx');
    const transferCreate = readProjectFile('src/features/operations/transfer/TransferCreatePage.jsx');
    const adjustmentList = readProjectFile('src/features/operations/adjustment/AdjustmentListPage.jsx');
    const adjustmentCreate = readProjectFile('src/features/operations/adjustment/AdjustmentCreatePage.jsx');
    const stockCountList = readProjectFile('src/features/stock-count/StockCountListPage.jsx');
    const stockCountCreate = readProjectFile('src/features/stock-count/StockCountCreatePage.jsx');

    expect(transferList).toContain('getTransferDocuments');
    expect(transferCreate).toContain('createTransferDocument');
    expect(adjustmentList).toContain('getAdjustmentDocuments');
    expect(adjustmentCreate).toContain('createAdjustmentDocument');
    expect(stockCountList).toContain('getStockCountDocuments');
    expect(stockCountCreate).toContain('createStockCountDocument');
    expect(transferCreate).toContain("status: 'DRAFT'");
    expect(adjustmentCreate).toContain("status: 'DRAFT'");
    expect(stockCountCreate).toContain("status: 'DRAFT'");
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/017_internal_ui.sql'))).toBe(false);
  });
});
