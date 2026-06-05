import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15K_OUTBOUND_PRODUCTION_APPROVAL_PACKET_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15K Outbound Production Approval Packet Review', () => {
  it('creates the approval packet review document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('approval packet review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this review does not authorize production apply');
  });

  it('states hold, incomplete, and no-go gate status', () => {
    const content = readDoc();

    expect(content).toContain('Production apply status: HOLD');
    expect(content).toContain('Approval packet status: INCOMPLETE');
    expect(content).toContain('Gate decision: NOT READY FOR FINAL GO');
    expect(content).toContain('Current decision: NO-GO');
  });

  it('lists required fields as missing', () => {
    const content = readDoc();

    expect(content).toContain('Production project ref: MISSING');
    expect(content).toContain('PITR/backup confirmation: MISSING');
    expect(content).toContain('Accounting/finance approval: MISSING');
    expect(content).toContain('Rollback owner: MISSING');
    expect(content).toContain('Reversal/rollback risk accepted: MISSING');
  });

  it('documents FINAL GO phrase and casual approval boundary', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('Casual approval such as โ€เธ•เนเธญโ€, โ€เนเธญเน€เธโ€, or โ€เธ—เธณเธ•เนเธญโ€ is not FINAL GO');
  });

  it('documents controlled write smoke hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(lowerContent).toContain('controlled write smoke remains hold');
  });

  it('recommends 15L and keeps Production on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15L Outbound Approval Packet Fill-In Template');
    expect(lowerContent).toContain('production remains hold');
  });
});
