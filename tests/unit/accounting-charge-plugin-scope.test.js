import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('Accounting charge summary plugin scope', () => {
  const activeDocs = [
    'README.md',
    'docs/sprint-roadmap.md',
    'docs/architecture/system-overview.md',
    'docs/architecture/cold-storage-billing-backlog.md',
    'docs/sprints/sprint-6f-implementation-notes.md',
    'docs/architecture/accounting-charge-summary-plugin.md',
  ];

  function activeDocSource() {
    return activeDocs.map(readProjectFile).join('\n');
  }

  it('creates the accounting charge summary plugin architecture document', () => {
    const docPath = 'docs/architecture/accounting-charge-summary-plugin.md';
    const source = readProjectFile(docPath);

    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
    expect(source).toContain('Accounting Charge Summary Plugin');
    expect(source).toContain('Bplus is the first accounting / ERP handoff target');
    expect(source).toContain('Infor ERP M3 is a future accounting / ERP handoff target');
  });

  it('clarifies Phase 7 as accounting charge summary handoff only', () => {
    const roadmap = readProjectFile('docs/sprint-roadmap.md');
    const source = activeDocSource();

    expect(roadmap).toMatch(/Phase 7: (Accounting Charge Summary Plugin Foundation|ERP Plugin for Accounting Charge Summary Handoff)/);
    expect(source).toContain('accounting charge summary handoff only');
    expect(source).toContain('monthly storage charge summary / accounting review summary');
  });

  it('documents Bplus first target and Infor ERP M3 future target', () => {
    const source = activeDocSource();

    expect(source).toContain('Bplus is the first accounting / ERP handoff target');
    expect(source).toContain('Infor ERP M3 is a future accounting / ERP handoff target');
  });

  it('documents inventory and overwrite exclusions', () => {
    const source = activeDocSource();

    [
      'does not sync inventory',
      'does not pull inventory from ERP',
      'does not send WMS stock movement as ERP inventory movement',
      'does not overwrite WMS stock',
      'does not overwrite ERP stock',
      'does not overwrite master data automatically',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('documents accounting boundaries', () => {
    const source = activeDocSource();

    [
      'does not generate invoices',
      'does not post accounting entries',
      'Accounting users must review summaries before billing in the accounting / ERP system',
    ].forEach((term) => {
      expect(source).toContain(term);
    });
  });

  it('does not create database, policy, legacy, or production connector artifacts', () => {
    expect(existsSync(resolve(projectRoot, 'database/migrations/028_accounting_charge_summary_plugin.sql'))).toBe(false);
    expect(existsSync(resolve(projectRoot, 'database/policies/008_accounting_charge_summary_plugin.sql'))).toBe(false);
    expect(statSync(resolve(projectRoot, 'legacy-reference')).isDirectory()).toBe(true);

    [
      'integrations/bplus',
      'integrations/infor-m3',
      'integrations/erp/bplusConnector.js',
      'integrations/erp/inforM3Connector.js',
      'integrations/express/sync/accountingChargeSummarySync.js',
    ].forEach((path) => {
      expect(existsSync(resolve(projectRoot, path))).toBe(false);
    });
  });
});
