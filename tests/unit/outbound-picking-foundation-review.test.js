import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/14A_OUTBOUND_PICKING_FOUNDATION_REVIEW.md');
function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Outbound Picking Foundation Review', () => {
  it('mentions outbound draft', () => {
    expect(readDoc().toLowerCase()).toContain('outbound draft');
  });
  it('mentions picking', () => {
    expect(readDoc().toLowerCase()).toContain('picking');
  });
  it('mentions reservation', () => {
    expect(readDoc().toLowerCase()).toContain('reservation');
  });
  it('mentions stock_movement out', () => {
    expect(readDoc().toLowerCase()).toContain('stock_movement');
    expect(readDoc().toLowerCase()).toContain('out');
  });
  it('mentions stock_balance decrease', () => {
    expect(readDoc().toLowerCase()).toContain('stock_balance');
    expect(readDoc().toLowerCase()).toContain('decrease');
  });
  it('mentions idempotency', () => {
    expect(readDoc().toLowerCase()).toContain('idempotent');
  });
  it('ensures no manual stock movement insert', () => {
    expect(readDoc().toLowerCase()).toContain('no manual stock movement insert');
  });
  it('ensures no manual stock balance update', () => {
    expect(readDoc().toLowerCase()).toContain('no manual stock balance update');
  });
  it('states production not touched', () => {
    expect(readDoc().toLowerCase()).toContain('production is strictly not touched');
  });
  it('mentions phased plan', () => {
    expect(readDoc().toLowerCase()).toContain('phased plan');
  });
});
