import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/14N_OUTBOUND_DATA_QUALITY_UAT_CHECKLIST.md');

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14N outbound data quality and UAT checklist', () => {
  it('creates the UAT checklist document', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('contains UAT checklist and required field review sections', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('uat checklist');
    expect(doc).toContain('required field review');
  });

  it('documents required outbound fields and quantity rules', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('document_no` required');
    expect(doc).toContain('customer_id` required');
    expect(doc).toContain('requested_quantity > 0');
    expect(doc).toContain('reserved_quantity > 0');
    expect(doc).toContain('reservation_id` required');
  });

  it('documents smoke data inventory and cleanup boundary', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('smoke data inventory');
    expect(doc).toContain('smoke-out-14f-002');
    expect(doc).toContain('smoke-ui-14i-001');
    expect(doc).toContain('smoke-ui-14i-retest-001');
    expect(doc).toContain('do not delete in this sprint');
    expect(doc).toContain('no delete/truncate smoke data');
  });

  it('documents safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('no production touched');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
    expect(doc).toContain('no stock posting');
  });

  it('recommends picking workflow draft UI before post outbound', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('14o picking workflow draft ui');
    expect(doc).toContain('14o post outbound design review only');
    expect(doc).toContain('picking workflow draft ui before post outbound');
  });
});
