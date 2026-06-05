import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15C_POST_OUTBOUND_UI_DESIGN_REVIEW.md');

function readDoc() {
  return readFileSync(docPath, 'utf8');
}

describe('Sprint 15C post outbound UI design review', () => {
  it('creates the UI design review document', () => {
    expect(existsSync(docPath)).toBe(true);
  });

  it('documents design-only scope and safety boundaries', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('design review only');
    expect(doc).toContain('no ui post outbound button added');
    expect(doc).toContain('no service call from ui');
    expect(doc).toContain('no migration applied');
    expect(doc).toContain('no production touched');
  });

  it('documents future entry point and gating rules', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('document status is `picked`');
    expect(doc).toContain('all lines are fully picked');
    expect(doc).toContain('every line is fully picked');
    expect(doc).toContain('feature flag or environment gate');
  });

  it('documents validation and confirmation modal requirements', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('`post_reference` required');
    expect(doc).toContain('confirmation modal');
    expect(doc).toContain('confirm / cancel buttons');
    expect(doc).toContain('user confirms stock decrease warning');
  });

  it('documents stock impact and reversal boundary', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('stock balance decreases');
    expect(doc).toContain('stock_balance');
    expect(doc).toContain('`pick_confirm` movement');
    expect(doc).toContain('reversal requires separate controlled process');
  });

  it('documents permission model and audit fields', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('only `admin` / `warehouse_manager`');
    expect(doc).toContain('customer-scoped users should not post');
    expect(doc).toContain('unauthenticated users cannot post');
    expect(doc).toContain('posted_by');
    expect(doc).toContain('posted_at');
  });

  it('recommends the next sprint with approval gate', () => {
    const doc = readDoc().toLowerCase();

    expect(doc).toContain('15d post outbound ui draft');
    expect(doc).toContain('feature flag or hidden route/gate');
    expect(doc).toContain('controller approval required before commit');
  });
});
