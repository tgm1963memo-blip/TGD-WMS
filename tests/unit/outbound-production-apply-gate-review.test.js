import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15I_OUTBOUND_PRODUCTION_APPLY_GATE_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15I Outbound Production Apply Gate Review', () => {
  it('creates the apply gate review document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('apply gate review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
  });

  it('states the current gate decision', () => {
    const content = readDoc();

    expect(content).toContain('Production apply status: HOLD');
    expect(content).toContain('Gate decision: NOT READY FOR PRODUCTION APPLY');
  });

  it('lists missing approvals and readiness fields', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('required stakeholder approvals');
    expect(content).toContain('production project ref');
    expect(content).toContain('pitr/backup');
    expect(content).toContain('rollback/reversal risk acceptance');
  });

  it('documents FINAL GO controls and smoke approval boundary', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('explicit final go phrase is required');
    expect(content).toContain('the phrase alone is not enough unless required fields are completed');
    expect(content).toContain('controlled write smoke requires separate explicit approval');
  });

  it('includes the exact FINAL GO phrase', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
  });

  it('recommends 15J and keeps Production on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15J Outbound Production Approval Packet');
    expect(lowerContent).toContain('production remains hold');
  });
});
