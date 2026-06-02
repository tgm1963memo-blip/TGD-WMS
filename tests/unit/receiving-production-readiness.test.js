import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const docPath = path.join(process.cwd(), 'docs/13J-AS_RECEIVING_PRODUCTION_READINESS_REVIEW.md');

function readDoc() {
  if (!fs.existsSync(docPath)) return '';
  return fs.readFileSync(docPath, 'utf8');
}

describe('Receiving Production Readiness Review', () => {
  it('production readiness doc exists and mentions no Production touched', () => {
    expect(fs.existsSync(docPath)).toBe(true);
    const content = readDoc().toLowerCase();
    expect(content).toContain('no production touched');
  });

  it('doc mentions migration 024 schema drift alignment', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('schema drift alignment');
    expect(content).toContain('024');
  });

  it('doc mentions anon blocked requirement', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('anon blocked');
  });

  it('doc mentions no manual stock balance updates', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('no manual stock balance updates');
  });

  it('doc mentions rollback/stop conditions', () => {
    const content = readDoc().toLowerCase();
    expect(content).toContain('rollback/stop conditions');
  });
});
