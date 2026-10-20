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
  ];

  it('does not register standalone internal withdrawal, allocation, picking, or dispatch routes', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/withdrawal-requests',
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

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/018_outbound_ui.sql'))).toBe(false);
  });
});
