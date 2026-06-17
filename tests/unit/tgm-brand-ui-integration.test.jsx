import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { brandConfig } from '../../src/config/brandConfig.js';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { Topbar } from '../../src/components/layout/Topbar.jsx';
import LanguageToggle from '../../src/components/common/LanguageToggle.jsx';
import UserRoleDemoSelector from '../../src/components/common/UserRoleDemoSelector.jsx';
import ReportsPage from '../../src/features/reports/ReportsPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import {
  DEFAULT_LANGUAGE,
  getTranslation,
  TRANSLATION_CATALOG,
} from '../../src/i18n/translationCatalog.js';

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>,
  );
}

describe('Sprint 12G TGM brand UI integration', () => {
  it('brandConfig exports logo path and colors', () => {
    expect(brandConfig.logoPath).toBe('/brand/tgc-logo.svg');
    expect(brandConfig.colors.black).toBeTruthy();
    expect(brandConfig.colors.gold).toBeTruthy();
    expect(brandConfig.colors.red).toBeTruthy();
  });

  it('Sidebar renders logo', () => {
    renderWithProviders(<Sidebar />);

    expect(screen.getByAltText('TGC logo')).toHaveAttribute('src', brandConfig.logoPath);
  });

  it('Topbar renders app title', () => {
    renderWithProviders(<Topbar currentSection="Dashboard" />);

    expect(screen.getByRole('heading', { name: getTranslation('tgm_cold_storage_wms', 'th') })).toBeInTheDocument();
  });

  it('LanguageToggle remains visible', () => {
    renderWithProviders(<LanguageToggle />);

    expect(screen.getByLabelText('Current language')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Toggle language/i })).toBeInTheDocument();
  });

  it('Thai default remains active', () => {
    expect(DEFAULT_LANGUAGE).toBe('th');
    renderWithProviders(<LanguageToggle />);

    expect(screen.getByRole('button', { name: 'Thai' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ReportsPage still renders', () => {
    renderWithProviders(<ReportsPage />);

    expect(screen.getByRole('heading', { name: getTranslation('reports', 'th') })).toBeInTheDocument();
  });

  it('Demo role selector behavior is not broken', () => {
    renderWithProviders(<UserRoleDemoSelector />);

    expect(screen.getByLabelText(/Switch role:/i)).toBeInTheDocument();
    expect(screen.getByText(/Demo only/i)).toBeInTheDocument();
  });

  it('No forbidden production action text is added', () => {
    renderWithProviders(<ReportsPage />);

    expect(screen.queryByRole('button', { name: /create invoice/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /post accounting/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /inventory sync/i })).not.toBeInTheDocument();
  });

  it('brand translation keys have th/en values', () => {
    [
      'tgm_cold_storage_wms',
      'thai_german_meat_product',
      'premium_dashboard',
      'refresh_data',
      'view_details',
      'system_status',
    ].forEach((key) => {
      expect(TRANSLATION_CATALOG[key].th).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].en).toBeTruthy();
    });
  });
});
