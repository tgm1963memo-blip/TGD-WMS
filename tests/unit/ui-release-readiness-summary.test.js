import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('17H UI Release Readiness Summary', () => {
  const docPath = 'docs/17H_UI_RELEASE_READINESS_SUMMARY.md';

  it('doc exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('doc contains scope definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UI release readiness summary only');
    expect(source).toContain('No new UI implementation');
    expect(source).toContain('No runtime code changed');
    expect(source).toContain('No Production touched');
    expect(source).toContain('No migration applied');
    expect(source).toContain('No services changed');
    expect(source).toContain('No business logic changed');
    expect(source).toContain('No feature gate behavior changed');
    expect(source).toContain('This summary does not authorize Production apply');
  });

  it('doc includes Phase 17 completion summary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('17A UI/UX Design Review & Mockup: CLOSED / PASS');
    expect(source).toContain('17B App Shell and Navigation UI Implementation: CLOSED / PASS');
    expect(source).toContain('17C Dashboard UI Polish: CLOSED / PASS');
    expect(source).toContain('17D Outbound UI Polish: CLOSED / PASS');
    expect(source).toContain('17E Handheld Mobile UI Polish: CLOSED / PASS');
    expect(source).toContain('17F Stock / Inventory UI Polish: CLOSED / PASS');
    expect(source).toContain('17G Final UI Regression Review: CLOSED / PASS');
  });

  it('doc includes UI readiness decision', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UI Release Readiness: READY FOR REAL UAT');
    expect(source).toContain('Production Readiness: HOLD');
    expect(source).toContain('Production Apply: NOT AUTHORIZED');
    expect(source).toContain('Controlled Write Smoke: NOT AUTHORIZED');
  });

  it('doc includes UI areas', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('App Shell');
    expect(source).toContain('Dashboard');
    expect(source).toContain('Outbound Operations');
    expect(source).toContain('Handheld / Mobile Scan');
    expect(source).toContain('Stock / Inventory');
  });

  it('doc includes design system readiness', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Black & Gold Professional Warehouse UI');
    expect(source).toContain('#111111');
    expect(source).toContain('#d4af37');
    expect(source).toContain('Full Text Professional Sidebar');
    expect(source).toMatch(/No cute emoji icons/i);
  });

  it('doc includes UAT entry status', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('PENDING ACTUAL UAT SETUP');
  });

  it('doc includes safety boundary and Production boundary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
    expect(source).toContain('FINAL GO must not be inferred from UI readiness');
    expect(source).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(source).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });

  it('doc recommends 18A', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A Real UAT Execution Preparation');
  });
});
