import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/13J-AW_RECEIVING_PRODUCTION_FINAL_GO_CHECKLIST.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Receiving Production Final GO Checklist', () => {
  it('mentions Production not touched', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('production is strictly not touched');
  });

  it('mentions final GO', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('final go');
  });

  it('mentions business owner approval', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('business owner approval');
  });

  it('mentions system admin approval', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('system admin approval');
  });

  it('mentions warehouse manager approval', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('warehouse manager approval');
  });

  it('mentions Production project ref', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('production project ref');
  });

  it('mentions PITR / backup', () => {
    const content = readDoc().toLowerCase();
    expect(content).toMatch(/pitr.*backup/s);
  });

  it('mentions downtime window', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('downtime window');
  });

  it('mentions rollback owner', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('rollback owner');
  });

  it('mentions operator availability', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('operator availability');
  });

  it('mentions post-apply verifier', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('post-apply verifier');
  });

  it('mentions GO / NO-GO', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('go / no-go');
  });

  it('mentions do not run production apply until approved', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('do not run production apply until every checkbox is approved');
  });
});
