import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18B Real UAT Execution Packet Fill-In', () => {
  const docPath = 'docs/18B_REAL_UAT_EXECUTION_PACKET_FILL_IN.md';

  it('1. 18B document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18B is documentation/test-only');
  });

  it('3. Document clearly states no runtime/database/migration/Production changes', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('No runtime, database, migration, Production, stock, or FINAL GO action is performed');
  });

  it('4. Document contains all 16 UAT scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT-01');
    expect(source).toContain('UAT-02');
    expect(source).toContain('UAT-03');
    expect(source).toContain('UAT-04');
    expect(source).toContain('UAT-05');
    expect(source).toContain('UAT-06');
    expect(source).toContain('UAT-07');
    expect(source).toContain('UAT-08');
    expect(source).toContain('UAT-09');
    expect(source).toContain('UAT-10');
    expect(source).toContain('UAT-11');
    expect(source).toContain('UAT-12');
    expect(source).toContain('UAT-13');
    expect(source).toContain('UAT-14');
    expect(source).toContain('UAT-15');
    expect(source).toContain('UAT-16');
  });

  it('5. Scenario actual result/status/evidence/sign-off areas remain placeholders', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('PENDING CONFIRMATION');
    expect(source).toContain('PENDING REVIEW');
    expect(source).toContain('PENDING DEFECT LOG');
    expect(source).toContain('PENDING SIGN-OFF');
  });

  it('6. Environment Confirmation Block exists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Environment Confirmation Block');
  });

  it('7. User Assignment Matrix exists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('User Assignment Matrix');
  });

  it('8. Defect Log exists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Log');
  });

  it('9. Evidence Register exists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Register');
  });

  it('10. Sign-off Checklist exists', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Sign-off Checklist');
  });

  it('11. Decision Rules exist', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Decision Rules');
  });

  it('12. FINAL GO must not be inferred', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO must not be inferred');
  });

  it('13. Production remains HOLD unless explicitly released later', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD unless explicitly released by a later approved phase');
  });

  it('14. 18C Real UAT Result Review and Defect Triage is recommended', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18C Real UAT Result Review and Defect Triage');
  });

  it('15. Document does not contain wording that implies Production approval, Production readiness, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
  });
});
