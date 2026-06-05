import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15J_OUTBOUND_PRODUCTION_APPROVAL_PACKET.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15J Outbound Production Approval Packet', () => {
  it('creates the approval packet document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('production approval packet only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this document does not authorize production apply by itself');
  });

  it('states current production hold and gate decision', () => {
    const content = readDoc();

    expect(content).toContain('Production apply status: HOLD');
    expect(content).toContain('Gate decision from 15I: NOT READY FOR PRODUCTION APPLY');
  });

  it('includes required approval fields', () => {
    const content = readDoc();

    expect(content).toContain('Production project ref:');
    expect(content).toContain('PITR/backup confirmation:');
    expect(content).toContain('Accounting/finance approval:');
    expect(content).toContain('Rollback owner:');
    expect(content).toContain('Feature gate default disabled confirmed:');
    expect(content).toContain('Reversal/rollback risk accepted:');
  });

  it('documents FINAL GO constraints', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('the final go phrase is required but not sufficient alone');
    expect(content).toContain('controlled write smoke requires separate approval');
    expect(content).toContain('controlled write smoke needs separate explicit approval');
  });

  it('includes exact approval phrases', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });

  it('recommends 15K and keeps Production on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15K Outbound Production Approval Packet Review');
    expect(lowerContent).toContain('production remains hold');
  });
});
