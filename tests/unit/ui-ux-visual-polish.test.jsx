import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell } from '../../src/components/layout/AppShell.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { getTranslation } from '../../src/i18n/translationCatalog.js';
import ReportsPage from '../../src/features/reports/ReportsPage.jsx';
import { AuthReadinessPage } from '../../src/features/admin/AuthReadinessPage.jsx';
import { DocumentBrandingAdminPage } from '../../src/features/admin/DocumentBrandingAdminPage.jsx';

function renderWithShell(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider>{ui}</LanguageProvider>
    </MemoryRouter>
  );
}

describe('Sprint 12D UI/UX visual polish', () => {
  it('renders the modern app shell with global language toggle', () => {
    renderWithShell(
      <AppShell currentSection="Dashboard">
        <div>Shell content</div>
      </AppShell>
    );

    expect(screen.getByText('TGD WMS')).toBeInTheDocument();
    expect(screen.getByLabelText('Current language')).toBeInTheDocument();
    expect(screen.getByText('Shell content')).toBeInTheDocument();
  });

  it('keeps Thai as the default language in the shell navigation', () => {
    renderWithShell(
      <AppShell currentSection="Dashboard">
        <div />
      </AppShell>
    );

    expect(screen.getByText(getTranslation('warehouse_operations', 'th'))).toBeInTheDocument();
    expect(screen.getAllByText(getTranslation('reports', 'th')).length).toBeGreaterThan(0);
  });

  it('renders ReportsPage with Thai title and report cards', () => {
    renderWithShell(<ReportsPage />);

    expect(screen.getByRole('heading', { name: getTranslation('reports', 'th') })).toBeInTheDocument();
    expect(screen.getByText(getTranslation('movement_ledger_report', 'th'))).toBeInTheDocument();
    expect(screen.getAllByText(getTranslation('open_report', 'th')).length).toBeGreaterThan(0);
  });

  it('keeps the demo role selector visually marked as demo-only', () => {
    renderWithShell(<ReportsPage />);

    expect(screen.getByText(/สำหรับทดสอบเท่านั้น \/ Demo only/i)).toBeInTheDocument();
  });

  it('renders admin readiness page with modern card sections', () => {
    renderWithShell(<AuthReadinessPage />);

    expect(screen.getByText('Production Role Model')).toBeInTheDocument();
    expect(screen.getByText('Next Action Checklist')).toBeInTheDocument();
  });

  it('does not add save or upload actions to branding admin page', () => {
    renderWithShell(<DocumentBrandingAdminPage />);

    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });
});
