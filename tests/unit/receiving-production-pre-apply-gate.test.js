import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/13J-AU_RECEIVING_PRODUCTION_PRE_APPLY_GATE.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Receiving Production Pre-Apply Gate', () => {
  it('mentions Production not touched', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('production is strictly not touched');
  });

  it('mentions PITR / backup requirement', () => {
    const content = readDoc().toLowerCase();
    expect(content).toMatch(/backup.*pitr|pitr.*backup/s);
  });

  it('mentions downtime window requirement', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('downtime window');
  });

  it('mentions operator approval requirement', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('operator approval');
  });

  it('lists migrations 020-024', () => {
    const content = readDoc();
    expect(content).toContain('020');
    expect(content).toContain('021');
    expect(content).toContain('022');
    expect(content).toContain('023');
    expect(content).toContain('024');
  });

  it('mentions do not proceed / stop conditions', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('do not proceed');
  });

  it('mentions final Go/No-Go', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('final go/no-go');
  });

  it('strictly forbids manual stock movement insert', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('no manual stock movement insert');
  });

  it('strictly forbids manual stock balance update', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('no manual stock balance update');
  });
});
