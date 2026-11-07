import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A document number that can't wrap needs a column wide enough for it, or it
// runs into the next cell. The longest in use is OB-20260704-015615.

const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');

function columnWidth(selector) {
  const match = css.match(new RegExp(`\\.${selector}\\s*\\{[^}]*?width:\\s*(\\d+)px`));
  if (!match) throw new Error(`no width rule for .${selector}`);
  return Number(match[1]);
}

// The selector list that ends in `{ white-space: normal; }`, so a later,
// unrelated `white-space: normal` can't make the check pass.
function wrapsOnSmallScreens(cellSelector) {
  const escaped = cellSelector.replace(/[.]/g, '\\.');
  return new RegExp(`${escaped}[,\\s][^{}]*\\{ white-space: normal; \\}`).test(css);
}

describe('table text stays inside its column', () => {
  it.each([
    'admin-deposit-review-table__request-col',
    'receiving-customer-deposit-table__request-col',
  ])('%s fits a whole document number', (selector) => {
    expect(columnWidth(selector)).toBeGreaterThanOrEqual(150);
  });

  it.each([
    '.data-table td.receiving-customer-deposit-table__customer-cell',
    '.data-table td.admin-deposit-review-table__customer-cell',
    '.data-table td.admin-withdrawal-lines-table__product-cell',
    '.tgd-table.compact-table--fixed td',
  ])('%s wraps in fixed tables on small screens', (selector) => {
    expect(wrapsOnSmallScreens(selector)).toBe(true);
  });

  it('cuts an over-long receiving number with an ellipsis instead of spilling', () => {
    expect(css).toMatch(/\.receiving-customer-deposit-table__request-cell \{ overflow: hidden; text-overflow: ellipsis; \}/);
  });

  it('gives .table-wrapper a scrollbar, so wide tables are not cut off', () => {
    expect(css).toMatch(/\.table-responsive, \.table-wrapper \{ overflow-x: auto; \}/);
  });
});
