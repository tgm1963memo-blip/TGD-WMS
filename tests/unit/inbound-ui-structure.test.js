import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Sprint 5B inbound UI structure', () => {
  const inboundUiFiles = [
    'src/app/routes.jsx',
    'src/features/operations/ReceivingPage.jsx',
    'src/features/operations/receiving/ReceivingListPage.jsx',
    'src/features/operations/receiving/ReceivingDetailPage.jsx',
    'src/components/operations/DocumentStatusCard.jsx',
    'src/components/operations/DocumentLineTable.jsx',
    'src/components/operations/ReadOnlyField.jsx',
  ];

  it('creates receiving list and detail pages only', () => {
    [
      'src/features/operations/receiving/ReceivingListPage.jsx',
      'src/features/operations/receiving/ReceivingDetailPage.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });

    expect(existsSync(resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'src/features/operations/receiving/ReceivingCreatePage.jsx'))).toBe(false);
  });

  it('creates inbound shared operation components', () => {
    [
      'src/components/operations/DocumentStatusCard.jsx',
      'src/components/operations/DocumentLineTable.jsx',
      'src/components/operations/ReadOnlyField.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
  });

  it('routes receiving list and detail pages', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/receiving',
      '/operations/receiving/:id',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });

    expect(routesSource).not.toContain('/operations/receiving/new');
    expect(routesSource).not.toContain('/operations/putaway');
  });

  it('keeps inbound UI free of direct stock table writes', () => {
    const source = inboundUiFiles.map(readProjectFile).join('\n');

    expect(source).not.toContain('tgd_stock_balances');
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
  });

  it('uses services for data access and keeps direct post RPC out of pages', () => {
    const receivingDetail = readProjectFile('src/features/operations/receiving/ReceivingDetailPage.jsx');
    const receivingList = readProjectFile('src/features/operations/receiving/ReceivingListPage.jsx');
    const receivingService = readProjectFile('src/services/receivingService.js');

    expect(receivingDetail).toContain('postReceivingDocument');
    expect(receivingDetail).toContain('No stock movement until Confirm/Post');
    expect(receivingDetail).not.toContain('tgd_rpc_post_receiving_document');
    expect(receivingList).toContain('CustomerDepositNotificationsSection');
    expect(receivingService).toContain('tgd_rpc_post_receiving_document');
    expect(receivingService).not.toMatch(/from\(['"`]tgd_stock_balances['"`]\)/i);
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/017_inbound_ui.sql'))).toBe(false);
  });
});
