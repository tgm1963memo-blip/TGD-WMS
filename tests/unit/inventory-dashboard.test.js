import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 6A inventory dashboard foundation', () => {
  const dashboardFiles = [
    'src/features/dashboard/DashboardPage.jsx',
    'src/components/dashboard/DashboardSection.jsx',
    'src/app/routes.jsx',
  ];

  const forbiddenTerms = [
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
    'PICK_CONFIRM',
    'PICK_ALLOCATE',
    'Sales Order',
    'sales order',
  ];

  it('creates dashboard page and dashboard components', () => {
    [
      'src/features/dashboard/DashboardPage.jsx',
      'src/components/dashboard/DashboardSection.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes the dashboard page (inventory dashboard retired)', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    expect(routesSource).toContain('/dashboard');
    expect(routesSource).not.toContain('/dashboard/inventory');
    expect(routesSource).not.toContain('InventoryDashboardPage');
  });

  it('keeps dashboard UI free of posting, stock writes, and disallowed terminology', () => {
    const source = dashboardFiles.map(readProjectFile).join('\n');

    forbiddenTerms.forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/020_inventory_dashboard.sql'))).toBe(false);
  });
});
