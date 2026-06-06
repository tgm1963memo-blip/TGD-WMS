import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18E Controlled Write Smoke Test Authorization Review', () => {
  const docPath = 'docs/18E_CONTROLLED_WRITE_SMOKE_TEST_AUTHORIZATION_REVIEW.md';

  it('1. 18E document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E is documentation/test-only');
  });

  it('3. Document states 18E is authorization review framework only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E is an authorization review framework only');
  });

  it('4. Document states 18E does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E does not execute a controlled write smoke test');
  });

  it('5. Document states 18E does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E does not execute any write transaction');
  });

  it('6. Document states 18E does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('7. Document states 18E does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18E does not execute rollback');
  });

  it('8. Document references 18A, 18B, 18C, and 18D correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines the Real UAT preparation framework');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides the result review and defect triage framework');
    expect(source).toContain('18D provides the controlled write smoke test readiness review framework');
  });

  it('9. Document contains Authorization Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Input Requirements');
  });

  it('10. Document contains Authorization Review Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Review Matrix');
  });

  it('11. Document contains Authorization Decision Options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Decision Options');
  });

  it('12. Document contains Controlled Write Scope Authorization Template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controlled Write Scope Authorization Template');
  });

  it('13. Document contains Authorization Boundary Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Boundary Rules');
  });

  it('14. Document contains No-Go Conditions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('No-Go Conditions');
  });

  it('15. Document contains Authorization Approval Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Approval Gate');
  });

  it('16. Document contains Authorization Risk Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Authorization Risk Register');
  });

  it('17. Document contains Controller Authorization Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Authorization Block');
  });

  it('18. Document states controlled write smoke test execution is NOT EXECUTED IN 18E', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controlled write smoke test execution: NOT EXECUTED IN 18E');
  });

  it('19. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18E', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18E');
  });

  it('20. Document states FINAL GO is NOT AUTHORIZED IN 18E', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18E');
  });

  it('21. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
  });

  it('22. Document recommends 18F Controlled Write Smoke Test Execution Packet', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F Controlled Write Smoke Test Execution Packet');
  });

  it('23. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, actual write execution, smoke test execution completion, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Write executed/i);
    expect(source).not.toMatch(/Smoke test executed/i);
    expect(source).not.toMatch(/Controlled write completed/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
  });
});
