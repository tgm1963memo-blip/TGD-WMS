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
    'src/features/operations/PutawayPage.jsx',
    'src/features/operations/receiving/ReceivingListPage.jsx',
    'src/features/operations/receiving/ReceivingDetailPage.jsx',
    'src/features/operations/receiving/ReceivingCreatePage.jsx',
    'src/features/operations/putaway/PutawayListPage.jsx',
    'src/features/operations/putaway/PutawayDetailPage.jsx',
    'src/features/operations/putaway/PutawayCreatePage.jsx',
    'src/components/operations/DocumentStatusCard.jsx',
    'src/components/operations/DocumentLineTable.jsx',
    'src/components/operations/ReadOnlyField.jsx',
  ];

  it('creates receiving and putaway list/detail/create pages', () => {
    [
      'src/features/operations/receiving/ReceivingListPage.jsx',
      'src/features/operations/receiving/ReceivingDetailPage.jsx',
      'src/features/operations/receiving/ReceivingCreatePage.jsx',
      'src/features/operations/putaway/PutawayListPage.jsx',
      'src/features/operations/putaway/PutawayDetailPage.jsx',
      'src/features/operations/putaway/PutawayCreatePage.jsx',
    ].forEach((path) => {
      expect(statSync(resolve(projectRoot, path)).isFile()).toBe(true);
    });
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

  it('routes receiving and putaway list, new, and detail pages', () => {
    const routesSource = readProjectFile('src/app/routes.jsx');

    [
      '/operations/receiving',
      '/operations/receiving/new',
      '/operations/receiving/:id',
      '/operations/putaway',
      '/operations/putaway/new',
      '/operations/putaway/:id',
    ].forEach((routePath) => {
      expect(routesSource).toContain(routePath);
    });
  });

  it('keeps inbound UI free of posting and stock update behavior', () => {
    const source = inboundUiFiles.map(readProjectFile).join('\n');

    [
      'tgd_post_receiving_document',
      'tgd_post_putaway_document',
      'tgd_post_inventory_movement',
      'tgd_post_adjustment_document',
      'tgd_stock_balances',
      'PICK_CONFIRM',
      'PICK_ALLOCATE',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
  });

  it('uses services for data access without importing post helpers into pages', () => {
    const receivingCreate = readProjectFile('src/features/operations/receiving/ReceivingCreatePage.jsx');
    const putawayCreate = readProjectFile('src/features/operations/putaway/PutawayCreatePage.jsx');
    const receivingList = readProjectFile('src/features/operations/receiving/ReceivingListPage.jsx');
    const putawayList = readProjectFile('src/features/operations/putaway/PutawayListPage.jsx');

    expect(receivingCreate).toContain('createReceivingDocument');
    expect(putawayCreate).toContain('createPutawayDocument');
    expect(receivingList).toContain('getReceivingDocuments');
    expect(putawayList).toContain('getPutawayDocuments');
    expect(receivingCreate).toContain("status: 'DRAFT'");
    expect(putawayCreate).toContain("status: 'DRAFT'");
  });

  it('does not create database, legacy, or Express sync artifacts', () => {
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);
    expect(statSync(resolve(projectRoot, 'integrations/express/sync')).isDirectory()).toBe(true);
    expect(existsSync(resolve(projectRoot, 'database/migrations/017_inbound_ui.sql'))).toBe(false);
  });
});
