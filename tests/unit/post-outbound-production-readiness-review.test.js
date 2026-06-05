import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15G_POST_OUTBOUND_PRODUCTION_READINESS_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15G Post Outbound Production Readiness Review', () => {
  it('creates the readiness review document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states the scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('production readiness review only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
  });

  it('records current staging stock evidence', () => {
    const content = readDoc();

    expect(content).toContain('movement_count = 16');
    expect(content).toContain('stock_balance quantity = 1018');
    expect(content).toContain('stock_balance weight = 1000');
  });

  it('lists migrations 025 through 030', () => {
    const content = readDoc();

    expect(content).toContain('025');
    expect(content).toContain('026');
    expect(content).toContain('027');
    expect(content).toContain('028');
    expect(content).toContain('029');
    expect(content).toContain('030');
  });

  it('documents feature gate and rollback risk', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('feature gate disabled');
    expect(content).toContain('rollback/reversal not yet implemented risk');
  });

  it('includes the exact FINAL GO phrase and required approval fields', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('Production project ref:');
    expect(content).toContain('PITR/backup:');
    expect(content).toContain('Warehouse manager approval:');
    expect(content).toContain('Accounting/finance approval:');
  });

  it('recommends the dry run sprint and keeps Production apply on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15H Outbound Production Dry Run Checklist');
    expect(lowerContent).toContain('no production apply until explicit final go');
  });
});
