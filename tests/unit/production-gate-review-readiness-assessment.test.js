import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18H Production Gate Review Readiness Assessment', () => {
  const docPath = 'docs/18H_PRODUCTION_GATE_REVIEW_READINESS_ASSESSMENT.md';

  it('1. 18H document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H is documentation/test-only');
  });

  it('3. Document states 18H creates Production Gate Review readiness assessment framework only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H creates a Production Gate Review readiness assessment framework only');
  });

  it('4. Document states 18H does not approve Production Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not approve Production Gate');
  });

  it('5. Document states 18H does not authorize FINAL GO', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not authorize FINAL GO');
  });

  it('6. Document states 18H does not release Production', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not release Production');
  });

  it('7. Document states 18H does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not execute controlled write smoke test');
  });

  it('8. Document states 18H does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not execute any write transaction');
  });

  it('9. Document states 18H does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('10. Document states 18H does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not execute rollback');
  });

  it('11. Document states 18H does not fabricate UAT or smoke test results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H does not fabricate UAT or smoke test results');
  });

  it('12. Document references 18A through 18G correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides UAT result review and defect triage');
    expect(source).toContain('18D provides controlled write smoke test readiness review');
    expect(source).toContain('18E provides controlled write smoke test authorization review');
    expect(source).toContain('18F provides controlled write smoke test execution packet/runbook');
    expect(source).toContain('18G provides controlled write smoke test execution result review');
  });

  it('13. Document contains Production Gate Readiness Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Readiness Input Requirements');
  });

  it('14. Document contains Production Gate Readiness Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Readiness Matrix');
  });

  it('15. Document contains Readiness Assessment Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Readiness Assessment Rules');
  });

  it('16. Document contains Production Gate Readiness Outcome Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Readiness Outcome Classification');
  });

  it('17. Document contains Remaining Risk Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Remaining Risk Register');
  });

  it('18. Document contains Evidence Gap Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Gap Register');
  });

  it('19. Document contains Sign-off Readiness Checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Sign-off Readiness Checklist');
  });

  it('20. Document contains Controller Readiness Assessment Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Readiness Assessment Block');
  });

  it('21. Document states Production Gate Review readiness decision is NOT AUTHORIZED IN 18H', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Review readiness decision: NOT AUTHORIZED IN 18H');
  });

  it('22. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18H', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18H');
  });

  it('23. Document states FINAL GO is NOT AUTHORIZED IN 18H', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18H');
  });

  it('24. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production status: HOLD');
  });

  it('25. Document recommends 18I Formal Production Gate Review Packet', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I Formal Production Gate Review Packet');
  });

  it('26. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, Production Gate approval, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production\b(?! gate)/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Production gate approved/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
    expect(source).not.toMatch(/Go decision approved/i);
    expect(source).not.toMatch(/Production gate passed/i);
  });
});
