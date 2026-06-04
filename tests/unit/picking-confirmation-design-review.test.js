import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/14S_PICKING_CONFIRMATION_DESIGN_REVIEW.md');

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

function readDocNormalized() {
  return readDoc().toLowerCase().replace(/\*\*/g, '');
}

describe('Sprint 14S picking confirmation design review', () => {
  it('creates the design review document', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('states design review only and safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('design review only');
    expect(doc).toContain('no production touched');
    expect(doc).toContain('no migration applied');
    expect(doc).toContain('no stock_movement out');
    expect(doc).toContain('no stock_balance update');
  });

  it('documents future confirm pick business rules', () => {
    const doc = readDocNormalized();

    expect(doc).toContain('picked_quantity > 0');
    expect(doc).toContain('must not exceed');
    expect(doc).toContain('reserved_quantity');
    expect(doc).toContain('reservation status must be active');
    expect(doc).toContain('released');
    expect(doc).toContain('cannot be picked');
  });

  it('documents confirm pick must not post stock and defers decrease to post outbound', () => {
    const doc = readDocNormalized();

    expect(doc).toContain('confirm pick must not create stock_movement out');
    expect(doc).toContain('stock decrease belongs only to a future post outbound sprint');
  });

  it('recommends 14T and requires separate approval for implementation', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('14t controlled pick confirmation rpc draft');
    expect(doc).toContain('next implementation sprint must be separately approved');
  });
});
