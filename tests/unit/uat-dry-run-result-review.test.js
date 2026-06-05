import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15Y_UAT_DRY_RUN_RESULT_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15Y UAT Dry Run Result Review', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('uat dry run result review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this review does not authorize production apply');
  });

  it('states current pending review status and hold decision', () => {
    const content = readDoc();

    [
      'UAT execution status: PENDING ACTUAL RESULTS',
      'Evidence status: PENDING ACTUAL EVIDENCE',
      'Defect status: PENDING ACTUAL DEFECT LOG',
      'Sign-off status: PENDING ACTUAL SIGN-OFF',
      'Production apply status: HOLD',
      'Current decision: HOLD',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('includes all required UAT modules and result states', () => {
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
      'Barcode / handheld foundation',
      'Role and permission checks',
      'PASS',
      'HOLD',
      'FAIL',
      'NOT TESTED',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('documents evidence and defect review requirements', () => {
    const content = readDoc();

    expect(content).toContain('EVID-15U-001');
    expect(content).toContain('UAT-ISSUE-001');
    expect(content).toContain('Critical/High defects block go-live');
    expect(content).toContain('Evidence must not include passwords, tokens, API keys, Supabase anon/service keys, or database passwords');
  });

  it('documents decision options, production gate boundaries, and next recommendation', () => {
    const content = readDoc();

    ['READY FOR PRODUCTION GATE', 'HOLD', 'NO-GO'].forEach((term) => expect(content).toContain(term));
    expect(content).toContain('Production remains HOLD');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(content).toContain('15Z Production Gate Evidence Pack');
  });
});
