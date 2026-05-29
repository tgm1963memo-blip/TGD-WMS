import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5D outbound UI structure', () => {
  const outboundUiFiles = [
    'src/app/routes.jsx',
    'src/features/operations/WithdrawalRequestsPage.jsx',
    'src/features/operations/AllocationsPage.jsx',
    'src/features/operations/PickingPage.jsx',
    'src/features/operations/DispatchPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
    'src/features/operations/allocation/AllocationListPage.jsx',
    'src/features/operations/allocation/AllocationDetailPage.jsx',
    'src/features/operations/allocation/AllocationCreatePage.jsx',
    'src/features/operations/picking/PickingListPage.jsx',
    'src/features/operations/picking/PickingDetailPage.jsx',
    'src/features/operations/picking/PickingCreatePage.jsx',
    'src/features/operations/dispatch/DispatchListPage.jsx',
    'src/features/operations/dispatch/DispatchDetailPage.jsx',
    'src/features/operations/dispatch/DispatchCreatePage.jsx',
  ];

  it('creates withdrawal, allocation, picking, and dispatch list/detail/create pages', () => {
    [
      'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
      'src/features/operations/allocation/AllocationListPage.jsx',
      'src/features/operations/allocation/AllocationDetailPage.jsx',
      'src/features/operations/allocation/AllocationCreatePage.jsx',
      'src/features/operations/picking/PickingListPage.jsx',
      'src/features/operations/picking/PickingDetailPage.jsx',
      'src/features/operations/picking/PickingCreatePage.jsx',
      'src/features/operations/dispatch/DispatchListPage.jsx',
      'src/features/operations/dispatch/DispatchDetailPage.jsx',
      'src/features/operations/dispatch/DispatchCreatePage.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes outbound list, new, and detail pages', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/withdrawal-requests',
      '/operations/withdrawal-requests/new',
      '/operations/withdrawal-requests/:id',
      '/operations/allocations',
      '/operations/allocations/new',
      '/operations/allocations/:id',
      '/operations/picking',
      '/operations/picking/new',
      '/operations/picking/:id',
      '/operations/dispatch',
      '/operations/dispatch/new',
      '/operations/dispatch/:id',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });
  });

  it('keeps outbound UI free of confirm, post, movement, and stock update behavior', () => {
    const source = outboundUiFiles.map(readProjectFile).join('\n');

    [
      'tgd_confirm_withdrawal_request',
      'tgd_post_withdrawal_allocation',
      'tgd_confirm_picking_document',
      'tgd_post_dispatch_document',
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

  it('uses services for read and draft-create access only', () => {
    const withdrawalList = readProjectFile('src/features/operations/withdrawal/WithdrawalRequestListPage.jsx');
    const withdrawalCreate = readProjectFile('src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx');
    const allocationList = readProjectFile('src/features/operations/allocation/AllocationListPage.jsx');
    const allocationCreate = readProjectFile('src/features/operations/allocation/AllocationCreatePage.jsx');
    const pickingList = readProjectFile('src/features/operations/picking/PickingListPage.jsx');
    const pickingCreate = readProjectFile('src/features/operations/picking/PickingCreatePage.jsx');
    const dispatchList = readProjectFile('src/features/operations/dispatch/DispatchListPage.jsx');
    const dispatchCreate = readProjectFile('src/features/operations/dispatch/DispatchCreatePage.jsx');

    expect(withdrawalList).toContain('getWithdrawalRequests');
    expect(withdrawalCreate).toContain('createWithdrawalRequest');
    expect(allocationList).toContain('getWithdrawalAllocations');
    expect(allocationCreate).toContain('createWithdrawalAllocation');
    expect(pickingList).toContain('getPickingDocuments');
    expect(pickingCreate).toContain('createPickingDocument');
    expect(dispatchList).toContain('getDispatchDocuments');
    expect(dispatchCreate).toContain('createDispatchDocument');
    expect(withdrawalCreate).toContain("status: 'DRAFT'");
    expect(allocationCreate).toContain("status: 'DRAFT'");
    expect(pickingCreate).toContain("status: 'DRAFT'");
    expect(dispatchCreate).toContain("status: 'DRAFT'");
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/018_outbound_ui.sql'))).toBe(false);
  });
});
