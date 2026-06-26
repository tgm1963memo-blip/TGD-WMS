import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

describe('19B Sidebar Language Switch', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders sidebar with Thai translations when Thai is selected', () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="th">
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Main Operation')).toBeInTheDocument();
    expect(screen.getByText('Inbound Management')).toBeInTheDocument();
    expect(screen.getByText('แดชบอร์ด')).toBeInTheDocument();
    expect(screen.getByText('รับเข้า')).toBeInTheDocument();
    expect(screen.getByText('ยอดคงเหลือ')).toBeInTheDocument();
    expect(screen.getByText('ศูนย์สแกน')).toBeInTheDocument();
  });

  it('renders sidebar with English translations when English is selected', () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="en">
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Main Operation')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Inbound Management')).toBeInTheDocument();
    expect(screen.getByText('Receiving')).toBeInTheDocument();
    expect(screen.getByText('Stock Balance')).toBeInTheDocument();
    expect(screen.getByText('Scan Center')).toBeInTheDocument();
  });

  it('contains proper translation keys for navigation items in translation catalog', () => {
    expect(TRANSLATION_CATALOG['nav.dashboard']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.receiving']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.stockBalance']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.scanCenter']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.barcodeHandheld']).toBeDefined();
  });
});
