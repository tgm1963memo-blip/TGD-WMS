import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18K Actual Real UAT Result Collection and Evidence Review', () => {
  const docPath = 'docs/18K_ACTUAL_REAL_UAT_RESULT_COLLECTION_AND_EVIDENCE_REVIEW.md';

  it('1. 18K document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18K is documentation/test-only');
    expect(source).toContain('18K does not execute UAT');
    expect(source).toContain('18K does not fabricate UAT results');
    expect(source).toContain('18K does not approve Production Gate');
    expect(source).toContain('18K does not make Go/No-Go decision');
    expect(source).toContain('18K does not authorize FINAL GO');
    expect(source).toContain('18K does not release Production');
    expect(source).toContain('Production remains HOLD');
  });

  it('3. Document references 18A through 18J correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18J provides Real UAT execution instructions and run sheet');
  });

  it('4. Document contains all 16 scenarios', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('UAT-01');
    expect(source).toContain('UAT-16');
  });

  it('5. Document contains evidence matrix', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Completeness Matrix');
  });

  it('6. Document contains defect intake', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Defect Intake Register');
  });

  it('7. Document contains evidence gap', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Evidence Gap Register');
  });

  it('8. Document contains controller block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Review Block');
  });

  it('9. Document recommends 18L', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18L Defect Closure and Retest Review Framework');
  });
});
