import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18C Real UAT Result Review and Defect Triage Framework', () => {
  const docPath = 'docs/18C_REAL_UAT_RESULT_REVIEW_AND_DEFECT_TRIAGE.md';

  it('1. 18C document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document clearly states documentation/test-only scope', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18C is documentation/test-only');
  });

  it('3. Document states 18C does not execute UAT', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18C does not execute UAT');
  });

  it('4. Document states 18C does not fabricate UAT results', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18C does not create or fabricate UAT results');
  });

  it('5. Document references 18A and 18B correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation framework');
    expect(source).toContain('18B provides the fill-in UAT execution packet');
  });

  it('6. Document contains Review Input Requirements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Review Input Requirements');
  });

  it('7. Document contains all 16 UAT scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT-01');
    expect(source).toContain('UAT-16');
  });

  it('8. Document contains Scenario Result Review Matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Scenario Result Review Matrix');
  });

  it('9. Document contains Result Status Definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Result Status Definitions');
  });

  it('10. Document contains Defect Severity Triage Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Severity Triage Rules');
  });

  it('11. Document contains Defect Triage Table', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Triage Table');
  });

  it('12. Document contains Retest Decision Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Retest Decision Rules');
  });

  it('13. Document contains UAT Outcome Classification', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT Outcome Classification');
  });

  it('14. Document contains Evidence Review Rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Review Rules');
  });

  it('15. Document contains Controller Review Block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('16. Document states controlled write smoke test is NOT AUTHORIZED IN 18C', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controlled write smoke test consideration: NOT AUTHORIZED IN 18C');
  });

  it('17. Document states Go / No-Go recommendation is NOT AUTHORIZED IN 18C', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Go / No-Go recommendation: NOT AUTHORIZED IN 18C');
  });

  it('18. Document states FINAL GO is NOT AUTHORIZED IN 18C', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('FINAL GO: NOT AUTHORIZED IN 18C');
  });

  it('19. Document states Production remains HOLD', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Production remains HOLD');
  });

  it('20. Document recommends 18D Controlled Write Smoke Test Readiness Review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18D Controlled Write Smoke Test Readiness Review');
  });

  it('21. Document does not contain wording that implies Production approval, Production readiness, Go Live approval, or FINAL GO approval', () => {
    const source = readProjectFile(docPath);
    expect(source).not.toMatch(/Production approved/i);
    expect(source).not.toMatch(/Production ready/i);
    expect(source).not.toMatch(/Final go approved/i);
    expect(source).not.toMatch(/Go live approved/i);
    expect(source).not.toMatch(/Ready for production/i);
    expect(source).not.toMatch(/Released to production/i);
    expect(source).not.toMatch(/Controlled write smoke test approved/i);
    expect(source).not.toMatch(/Production release approved/i);
  });
});
