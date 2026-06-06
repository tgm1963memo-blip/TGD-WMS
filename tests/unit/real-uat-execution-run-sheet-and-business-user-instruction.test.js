import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18J Real UAT Execution Run Sheet and Business User Instruction', () => {
  const docPath = 'docs/18J_REAL_UAT_EXECUTION_RUN_SHEET_AND_BUSINESS_USER_INSTRUCTION.md';

  it('1. 18J document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J is documentation/test-only');
  });

  it('3. Document states 18J creates Real UAT execution instructions and run sheet only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J creates Real UAT execution instructions and run sheet only');
  });

  it('4. Document states 18J does not execute UAT', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not execute UAT');
  });

  it('5. Document states 18J does not create or fabricate UAT results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not create or fabricate UAT results');
  });

  it('6. Document states 18J does not approve Production Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not approve Production Gate');
  });

  it('7. Document states 18J does not make Go/No-Go decision', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not make Go/No-Go decision');
  });

  it('8. Document states 18J does not authorize FINAL GO', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not authorize FINAL GO');
  });

  it('9. Document states 18J does not release Production', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not release Production');
  });

  it('10. Document states 18J does not execute controlled write smoke test', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not execute controlled write smoke test');
  });

  it('11. Document states 18J does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not execute any write transaction');
  });

  it('12. Document states 18J does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18J does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('13. Document references 18A through 18I correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
    expect(source).toContain('18C provides UAT result review and defect triage');
    expect(source).toContain('18D provides controlled write smoke test readiness review');
    expect(source).toContain('18E provides controlled write smoke test authorization review');
    expect(source).toContain('18F provides controlled write smoke test execution packet/runbook');
    expect(source).toContain('18G provides controlled write smoke test execution result review');
    expect(source).toContain('18H provides Production Gate Review readiness assessment');
    expect(source).toContain('18I provides Formal Production Gate Review packet');
  });

  it('14. Document contains UAT Execution Control Information', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT Execution Control Information');
  });

  it('15. Document contains Business User Instruction Summary', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Business User Instruction Summary');
  });

  it('16. Document contains UAT Role and Responsibility Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT Role and Responsibility Matrix');
  });

  it('17. Document contains User Assignment and Scenario Mapping', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('User Assignment and Scenario Mapping');
  });

  it('18. Document contains all 16 UAT scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT-01');
    expect(source).toContain('UAT-16');
  });

  it('19. Document contains Scenario Execution Run Sheet', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Scenario Execution Run Sheet');
  });

  it('20. Document contains Evidence Capture Instruction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Capture Instruction');
  });

  it('21. Document contains Defect Logging Instruction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Logging Instruction');
  });

  it('22. Document contains Stop and Escalation Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Stop and Escalation Rules');
  });

  it('23. Document contains Result Status Definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Result Status Definitions');
  });

  it('24. Document contains Daily UAT Summary Template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Daily UAT Summary Template');
  });

  it('25. Document contains Business Sign-off Return Sheet', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Business Sign-off Return Sheet');
  });

  it('26. Document contains Controller Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('27. Document states Actual UAT execution status is NOT EXECUTED IN 18J', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Actual UAT execution status: NOT EXECUTED IN 18J');
  });

  it('28. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18J', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18J');
  });

  it('29. Document states FINAL GO is NOT AUTHORIZED IN 18J', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18J');
  });

  it('30. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production status: HOLD');
  });

  it('31. Document recommends 18K Actual Real UAT Result Collection and Evidence Review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18K Actual Real UAT Result Collection and Evidence Review');
  });

  it('32. Document does not contain wording that implies UAT already executed, Production approval, Production readiness, Go Live approval, Production Gate approval, Go/No-Go approval, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/UAT completed/i);
    expect(source).not.toMatch(/UAT passed/i);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Production gate approved/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
    expect(source).not.toMatch(/Go decision approved/i);
    expect(source).not.toMatch(/Go\/No-Go approved/i);
    expect(source).not.toMatch(/Production gate passed/i);
  });
});
