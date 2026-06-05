import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15T_UAT_FINAL_SIGN_OFF_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15T UAT Final Sign-Off Review', () => {
  it('creates the document and states safety scope', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('final uat sign-off review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
  });

  it('lists all required modules', () => {
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
    ].forEach((moduleName) => expect(content).toContain(moduleName));
  });

  it('includes PASS / HOLD / FAIL and evidence requirements', () => {
    const content = readDoc();

    expect(content).toContain('PASS:');
    expect(content).toContain('HOLD:');
    expect(content).toContain('FAIL:');
    expect(content).toContain('Screenshot');
    expect(content).toContain('SQL result where applicable');
    expect(content).toContain('Document number');
    expect(content).toContain('Tester name');
    expect(content).toContain('Timestamp');
    expect(content).toContain('Issue reference if failed');
  });

  it('includes final decision options and required sign-offs', () => {
    const content = readDoc();

    expect(content).toContain('READY FOR PRODUCTION GATE');
    expect(content).toContain('HOLD');
    expect(content).toContain('NO-GO');
    expect(content).toContain('Warehouse manager');
    expect(content).toContain('System admin');
    expect(content).toContain('Business owner');
    expect(content).toContain('Accounting/finance');
  });

  it('keeps Production on hold and includes gate phrases', () => {
    const content = readDoc();

    expect(content).toContain('Production remains HOLD');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });
});
