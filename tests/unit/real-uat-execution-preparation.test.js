import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18A Real UAT Execution Preparation', () => {
  const docPath = 'docs/18A_REAL_UAT_EXECUTION_PREPARATION.md';

  it('doc exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('doc contains safety definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Real UAT execution preparation only');
    expect(source).toContain('No UAT execution yet');
    expect(source).toContain('No Production touched');
    expect(source).toContain('No Production migration applied');
    expect(source).toContain('No controlled write smoke authorized');
    expect(source).toContain('No runtime code changed');
    expect(source).toContain('No services changed');
    expect(source).toContain('No business logic changed');
    expect(source).toContain('No feature gate behavior changed');
    expect(source).toContain('This document does not authorize Production apply');
  });

  it('doc includes current readiness state', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Phase 17 UI Polish: COMPLETE');
    expect(source).toContain('UI Release Readiness: READY FOR REAL UAT');
    expect(source).toContain('Production Readiness: HOLD');
    expect(source).toContain('Production Apply: NOT AUTHORIZED');
    expect(source).toContain('Controlled Write Smoke: NOT AUTHORIZED');
  });

  it('doc includes default statuses', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('PENDING CONFIRMATION');
    expect(source).toContain('PENDING ASSIGNMENT');
  });

  it('doc includes all required UAT scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Login and navigation smoke');
    expect(source).toContain('Dashboard review');
    expect(source).toContain('Inventory / Stock Balance review');
    expect(source).toContain('Movement Ledger review');
    expect(source).toContain('Outbound request review');
    expect(source).toContain('Allocation review');
    expect(source).toContain('Picking review');
    expect(source).toContain('Dispatch review');
    expect(source).toContain('Handheld receiving scan review');
    expect(source).toContain('Handheld putaway scan review');
    expect(source).toContain('Transfer review');
    expect(source).toContain('Adjustment review');
    expect(source).toContain('Safety panel verification');
    expect(source).toContain('Feature gate verification');
    expect(source).toContain('Permission boundary verification');
    expect(source).toContain('No unexpected write trigger by navigation');
  });

  it('doc includes evidence standard, defect log, and sign-off', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT evidence capture standard');
    expect(source).toContain('UAT defect log template');
    expect(source).toContain('UAT sign-off checklist');
  });

  it('doc includes Production boundary and release wording', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO must not be inferred from UAT preparation');
    expect(source).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(source).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(source).toContain('READY TO SCHEDULE UAT');
  });

  it('doc recommends 18B', () => {
    const source = readProjectFile(docPath);
    expect(source).toMatch(/18B Real UAT Execution/i);
  });
});
