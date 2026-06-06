import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/17A_UI_UX_DESIGN_REVIEW_AND_MOCKUP.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('17A UI/UX Design Review and Mockup', () => {
  it('creates the specification and states sprint boundaries', () => {
    const content = readDoc().toLowerCase();

    expect(fs.existsSync(docPath)).toBe(true);
    expect(content).toContain('ui/ux design review and mockup only');
    expect(content).toContain('no runtime ui implementation');
    expect(content).toContain('no production touched');
    expect(content).toContain('no migration applied');
    expect(content).toContain('no feature gate changed');
  });

  it('locks the black and gold direction and complete palette', () => {
    const content = readDoc();

    expect(content).toContain('Black & Gold Professional Warehouse UI');
    [
      '#111111',
      '#1b1b1b',
      '#1f1f1f',
      '#d4af37',
      '#bf9b2f',
      '#f4f5f7',
      '#ffffff',
      '#121826',
      '#667085',
      '#dbe1ea',
      '#12b76a',
      '#f59e0b',
      '#ef4444',
      '#3b82f6',
    ].forEach((color) => expect(content).toContain(color));
  });

  it('documents professional sidebar rules and required menu labels', () => {
    const content = readDoc();

    expect(content).toContain('Use full professional text menu labels');
    expect(content).toContain('Do not use cute emoji icons');
    expect(content).toContain('Do not use short code-only menu labels as the primary display');
    [
      'Dashboard',
      'Receiving',
      'Putaway',
      'Stock Balance',
      'Picking Confirmation',
      'Post Outbound',
      'Movement Ledger',
      'Users and Roles',
    ].forEach((label) => expect(content).toContain(label));
  });

  it('keeps production and feature gates explicit', () => {
    const content = readDoc();

    expect(content).toContain('Production remains HOLD');
    expect(content).toContain('Post Outbound feature gate default OFF');
    expect(content).toContain('FINAL GO: Apply Outbound migrations 025-030 to Production');
    expect(content).toContain('APPROVE CONTROLLED WRITE SMOKE: Outbound qty 1');
  });

  it('recommends the constrained app-shell implementation sprint', () => {
    const content = readDoc();

    expect(content).toContain('17B App Shell and Navigation UI Implementation');
  });
});
