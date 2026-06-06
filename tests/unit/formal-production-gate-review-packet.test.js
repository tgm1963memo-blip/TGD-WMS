import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18I Formal Production Gate Review Packet', () => {
  const docPath = 'docs/18I_FORMAL_PRODUCTION_GATE_REVIEW_PACKET.md';

  it('1. 18I document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I is documentation/test-only');
  });

  it('3. Document states 18I creates Formal Production Gate Review packet only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I creates a Formal Production Gate Review packet only');
  });

  it('4. Document states 18I does not approve Production Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not approve Production Gate');
  });

  it('5. Document states 18I does not make Go/No-Go decision', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not make Go/No-Go decision');
  });

  it('6. Document states 18I does not authorize FINAL GO', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not authorize FINAL GO');
  });

  it('7. Document states 18I does not release Production', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not release Production');
  });

  it('8. Document states 18I does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not execute controlled write smoke test');
  });

  it('9. Document states 18I does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not execute any write transaction');
  });

  it('10. Document states 18I does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('11. Document states 18I does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not execute rollback');
  });

  it('12. Document states 18I does not fabricate UAT or smoke test results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18I does not fabricate UAT or smoke test results');
  });

  it('13. Document references 18A through 18H correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides UAT result review and defect triage');
    expect(source).toContain('18D provides controlled write smoke test readiness review');
    expect(source).toContain('18E provides controlled write smoke test authorization review');
    expect(source).toContain('18F provides controlled write smoke test execution packet/runbook');
    expect(source).toContain('18G provides controlled write smoke test execution result review');
    expect(source).toContain('18H provides Production Gate Review readiness assessment');
  });

  it('14. Document contains Production Gate Packet Input Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Packet Input Register');
  });

  it('15. Document contains Executive Gate Summary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Executive Gate Summary');
  });

  it('16. Document contains Gate Evidence Checklist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Gate Evidence Checklist');
  });

  it('17. Document contains Formal Gate Review Agenda Template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Formal Gate Review Agenda Template');
  });

  it('18. Document contains Decision Options for Later Production Gate Review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Decision Options for Later Production Gate Review');
  });

  it('19. Document contains Open Item Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Open Item Register');
  });

  it('20. Document contains Production Gate Risk Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Risk Register');
  });

  it('21. Document contains Sign-off Packet Section', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Sign-off Packet Section');
  });

  it('22. Document contains Controller Gate Packet Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Gate Packet Review Block');
  });

  it('23. Document states Production Gate Review packet decision is NOT AUTHORIZED IN 18I', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Gate Review packet decision: NOT AUTHORIZED IN 18I');
  });

  it('24. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18I', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18I');
  });

  it('25. Document states FINAL GO is NOT AUTHORIZED IN 18I', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18I');
  });

  it('26. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production status: HOLD');
  });

  it('27. Document recommends 18J Real UAT Execution Run Sheet and Business User Instruction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J Real UAT Execution Run Sheet and Business User Instruction');
  });

  it('28. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, Production Gate approval, Go/No-Go approval, or FINAL GO approval', () => {
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
    expect(source).not.toMatch(/Go\/No-Go approved/i);
    expect(source).not.toMatch(/Production gate passed/i);
  });
});
