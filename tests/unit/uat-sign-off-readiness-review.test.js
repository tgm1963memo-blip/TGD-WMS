import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18M UAT Sign-off Readiness Review', () => {
  const docPath = 'docs/18M_UAT_SIGN_OFF_READINESS_REVIEW.md';

  it('1. 18M document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18M is documentation/test-only');
    expect(source).toContain('18M does not approve final UAT sign-off');
    expect(source).toContain('18M does not infer UAT pass');
    expect(source).toContain('18M does not approve Production Gate');
    expect(source).toContain('18M does not make Go/No-Go decision');
    expect(source).toContain('18M does not authorize FINAL GO');
    expect(source).toContain('18M does not release Production');
    expect(source).toContain('Production remains HOLD');
  });

  it('3. Document references 18A through 18L correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18L provides the defect closure and retest framework');
  });

  it('4. Document contains sign-off readiness matrices', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Business Sign-off Readiness Matrix');
    expect(source).toContain('Technical Sign-off Readiness Matrix');
  });

  it('5. Document contains evidence review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Completeness Review');
  });

  it('6. Document contains defect closure review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Closure Readiness Review');
  });

  it('7. Document contains risk review', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Open Risk Review');
  });

  it('8. Document contains training/support readiness', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('User Training Readiness Review');
    expect(source).toContain('Support Readiness Review');
  });

  it('9. Document contains controller block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('10. Document recommends 18N', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18N Go/No-Go Decision Packet Draft');
  });
});
