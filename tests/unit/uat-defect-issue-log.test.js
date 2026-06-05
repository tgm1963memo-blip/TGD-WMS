import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15S_UAT_DEFECT_AND_ISSUE_LOG.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15S UAT Defect and Issue Log', () => {
  it('creates the document and states safety scope', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
  });

  it('includes issue log fields and severity levels', () => {
    const content = readDoc();

    [
      'Issue ID',
      'Module',
      'Severity',
      'Description',
      'Steps to reproduce',
      'Expected result',
      'Actual result',
      'Owner',
      'Target fix date',
      'Status',
      'Retest evidence',
      'Closure sign-off',
      'Critical',
      'High',
      'Medium',
      'Low',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('states Critical and High defects block go-live', () => {
    expect(readDoc()).toContain('Critical and High defects block go-live');
  });

  it('includes PASS / HOLD / FAIL, evidence, and gate phrases', () => {
    const content = readDoc();

    expect(content).toContain('PASS:');
    expect(content).toContain('HOLD:');
    expect(content).toContain('FAIL:');
    expect(content).toContain('Screenshot');
    expect(content).toContain('SQL result where applicable');
    expect(content).toContain('Production remains HOLD');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });
});
