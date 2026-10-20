import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

// The Sprint 14O picking workflow draft page (and its outbound picking service)
// were removed as unreachable code; only the sidebar guard remains relevant.
describe('Sprint 14O picking workflow draft UI', () => {
  it('sidebar navigation no longer includes removed picking confirmation route', () => {
    render(
      <MemoryRouter>
        <LanguageProvider>
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    const pickingLink = screen
      .queryAllByRole('link')
      .find((link) => link.getAttribute('href') === '/operations/picking');

    expect(pickingLink).toBeUndefined();
  });
});
