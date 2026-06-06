import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(testDir, '..', '..');

function readProjectFile(path) {
  return readFileSync(resolve(projectRoot, path), 'utf8');
}

describe('18N Go/No-Go Decision Packet Draft', () => {
  const docPath = 'docs/18N_GO_NO_GO_DECISION_PACKET_DRAFT.md';

  it('1. 18N document exists', () => {
    expect(existsSync(resolve(projectRoot, docPath))).toBe(true);
    expect(statSync(resolve(projectRoot, docPath)).isFile()).toBe(true);
  });

  it('2. Document contains safety statements', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18N is documentation/test-only');
    expect(source).toContain('18N does not make actual Go/No-Go decision');
    expect(source).toContain('18N does not authorize FINAL GO');
    expect(source).toContain('18N does not release Production');
    expect(source).toContain('18N does not mark Production as ready');
    expect(source).toContain('Production remains HOLD');
  });

  it('3. Document references 18A through 18M correctly', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18A defines Real UAT preparation');
    expect(source).toContain('18M provides the sign-off readiness review framework');
  });

  it('4. Document contains decision evidence register and criteria', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Decision Evidence Register');
    expect(source).toContain('Decision Criteria Matrix');
  });

  it('5. Document contains defect and risk summaries', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Open Defect Summary');
    expect(source).toContain('Open Risk Summary');
  });

  it('6. Document contains readiness summaries', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Business Readiness Summary');
    expect(source).toContain('Technical Readiness Summary');
    expect(source).toContain('Support Readiness Summary');
    expect(source).toContain('Rollback Readiness Summary');
  });

  it('7. Document contains decision options', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Decision Options');
    expect(source).toContain('NO-GO');
    expect(source).toContain('CONDITIONAL GO REQUIRING EXPLICIT APPROVAL');
    expect(source).toContain('GO DECISION REVIEW READY');
  });

  it('8. Document contains controller block', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('Controller Decision Draft Block');
  });

  it('9. Document recommends 18O', () => {
    const source = readProjectFile(docPath);
    expect(source).toContain('18O Production Release Readiness Checklist');
  });
});
