import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { TRANSLATION_CATALOG } from '../../src/i18n/translationCatalog.js';

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
      </MemoryRouter>
    );

    // Verify main keys in Thai
    expect(screen.getByText('เมนูหลัก')).toBeInTheDocument();
    expect(screen.getByText('แดชบอร์ด')).toBeInTheDocument();
    expect(screen.getByText('งานรับเข้า')).toBeInTheDocument();
    expect(screen.getByText('รับเข้า')).toBeInTheDocument();
    expect(screen.getByText('จัดเก็บ')).toBeInTheDocument();
    expect(screen.getByText('รับเข้าด้วย Handheld')).toBeInTheDocument();
  });

  it('renders sidebar with English translations when English is selected', () => {
    render(
      <MemoryRouter>
        <LanguageProvider initialLanguage="en">
          <Sidebar />
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify main keys in English
    expect(screen.getByText('MAIN OPERATION')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('INBOUND MANAGEMENT')).toBeInTheDocument();
    expect(screen.getByText('Receiving')).toBeInTheDocument();
    expect(screen.getByText('Putaway')).toBeInTheDocument();
    expect(screen.getByText('Handheld Receiving')).toBeInTheDocument();
  });

  it('contains proper translation keys for navigation items in translation catalog', () => {
    // Ensure the new nav.* keys were added to the catalog
    expect(TRANSLATION_CATALOG['nav.dashboard']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.receiving']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.stockBalance']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.pickingConfirmation']).toBeDefined();
    expect(TRANSLATION_CATALOG['nav.barcodeHandheld']).toBeDefined();
  });
});
