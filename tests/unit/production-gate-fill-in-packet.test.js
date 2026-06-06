import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/16B_PRODUCTION_GATE_FILL_IN_PACKET.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('16B Production Gate Fill-In Packet', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('production gate fill-in packet only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this fill-in packet does not authorize production apply by itself');
    expect(content).toContain('production remains hold');
  });

  it('keeps incomplete values on hold', () => {
    const content = readDoc();

    expect(content).toContain('Blank, TBD, unknown, or missing values keep the gate in HOLD');
  });

  it('includes every required fill-in section', () => {
    const content = readDoc();

    [
      'UAT Execution Summary',
      'Defect / Issue Summary',
      'Final UAT Sign-Off',
      'Approval Packet',
      'Production Project Confirmation',
      'Backup / PITR Confirmation',
      'Maintenance Window',
      'Rollback / Reversal Owner',
      'Communication Plan',
      'Production Verification Plan',
      'Controlled Write Smoke Plan',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('documents decision options and final-go boundaries', () => {
    const content = readDoc();

    ['READY FOR FINAL GO REVIEW', 'HOLD', 'NO-GO'].forEach((term) => expect(content).toContain(term));
    expect(content).toContain('FINAL GO must not be inferred from completed fields');
    expect(content).toContain('Casual approval such as โ€เธ•เนเธญโ€, โ€เนเธญเน€เธโ€, or โ€เธ—เธณเธ•เนเธญโ€ is not FINAL GO');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });

  it('recommends the filled-packet review sprint', () => {
    const content = readDoc();

    expect(content).toContain('16C Production Gate Filled Packet Review');
  });
});
