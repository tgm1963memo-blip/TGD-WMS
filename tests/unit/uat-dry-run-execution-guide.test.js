import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15X_UAT_DRY_RUN_EXECUTION_GUIDE.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15X UAT Dry Run Execution Guide', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('uat dry run execution guide only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this guide does not authorize production apply');
  });

  it('lists the required execution order from login to final sign-off review', () => {
    const content = readDoc();

    [
      '1. Login and role access check',
      '2. Master data visibility check',
      '3. Receiving',
      '4. Putaway',
      '5. Transfer',
      '6. Adjustment',
      '7. Outbound Draft',
      '8. Reservation',
      '9. Pick Confirmation',
      '10. Post Outbound',
      '11. Barcode / handheld foundation',
      '12. Reporting/read-only review',
      '13. Evidence review',
      '14. Defect review',
      '15. Final sign-off review',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('includes all required UAT modules', () => {
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
    ].forEach((term) => expect(content).toContain(term));
  });

  it('documents evidence and defect handling requirements', () => {
    const content = readDoc();

    expect(content).toContain('EVID-15U-001');
    expect(content).toContain('UAT-ISSUE-001');
    expect(content).toContain('Critical and High defects block go-live');
    expect(content).toContain('Do not include passwords, tokens, API keys, Supabase anon/service keys, or database passwords');
    expect(content).toContain('UAT Dry Run Result');
  });

  it('documents production gate boundaries and next recommendation', () => {
    const content = readDoc();

    expect(content).toContain('Production remains HOLD');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(content).toContain('15Y UAT Dry Run Result Review');
  });
});
