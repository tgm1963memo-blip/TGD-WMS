import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/15H_OUTBOUND_PRODUCTION_DRY_RUN_CHECKLIST.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('15H Outbound Production Dry Run Checklist', () => {
  it('creates the dry run checklist document', () => {
    expect(fs.existsSync(docPath)).toBe(true);
  });

  it('states scope and safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('dry run checklist only');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no runtime code changed');
  });

  it('lists migrations 025 through 030', () => {
    const content = readDoc();

    expect(content).toContain('025_tgd_wms_outbound_picking_foundation.sql');
    expect(content).toContain('026_tgd_wms_outbound_picking_rpc_draft.sql');
    expect(content).toContain('027_tgd_wms_outbound_readonly_rls.sql');
    expect(content).toContain('028_tgd_wms_outbound_grant_hardening.sql');
    expect(content).toContain('029_tgd_wms_controlled_pick_confirmation_rpc_draft.sql');
    expect(content).toContain('030_tgd_wms_post_outbound_rpc_draft.sql');
  });

  it('documents dry run operator controls', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('copy sql content, not filename');
    expect(content).toContain('apply one migration at a time');
    expect(content).toContain('stop immediately on error');
    expect(content).toContain('feature gate default disabled');
  });

  it('documents post-apply stock and smoke safety boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(content).toContain('stock balance baseline unchanged immediately after migration apply');
    expect(content).toContain('production write smoke only after separate approval');
    expect(content).toContain('rollback/reversal risk is explicitly accepted');
    expect(content).toContain('reversal/rollback risk accepted');
  });

  it('includes the exact FINAL GO phrase', () => {
    const content = readDoc();

    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
  });

  it('recommends 15I and keeps Production on hold', () => {
    const content = readDoc();
    const lowerContent = content.toLowerCase();

    expect(content).toContain('15I Outbound Production Apply Gate Review');
    expect(lowerContent).toContain('production remains hold');
  });
});
