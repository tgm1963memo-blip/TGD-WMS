import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/13J-AV_RECEIVING_PRODUCTION_APPLY_COMMAND_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Receiving Production Apply Command Review', () => {
  it('mentions Production not touched', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('production is strictly not touched');
  });

  it('mentions final GO required', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('final go');
  });

  it('lists migrations 020-024', () => {
    const content = readDoc();
    expect(content).toContain('020');
    expect(content).toContain('021');
    expect(content).toContain('022');
    expect(content).toContain('023');
    expect(content).toContain('024');
  });

  it('mentions npx supabase db push --linked command', () => {
    const content = readDoc();
    expect(content).toContain('npx supabase db push --linked');
  });

  it('mentions PITR restore', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('pitr restore');
  });

  it('mentions post-apply read-only SQL', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('post-apply read-only sql');
  });

  it('mentions stop conditions', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('stop conditions');
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
