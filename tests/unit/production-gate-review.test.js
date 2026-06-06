import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/16A_PRODUCTION_GATE_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('16A Production Gate Review', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('production gate review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this review does not authorize production apply by itself');
  });

  it('states current gate status values', () => {
    const content = readDoc();

    [
      'Production gate status: HOLD',
      'Evidence pack status: PENDING ACTUAL EVIDENCE',
      'Approval packet status: PENDING ACTUAL APPROVALS',
      'UAT sign-off status: PENDING ACTUAL SIGN-OFF',
      'Backup/PITR status: PENDING CONFIRMATION',
      'Maintenance window status: PENDING CONFIRMATION',
      'Current decision: HOLD',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('documents decision options and casual approval boundary', () => {
    const content = readDoc();

    ['READY FOR FINAL GO', 'HOLD', 'NO-GO'].forEach((term) => expect(content).toContain(term));
    expect(content).toContain('FINAL GO must not be accepted from casual approval');
  });

  it('documents final go and controlled write smoke gates', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(content).toContain('Controlled write smoke remains HOLD');
  });

  it('recommends next sprint and keeps production on hold', () => {
    const content = readDoc();

    expect(content).toContain('16B Production Gate Fill-In Packet');
    expect(content).toContain('Production remains HOLD');
  });
});
