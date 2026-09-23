import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('full-width operational layouts', () => {
  it('does not cap xl modals at 1200px', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/components/ui/Modal.jsx'), 'utf8');

    expect(source).toContain("xl: 'calc(100vw - 48px)'");
    expect(source).not.toContain('xl: 1200');
  });

  it('forces receiving and withdrawal operation pages to use full available width', () => {
    const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');
    const withdrawalReviewSource = readFileSync(path.join(process.cwd(), 'src/features/customer/CustomerAdminWithdrawalReviewPage.jsx'), 'utf8');

    expect(css).toContain('.receiving-list-page,');
    expect(css).toContain('.withdrawal-list-page');
    expect(css).toContain('.withdrawal-review-page');
    expect(css).toContain('max-width: none !important;');
    expect(css).toContain('width: 100%;');
    expect(withdrawalReviewSource).toContain('withdrawal-review-page');
  });

  it('keeps receiving filters compact with a multi-select status dropdown', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/components/customer/CustomerDepositNotificationsSection.jsx'), 'utf8');
    const css = readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');

    expect(source).toContain('statusFilterOpen');
    expect(source).toContain('deposit-notifications-filter-row');
    expect(source).toContain('deposit-notifications-status-dropdown-button');
    expect(source).toContain('deposit-notifications-status-dropdown-menu');
    expect(source).toContain('type="checkbox"');
    expect(source).not.toContain('deposit-notifications-status-chip-');
    expect(css).toContain('.deposit-notifications-filter-row');
    expect(css).toContain('.deposit-notifications-status-filter__menu');
  });
});
