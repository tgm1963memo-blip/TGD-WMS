import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15U_UAT_EXECUTION_RESULT_RECORDING.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15U UAT Execution Result Recording', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('production remains hold');
  });

  it('lists required UAT modules', () => {
    const content = readDoc();

    [
      'Receiving',
      'Putaway',
      'Transfer',
      'Adjustment',
      'Outbound Draft',
      'Reservation',
      'Pick Confirmation',
      'Post Outbound',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('includes result values and required IDs', () => {
    const content = readDoc();

    ['PASS', 'HOLD', 'FAIL', 'NOT TESTED'].forEach((term) => expect(content).toContain(term));
    expect(content).toContain('EVID-15U-001');
    expect(content).toContain('UAT-ISSUE-001');
  });

  it('documents blocker rules and gate phrases', () => {
    const content = readDoc();

    expect(content).toContain('Critical/High issues block go-live');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });
});
