import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5E operational UI polish', () => {
  const listPages = [
    'src/features/operations/receiving/ReceivingListPage.jsx',
    'src/features/operations/putaway/PutawayListPage.jsx',
    'src/features/operations/transfer/TransferListPage.jsx',
    'src/features/operations/adjustment/AdjustmentListPage.jsx',
    'src/features/stock-count/StockCountListPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
    'src/features/operations/allocation/AllocationListPage.jsx',
    'src/features/operations/picking/PickingListPage.jsx',
    'src/features/operations/dispatch/DispatchListPage.jsx',
  ];

  const createPages = [
    'src/features/operations/receiving/ReceivingCreatePage.jsx',
    'src/features/operations/putaway/PutawayCreatePage.jsx',
    'src/features/operations/transfer/TransferCreatePage.jsx',
    'src/features/operations/adjustment/AdjustmentCreatePage.jsx',
    'src/features/stock-count/StockCountCreatePage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
    'src/features/operations/allocation/AllocationCreatePage.jsx',
    'src/features/operations/picking/PickingCreatePage.jsx',
    'src/features/operations/dispatch/DispatchCreatePage.jsx',
  ];

  const detailPages = [
    'src/features/operations/receiving/ReceivingDetailPage.jsx',
    'src/features/operations/putaway/PutawayDetailPage.jsx',
    'src/features/operations/transfer/TransferDetailPage.jsx',
    'src/features/operations/adjustment/AdjustmentDetailPage.jsx',
    'src/features/stock-count/StockCountDetailPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
    'src/features/operations/allocation/AllocationDetailPage.jsx',
    'src/features/operations/picking/PickingDetailPage.jsx',
    'src/features/operations/dispatch/DispatchDetailPage.jsx',
  ];

  it('creates reusable operation polish components', () => {
    [
      'src/components/operations/DocumentFilterBar.jsx',
      'src/components/operations/DocumentToolbar.jsx',
      'src/components/operations/QuantitySummaryCard.jsx',
      'src/components/operations/DraftLineEditor.jsx',
      'src/components/operations/DocumentSection.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('wires list pages to filters and toolbar', () => {
    listPages.forEach((path) => {
      const source = readProjectFile(path);
      expect(source).toContain('DocumentFilterBar');
      expect(source).toContain('DocumentToolbar');
    });
  });

  it('wires create pages to the draft line editor foundation', () => {
    createPages.forEach((path) => {
      const source = readProjectFile(path);
      if (path.includes('/receiving/')) {
        expect(source).toContain('Controlled receiving draft mode');
        expect(source).toContain('Confirm/Post is still locked');
        expect(source).not.toContain('DraftLineEditor');
        return;
      }

      expect(source).toContain('DraftLineEditor');
    });
  });

  it('keeps detail pages read-only with sections and summaries', () => {
    detailPages.forEach((path) => {
      const source = readProjectFile(path);
      expect(source).toContain('DocumentSection');
      expect(source).toContain('QuantitySummaryCard');
    });
  });

  it('keeps DraftLineEditor UI-only', () => {
    const source = readProjectFile('src/components/operations/DraftLineEditor.jsx');

    [
      'supabase',
      'Service',
      'createReceivingDocument',
      'createPutawayDocument',
      'createTransferDocument',
      'createAdjustmentDocument',
      'createStockCountDocument',
      'createWithdrawalRequest',
      'createWithdrawalAllocation',
      'createPickingDocument',
      'createDispatchDocument',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('keeps operational UI free of posting, movement, stock, and disallowed terminology', () => {
    const uiFiles = [
      'src/components/operations/DocumentFilterBar.jsx',
      'src/components/operations/DocumentToolbar.jsx',
      'src/components/operations/QuantitySummaryCard.jsx',
      'src/components/operations/DraftLineEditor.jsx',
      'src/components/operations/DocumentSection.jsx',
      ...listPages,
      ...createPages,
      ...detailPages,
    ];
    const source = uiFiles.map(readProjectFile).join('\n');

    [
      'tgd_post_receiving_document',
      'tgd_post_putaway_document',
      'tgd_post_transfer_document',
      'tgd_post_adjustment_document',
      'tgd_post_withdrawal_allocation',
      'tgd_confirm_picking_document',
      'tgd_post_dispatch_document',
      'tgd_complete_stock_count_document',
      'tgd_create_adjustment_from_stock_count',
      'tgd_post_inventory_movement',
      'tgd_stock_balances',
      'PICK_CONFIRM',
      'PICK_ALLOCATE',
      'Sales Order',
      'sales order',
      'SO',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/019_operational_ui_polish.sql'))).toBe(false);
  });
});
