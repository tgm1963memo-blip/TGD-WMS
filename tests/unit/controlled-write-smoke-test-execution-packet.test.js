import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18F Controlled Write Smoke Test Execution Packet', () => {
  const docPath = 'docs/18F_CONTROLLED_WRITE_SMOKE_TEST_EXECUTION_PACKET.md';

  it('1. 18F document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F is documentation/test-only');
  });

  it('3. Document states 18F creates an execution packet/runbook only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F creates an execution packet/runbook only');
  });

  it('4. Document states 18F does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F does not execute controlled write smoke test');
  });

  it('5. Document states 18F does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F does not execute any write transaction');
  });

  it('6. Document states 18F does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('7. Document states 18F does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18F does not execute rollback');
  });

  it('8. Document references 18A, 18B, 18C, 18D, and 18E correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines the Real UAT preparation framework');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides the result review and defect triage framework');
    expect(source).toContain('18D provides the controlled write smoke test readiness review framework');
    expect(source).toContain('18E provides the controlled write smoke test authorization review framework');
  });

  it('9. Document contains Execution Authorization Prerequisite', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Execution Authorization Prerequisite');
  });

  it('10. Document contains Approved Execution Scope Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Approved Execution Scope Register');
  });

  it('11. Document contains Pre-Execution Checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Pre-Execution Checklist');
  });

  it('12. Document contains Execution Step Recording Table', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Execution Step Recording Table');
  });

  it('13. Document contains Evidence Capture Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Capture Register');
  });

  it('14. Document contains Stop Condition Control', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Stop Condition Control');
  });

  it('15. Document contains Rollback Recording Section', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Rollback Recording Section');
  });

  it('16. Document contains Execution Result Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Execution Result Classification');
  });

  it('17. Document contains Post-Execution Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Post-Execution Review Block');
  });

  it('18. Document contains Incident / Defect Log', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Incident / Defect Log');
  });

  it('19. Document states execution status is NOT EXECUTED IN 18F', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('NOT EXECUTED IN 18F');
  });

  it('20. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18F', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18F');
  });

  it('21. Document states FINAL GO is NOT AUTHORIZED IN 18F', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18F');
  });

  it('22. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
  });

  it('23. Document recommends 18G Controlled Write Smoke Test Execution Result Review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18G Controlled Write Smoke Test Execution Result Review');
  });

  it('24. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, actual write execution completion, smoke test execution completion, or FINAL GO approval', () => {
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
    expect(source).not.toMatch(/Execution completed/i);
    expect(source).not.toMatch(/Rollback executed/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
  });
});
