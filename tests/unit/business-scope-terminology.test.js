import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

const activeDocPaths = [
  'README.md',
  'docs/project-boundary.md',
  'docs/architecture/system-overview.md',
  'docs/sprint-roadmap.md',
  'docs/business-rules/inventory-principles.md',
  'docs/business-rules/cold-storage-business-scope.md',
  'docs/architecture/cold-storage-billing-backlog.md',
];

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('cold storage business scope terminology', () => {
  it('creates cold storage scope and billing backlog documents', () => {
    expect(existsSync(resolve(projectRoot, 'docs/business-rules/cold-storage-business-scope.md'))).toBe(true);
    expect(existsSync(resolve(projectRoot, 'docs/architecture/cold-storage-billing-backlog.md'))).toBe(true);
  });

  it('documents cold storage deposit, storage, and withdrawal business', () => {
    const source = activeDocPaths.map(readProjectFile).join('\n');

    [
      'cold storage',
      'Goods Deposit',
      'Storage',
      'Customer Withdrawal Request',
      'customer-owned inventory',
      'Monthly Storage Billing Summary',
      'operation charges',
      'repack',
      'sorting',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('documents billing as summary/export support rather than full accounting', () => {
    const source = activeDocPaths.map(readProjectFile).join('\n');

    expect(source).toContain('billing summary/export');
    expect(source).toContain('accounting handoff');
    expect(source).toContain('not full accounting');
  });

  it('uses the aligned Phase 6 roadmap wording', () => {
    const roadmap = readProjectFile('docs/sprint-roadmap.md');

    [
      'Sprint 6A Customer-owned Inventory Dashboard',
      'Sprint 6B Customer Stock Movement Ledger',
      'Sprint 6C Customer Storage Balance Report',
      'Sprint 6D Storage Aging / Lot / Expiry / Chargeable Days Report',
      'Sprint 6E Warehouse Operation Performance Report',
      'Sprint 6F Monthly Storage Billing Summary Foundation',
    ].forEach((term) => {
      expect(roadmap).toContain(term);
    });
  });

  it('keeps active scope docs free of legacy outbound table names and commercial order wording', () => {
    const source = activeDocPaths.map(readProjectFile).join('\n');

    [
      'Sales Order',
      'sales order',
      'sales invoice',
      'sales revenue',
      'sales margin',
      'order fulfillment',
      'outbound_orders',
      'tgd_outbound_orders',
    ].forEach((term) => {
      expect(source).not.toContain(term);
    });

    expect(source).not.toMatch(/\bSO\b/);
  });
});
