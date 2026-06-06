import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18P Production Release Approval Packet', () => {
  const docPath = 'docs/18P_PRODUCTION_RELEASE_APPROVAL_PACKET.md';

  it('1. 18P document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P is documentation/test-only');
  });

  it('3. Document states 18P creates Production Release Approval Packet template only', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P creates a Production Release Approval Packet template only');
  });

  it('4. Document states 18P does not approve Production release', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not approve Production release');
  });

  it('5. Document states 18P does not authorize Go Live', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not authorize Go Live');
  });

  it('6. Document states 18P does not authorize FINAL GO', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not authorize FINAL GO');
  });

  it('7. Document states 18P does not make actual Go/No-Go decision', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not make actual Go/No-Go decision');
  });

  it('8. Document states 18P does not release Production', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not release Production');
  });

  it('9. Document states 18P does not mark Production as ready', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not mark Production as ready');
  });

  it('10. Document states 18P does not execute any write transaction', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not execute any write transaction');
  });

  it('11. Document states 18P does not modify runtime/database/migration/RPC/Production/stock/ledger', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not modify runtime, database, migrations, RPC, stock, ledger, or Production data');
  });

  it('12. Document states 18P does not execute rollback', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not execute rollback');
  });

  it('13. Document states 18P does not fabricate UAT, smoke test, sign-off, or approval results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18P does not fabricate UAT, smoke test, sign-off, or approval results');
  });

  it('14. Document references 18A through 18O correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A through 18J prepare Real UAT and user execution instructions');
    expect(source).toContain('18O creates Production Release Readiness Checklist');
  });

  it('15. Document contains Production Release Approval Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Release Approval Input Requirements');
  });

  it('16. Document contains Release Approval Summary Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Approval Summary Matrix');
  });

  it('17. Document contains Release Scope Template', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Scope Template');
  });

  it('18. Document contains Production Release Approval Gate', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production Release Approval Gate');
  });

  it('19. Document contains No-Go Conditions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('No-Go Conditions');
  });

  it('20. Document contains Release Risk Register', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Risk Register');
  });

  it('21. Document contains Release Stop Conditions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Release Stop Conditions');
  });

  it('22. Document contains Controller Approval Packet Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Approval Packet Review Block');
  });

  it('23. Document states Production release approval is NOT AUTHORIZED IN 18P', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production release approval: NOT AUTHORIZED IN 18P');
  });

  it('24. Document states Go Live approval is NOT AUTHORIZED IN 18P', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go Live approval: NOT AUTHORIZED IN 18P');
  });

  it('25. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18P', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18P');
  });

  it('26. Document states FINAL GO is NOT AUTHORIZED IN 18P', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18P');
  });

  it('27. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
  });

  it('28. Document recommends 18Q Go Live Execution Plan and Cutover Runbook', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18Q Go Live Execution Plan and Cutover Runbook');
  });

  it('29. Document does not contain wording that implies Production approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Production release approved/i);
    expect(source).not.toMatch(/Final go granted/i);
    expect(source).not.toMatch(/Go decision approved/i);
    expect(source).not.toMatch(/Go\/No-Go approved/i);
    expect(source).not.toMatch(/Production gate passed/i);
    expect(source).not.toMatch(/Release approved/i);
  });
});
