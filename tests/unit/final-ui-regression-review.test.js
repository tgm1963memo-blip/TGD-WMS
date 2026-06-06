import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('17G Final UI Regression Review', () => {
  const docPath = 'docs/17G_FINAL_UI_REGRESSION_REVIEW.md';

  it('doc exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('doc contains safety definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Final UI regression review only');
    expect(source).toContain('No new UI feature implementation');
    expect(source).toContain('No Production touched');
    expect(source).toContain('No migration applied');
    expect(source).toContain('No services changed');
    expect(source).toContain('No business logic changed');
    expect(source).toContain('No feature gate behavior changed');
    expect(source).toContain('This review does not authorize Production apply');
  });

  it('doc includes UI areas', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('App Shell');
    expect(source).toContain('Sidebar Navigation');
    expect(source).toContain('Dashboard');
    expect(source).toContain('Outbound Operations');
    expect(source).toContain('Handheld / Mobile Scan');
    expect(source).toContain('Stock / Inventory');
    expect(source).toContain('Movement Ledger');
    expect(source).toContain('Transfer');
    expect(source).toContain('Adjustment');
  });

  it('doc includes Design consistency checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Black & Gold theme');
    expect(source).toContain('#111111');
    expect(source).toContain('#d4af37');
    expect(source).toContain('Full text professional sidebar menu');
    expect(source).toMatch(/No cute emoji icons/i);
  });

  it('doc includes Functional safety checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Post Outbound feature gate remains OFF by default');
    expect(source).toContain('Stock movement logic unchanged');
    expect(source).toContain('Stock balance calculation unchanged');
    expect(source).toContain('Scan logic unchanged');
    expect(source).toContain('Complete session logic unchanged');
  });

  it('doc includes Production boundary and release wording', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(source).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(source).toMatch(/17H UI Release Readiness Summary/i);
    expect(source).toMatch(/18A Real UAT Execution Preparation/i);
  });
});
