import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15L_OUTBOUND_APPROVAL_PACKET_FILL_IN_TEMPLATE.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15L Outbound Approval Packet Fill-In Template', () => {
  it('creates the fill-in template document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('fill-in template only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this template does not authorize production apply by itself');
  });

  it('states current hold and 15K review status', () => {
    const content = readDoc();

    expect(content).toContain('Production apply status: HOLD');
    expect(content).toContain('Approval packet status from 15K: INCOMPLETE');
    expect(content).toContain('Gate decision from 15K: NOT READY FOR FINAL GO');
    expect(content).toContain('Current decision from 15K: NO-GO');
  });

  it('includes required fill-in fields', () => {
    const content = readDoc();

    expect(content).toContain('Production project ref');
    expect(content).toContain('PITR/backup confirmation');
    expect(content).toContain('Accounting/finance approval');
    expect(content).toContain('Rollback owner');
    expect(content).toContain('Feature gate default disabled confirmed');
    expect(content).toContain('Reversal/rollback risk accepted');
    expect(content).toContain('Weight behavior risk accepted or follow-up owner');
  });

  it('documents FINAL GO completion requirement', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO phrase must not be written until all fields are complete and reviewed');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
  });

  it('documents controlled write smoke hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
    expect(lowerContent).toContain('controlled write smoke remains hold');
  });

  it('recommends 15M and keeps Production on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15M Outbound Completed Approval Packet Review');
    expect(lowerContent).toContain('production remains hold');
  });
});
