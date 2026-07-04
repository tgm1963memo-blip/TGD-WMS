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
    expect(css).toContain('page-break-after: auto');
    expect(css).toContain('.no-print');
  });

  it('removes #root from layout during print instead of just hiding it', () => {
    // ReportPreviewModal portals to document.body (sibling of #root, not a
    // descendant), so visibility:hidden on the underlying app leaves it
    // still occupying real layout height during print pagination — a long
    // underlying page (many rows) pushed a one-line print document several
    // blank pages in. display:none actually collapses that height.
    const cssPath = path.resolve(process.cwd(), 'src/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const printBlockMatch = css.match(/@media print \{[\s\S]*/);
    expect(printBlockMatch).not.toBeNull();
    const printBlock = printBlockMatch[0];

    const rootRuleMatch = printBlock.match(/#root\s*\{[^}]*\}/);
    expect(rootRuleMatch).not.toBeNull();
    expect(rootRuleMatch[0]).toContain('display: none');
  });
});
