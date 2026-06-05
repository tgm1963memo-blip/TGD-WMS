import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15Z_PRODUCTION_GATE_EVIDENCE_PACK.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15Z Production Gate Evidence Pack', () => {
  it('creates the document and states safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('production gate evidence pack only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
    expect(content).toContain('this evidence pack does not authorize production apply by itself');
    expect(content).toContain('production remains hold');
  });

  it('lists required evidence categories and default status', () => {
    const content = readDoc();

    [
      'PENDING ACTUAL EVIDENCE',
      'UAT execution results',
      'UAT evidence index',
      'Defect / issue log',
      'Final UAT sign-off',
      'Approval packet completion',
      'Backup / PITR confirmation',
      'Maintenance window confirmation',
      'Production project ref confirmation',
      'Feature gate default disabled confirmation',
      'Rollback owner / reversal risk acceptance',
    ].forEach((term) => expect(content).toContain(term));
  });

  it('documents decision options and evidence quality rules', () => {
    const content = readDoc();

    ['READY FOR FINAL GO REVIEW', 'HOLD', 'NO-GO'].forEach((term) => expect(content).toContain(term));
    expect(content).toContain('Evidence must not include passwords, tokens, API keys, Supabase anon/service keys, service role keys, or database passwords');
  });

  it('documents production boundary phrases and casual approval rule', () => {
    const content = readDoc();

    expect(content).toContain('Casual approval such as โ€เธ•เนเธญโ€, โ€เนเธญเน€เธโ€, or โ€เธ—เธณเธ•เนเธญโ€ is not FINAL GO');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });

  it('recommends the next gate review sprint', () => {
    const content = readDoc();

    expect(content).toContain('16A Production Gate Review');
  });
});
