import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18G Controlled Write Smoke Test Execution Result Review', () => {
  const docPath = 'docs/18G_CONTROLLED_WRITE_SMOKE_TEST_EXECUTION_RESULT_REVIEW.md';

  it('1. 18G document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G is documentation/test-only');
  });

  it('3. Document states 18G creates an execution result review framework only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G creates an execution result review framework only');
  });

  it('4. Document states 18G does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G does not execute controlled write smoke test');
  });

  it('5. Document states 18G does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G does not execute any write transaction');
  });

  it('6. Document states 18G does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('7. Document states 18G does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G does not execute rollback');
  });

  it('8. Document states 18G does not fabricate execution results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G does not fabricate execution results');
  });

  it('9. Document references 18A, 18B, 18C, 18D, 18E, and 18F correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides UAT result review and defect triage');
    expect(source).toContain('18D provides controlled write smoke test readiness review');
    expect(source).toContain('18E provides controlled write smoke test authorization review');
    expect(source).toContain('18F provides controlled write smoke test execution packet/runbook');
  });

  it('10. Document contains Review Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Review Input Requirements');
  });

  it('11. Document contains Execution Evidence Review Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Execution Evidence Review Matrix');
  });

  it('12. Document contains Before/After Validation Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Before/After Validation Rules');
  });

  it('13. Document contains Execution Result Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Execution Result Classification');
  });

  it('14. Document contains Incident / Defect Triage Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Incident / Defect Triage Rules');
  });

  it('15. Document contains Incident / Defect Review Table', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Incident / Defect Review Table');
  });

  it('16. Document contains Rollback Review Section', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Rollback Review Section');
  });

  it('17. Document contains Reviewer Decision Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Reviewer Decision Matrix');
  });

  it('18. Document contains Result Outcome Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Result Outcome Classification');
  });

  it('19. Document contains Controller Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('20. Document states Production gate review consideration is NOT AUTHORIZED IN 18G', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production gate review consideration: NOT AUTHORIZED IN 18G');
  });

  it('21. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18G', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18G');
  });

  it('22. Document states FINAL GO is NOT AUTHORIZED IN 18G', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18G');
  });

  it('23. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production status: HOLD');
  });

  it('24. Document recommends 18H Production Gate Review Readiness Assessment', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18H Production Gate Review Readiness Assessment');
  });

  it('25. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, actual write execution completion as a fact, smoke test pass as a fact, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production\b(?! gate)/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Write executed/i);
    expect(source).not.toMatch(/Smoke test executed/i);
    expect(source).not.toMatch(/Controlled write completed/i);
    expect(source).not.toMatch(/Execution completed/i);
    expect(source).not.toMatch(/Smoke test passed\b(?! within authorized scope)/i);
    expect(source).not.toMatch(/Production gate approved/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
  });
});
