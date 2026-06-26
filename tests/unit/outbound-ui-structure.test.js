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
    'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
    'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
  ];

  it('creates withdrawal list, detail, and create pages', () => {
    [
      'src/features/operations/withdrawal/WithdrawalRequestListPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestDetailPage.jsx',
      'src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes withdrawal list, new, and detail pages', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/withdrawal-requests',
      '/operations/withdrawal-requests/new',
      '/operations/withdrawal-requests/:id',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });

    [
      '/operations/allocations',
      '/operations/picking',
      '/operations/dispatch',
    ].forEach((removedRoute) => {
      expect(routesSource).not.toContain(removedRoute);
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
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('uses services for read and draft-create access only', () => {
    const withdrawalList = readProjectFile('src/features/operations/withdrawal/WithdrawalRequestListPage.jsx');
    const withdrawalCreate = readProjectFile('src/features/operations/withdrawal/WithdrawalRequestCreatePage.jsx');

    expect(withdrawalList).toContain('getWithdrawalRequests');
    expect(withdrawalCreate).toContain('createWithdrawalRequest');
    expect(withdrawalCreate).toContain("status: 'DRAFT'");
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/018_outbound_ui.sql'))).toBe(false);
  });
});
