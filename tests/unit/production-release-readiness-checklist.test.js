import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18O Production Release Readiness Checklist', () => {
  const docPath = 'docs/18O_PRODUCTION_RELEASE_READINESS_CHECKLIST.md';

  it('1. 18O document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18O is documentation/test-only');
    expect(source).toContain('18O does not release Production');
    expect(source).toContain('18O does not authorize Go Live');
    expect(source).toContain('18O does not mark Production ready');
    expect(source).toContain('18O does not make Go/No-Go decision');
    expect(source).toContain('18O does not authorize FINAL GO');
    expect(source).toContain('No Production release is authorized');
    expect(source).toContain('Production remains HOLD');
  });

  it('3. Document references 18A through 18N correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18N provides the draft packet for a later formal Go/No-Go decision');
  });

  it('4. Document contains all readiness checklists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Prerequisite Checklist');
    expect(source).toContain('Production Environment Readiness Checklist');
    expect(source).toContain('Data Readiness Checklist');
    expect(source).toContain('Access Control Readiness Checklist');
    expect(source).toContain('Stock Balance and Ledger Readiness Checklist');
    expect(source).toContain('Rollback Readiness Checklist');
    expect(source).toContain('Monitoring Readiness Checklist');
    expect(source).toContain('Support Readiness Checklist');
    expect(source).toContain('Communication Readiness Checklist');
    expect(source).toContain('Training and SOP Readiness Checklist');
  });

  it('5. Document contains release risk register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Risk Register');
  });

  it('6. Document contains controller block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Release Readiness Block');
  });

  it('7. Document recommends 18P', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P Production Release Approval Packet');
  });
});
