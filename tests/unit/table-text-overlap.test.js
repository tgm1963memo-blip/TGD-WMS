import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A document number that can't wrap needs a column wide enough for it, or it
// runs into the next cell. The longest in use is OB-20260704-015615.

const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');

function columnWidth(selector) {
  const match = css.match(new RegExp(`\\.${selector} \\{ width: (\\d+)px; \\}`));
  return Number(match?.[1]);
}

describe('table text stays inside its column', () => {
  it.each([
    'admin-deposit-review-table__request-col',
    'receiving-customer-deposit-table__request-col',
  ])('%s fits a whole document number', (selector) => {
    expect(columnWidth(selector)).toBeGreaterThanOrEqual(150);
  });

  it('lets customer names wrap in fixed tables on small screens', () => {
    expect(css).toMatch(/\.data-table td\.receiving-customer-deposit-table__customer-cell[\s\S]*?white-space: normal/);
    expect(css).toMatch(/\.data-table td\.admin-deposit-review-table__customer-cell[\s\S]*?white-space: normal/);
  });

  it('gives .table-wrapper a scrollbar, so wide tables are not cut off', () => {
    expect(css).toMatch(/\.table-responsive, \.table-wrapper \{ overflow-x: auto; \}/);
  });
});
