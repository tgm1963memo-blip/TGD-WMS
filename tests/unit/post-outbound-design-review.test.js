import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/14Y_POST_OUTBOUND_DESIGN_REVIEW.md');

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 14Y post outbound design review', () => {
  it('creates the design review document', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('documents design-only scope and safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('design review only');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no migration applied');
    expect(doc).toContain('no stock_movement out created');
    expect(doc).toContain('no stock_balance update/decrease');
    expect(doc).toContain('no ui post outbound button');
  });

  it('mentions the future RPC concept without creating it in this sprint', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('tgd_rpc_post_outbound_document');
    expect(doc).toContain('future rpc idea only');
    expect(doc).toContain('this sprint does not create it');
    expect(doc).toContain('next implementation sprint must be separately approved');
  });

  it('documents future post outbound business rules', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('outbound_document_id` required uuid');
    expect(doc).toContain('all lines must be fully picked');
    expect(doc).toContain('stock_balance must never go negative');
    expect(doc).toContain('post_reference` should be required');
    expect(doc).toContain('no duplicate stock movements');
  });

  it('documents reversal and production approval gates', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('reversal creates opposite movement');
    expect(doc).toContain('production explicit final go required later');
  });

  it('recommends the next controlled sprint', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('14z post outbound rpc draft');
    expect(doc).toContain('migration draft only first');
    expect(doc).toContain('no staging apply until a separate approval gate');
  });
});
