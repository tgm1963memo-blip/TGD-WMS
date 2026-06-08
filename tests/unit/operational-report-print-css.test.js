import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('20B operational report print CSS', () => {
  it('contains A4 print-ready operational report styles', () => {
    const cssPath = path.resolve(process.cwd(), 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    expect(css).toContain('.operational-report-a4');
    expect(css).toContain('max-width: 210mm');
    expect(css).toContain('.operational-report-table');
    expect(css).toContain('.operational-report-totals');
    expect(css).toContain('.operational-report-signatures');
    expect(css).toContain('.operational-report-print-root');
    expect(css).toContain('@media print');
    expect(css).toContain('page-break-after: always');
    expect(css).toContain('.no-print');
  });
});
