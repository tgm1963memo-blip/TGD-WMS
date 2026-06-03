import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/13J-AT_RECEIVING_PRODUCTION_APPLY_RUNBOOK.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Receiving Production Apply Runbook', () => {
  it('mentions Production not touched', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('production is strictly not touched');
  });

  it('mentions backup/snapshot requirement', () => {
    const content = readDoc().toLowerCase();
    expect(content).toMatch(/backup.*snapshot/s);
  });

  it('lists migrations 020-024', () => {
    const content = readDoc();
    expect(content).toContain('020');
    expect(content).toContain('021');
    expect(content).toContain('022');
    expect(content).toContain('023');
    expect(content).toContain('024');
  });

  it('mentions stop conditions', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('stop conditions');
  });

  it('mentions rollback/mitigation plan', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('rollback / mitigation');
  });

  it('strictly forbids manual stock balance update', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('no manual stock balance update');
  });

  it('strictly forbids manual stock movement insert', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('no manual stock movement insert');
  });

  it('mentions post-apply verification', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('post-apply verification');
  });

  it('includes final Go/No-Go sign-off', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('go/no-go sign-off');
  });
});
