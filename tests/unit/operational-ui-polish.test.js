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

  it('wires active list pages to shared document components where applicable', () => {
    const withdrawalList = readProjectFile('src/features/operations/withdrawal/WithdrawalRequestListPage.jsx');
    expect(withdrawalList).toContain('DocumentFilterBar');
    expect(withdrawalList).toContain('DocumentToolbar');

    const receivingList = readProjectFile('src/features/operations/receiving/ReceivingListPage.jsx');
    expect(receivingList).toContain('CustomerDepositNotificationsSection');
  });

  it('wires receiving detail page to controlled post wrapper and sections', () => {
    const receivingDetail = readProjectFile('src/features/operations/receiving/ReceivingDetailPage.jsx');
    expect(receivingDetail).toContain('DocumentSection');
    expect(receivingDetail).toContain('QuantitySummaryCard');
    expect(receivingDetail).toContain('postReceivingDocument');
    expect(receivingDetail).toContain('No stock movement until Confirm/Post');
  });

  it('keeps DraftLineEditor UI-only', () => {
    const source = readProjectFile('src/components/operations/DraftLineEditor.jsx');

    [
      'supabase',
      'createReceivingDocument',
      'createPutawayDocument',
      'createTransferDocument',
      'createAdjustmentDocument',
      'createWithdrawalRequest',
      'createPickingDocument',
      'createDispatchDocument',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });
  });

  it('keeps active operational UI free of direct posting RPC strings in pages', () => {
    const uiFiles = [
      'src/components/operations/DocumentFilterBar.jsx',
      'src/components/operations/DocumentToolbar.jsx',
      'src/components/operations/QuantitySummaryCard.jsx',
      'src/components/operations/DraftLineEditor.jsx',
      'src/components/operations/DocumentSection.jsx',
      'src/features/operations/receiving/ReceivingListPage.jsx',
      'src/features/operations/receiving/ReceivingDetailPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
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
      'tgd_stock_balances',
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
