import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18L Defect Closure and Retest Review Framework', () => {
  const docPath = 'docs/18L_DEFECT_CLOSURE_AND_RETEST_REVIEW_FRAMEWORK.md';

  it('1. 18L document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18L is documentation/test-only');
    expect(source).toContain('18L does not fabricate defect closure or retest results');
    expect(source).toContain('18L does not approve Production Gate');
    expect(source).toContain('18L does not make Go/No-Go decision');
    expect(source).toContain('18L does not authorize FINAL GO');
    expect(source).toContain('18L does not release Production');
    expect(source).toContain('Production remains HOLD');
  });

  it('3. Document references 18A through 18K correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18K provides actual Real UAT result collection');
  });

  it('4. Document contains severity definitions', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Severity Definitions');
    expect(source).toContain('Critical');
    expect(source).toContain('High');
    expect(source).toContain('Medium');
    expect(source).toContain('Low');
    expect(source).toContain('Observation');
  });

  it('5. Document contains closure criteria', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Closure Criteria');
    expect(source).toContain('No defect may be marked closed without evidence');
  });

  it('6. Document contains retest rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Retest Requirement Matrix');
    expect(source).toContain('Retest Evidence Register');
    expect(source).toContain('Retest results must not overwrite original defect history');
  });

  it('7. Document contains reopened defect rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Reopened Defect Rules');
    expect(source).toContain('Reopened defects must link to original defect ID');
  });

  it('8. Document contains accepted risk rules', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Accepted Risk Rules');
  });

  it('9. Document contains controller block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('10. Document recommends 18M', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18M UAT Sign-off Readiness Review');
  });
});
