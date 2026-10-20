import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

// The Sprint 14L outbound list/draft pages and outbound picking service were
// removed as unreachable code; the navigation guards below still apply.
describe('Sprint 14L outbound navigation and UX hardening', () => {
  it('sidebar navigation includes withdrawal review route', () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="en">
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Withdrawal Request/i })).toHaveAttribute(
      'href',
      '/customer/admin/withdrawal-review',
    );
  });

  it('source avoids outbound posting and dangerous stock mutation code references', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const sourcePaths = [
      'src/components/layout/Sidebar.jsx',
      'src/app/navigation.js',
    ];
    const source = sourcePaths
      .map((sourcePath) => fs.readFileSync(path.resolve(process.cwd(), sourcePath), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(/insert\s+into\s+tgd_stock_movements/i);
    expect(source).not.toMatch(/update\s+tgd_stock_balances/i);
    expect(source).not.toMatch(/delete\s+from/i);
    expect(source).not.toMatch(/\btruncate\b/i);
  });
});
