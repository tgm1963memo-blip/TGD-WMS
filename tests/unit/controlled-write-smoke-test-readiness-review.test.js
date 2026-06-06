import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18D Controlled Write Smoke Test Readiness Review', () => {
  const docPath = 'docs/18D_CONTROLLED_WRITE_SMOKE_TEST_READINESS_REVIEW.md';

  it('1. 18D document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D is documentation/test-only');
  });

  it('3. Document states 18D is readiness review only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D is a readiness review only');
  });

  it('4. Document states 18D does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D does not execute a controlled write smoke test');
  });

  it('5. Document states 18D does not authorize controlled write smoke test execution', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D does not authorize write execution');
  });

  it('6. Document states 18D does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('7. Document references 18A, 18B, and 18C correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines the Real UAT preparation framework');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides the result review and defect triage framework');
  });

  it('8. Document contains Readiness Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Readiness Input Requirements');
  });

  it('9. Document contains Controlled Write Smoke Test Readiness Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controlled Write Smoke Test Readiness Matrix');
  });

  it('10. Document contains Proposed Smoke Test Scope Template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Proposed Smoke Test Scope Template');
  });

  it('11. Document contains Write Scope Limitation Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Write Scope Limitation Rules');
  });

  it('12. Document contains Rollback Readiness Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Rollback Readiness Rules');
  });

  it('13. Document contains Stop Conditions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Stop Conditions');
  });

  it('14. Document contains Approval Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Approval Gate');
  });

  it('15. Document contains Risk Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Risk Register');
  });

  it('16. Document contains Readiness Outcome Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Readiness Outcome Classification');
  });

  it('17. Document contains Controller Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('18. Document states controlled write smoke test execution is NOT AUTHORIZED IN 18D', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controlled write smoke test execution: NOT AUTHORIZED IN 18D');
  });

  it('19. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18D', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18D');
  });

  it('20. Document states FINAL GO is NOT AUTHORIZED IN 18D', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18D');
  });

  it('21. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
  });

  it('22. Document recommends 18E Controlled Write Smoke Test Authorization Review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E Controlled Write Smoke Test Authorization Review');
  });

  it('23. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, controlled write execution approval, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Controlled write smoke test approved/i);
    expect(source).not.toMatch(/Controlled write smoke test authorized/i);
    expect(source).not.toMatch(/Write execution approved/i);
    expect(source).not.toMatch(/Production release approved/i);
  });
});
