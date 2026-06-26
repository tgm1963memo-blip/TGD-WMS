import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

import { AppShell } from '../../src/components/layout/AppShell.jsx';

function renderWithProviders(ui, { language = 'en' } = {}) {
  return render(
    <MemoryRouter>
      <LanguageProvider initialLanguage={language}>
        {ui}
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('17B App Shell and Navigation UI', () => {
  it('AppShell renders without crashing', () => {
    renderWithProviders(
      <AppShell currentSection="Dashboard">
        <p>Test content</p>
      </AppShell>,
    );

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('Sidebar renders without crashing', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  describe('Sidebar contains full text professional labels', () => {
    const requiredLabels = [
      'Dashboard',
      'Receiving',
      'Stock Balance',
      'Users and Roles',
      'Invoice Drafts',
    ];

    it.each(requiredLabels)('contains label: %s', (label) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  describe('Sidebar contains professional group labels', () => {
    const requiredGroups = [
      'Main Operation',
      'Inbound Management',
      'Inventory Control',
      'Outbound Management',
      'Barcode / Handheld',
      'Customer Portal',
      'Billing',
      'Reports',
      'System Administration',
    ];

    it.each(requiredGroups)('contains group label: %s', (group) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(group)).toBeInTheDocument();
    });
  });

  it('Sidebar does not render cute emoji icons', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    expect(sidebar.textContent).not.toMatch(emojiPattern);
  });

  it('Sidebar does not use short code-only primary labels', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    const codeLabels = ['RCV', 'PTW', 'PCK', 'PST', 'ADJ', 'TRF', 'DSP'];
    const navLinks = sidebar.querySelectorAll('.nav-link');

    navLinks.forEach((link) => {
      const text = link.textContent.trim();
      codeLabels.forEach((code) => {
        expect(text).not.toBe(code);
      });
    });
  });

  it('Production HOLD text is visible', () => {
    renderWithProviders(<Sidebar />);
    const indicator = screen.getByTestId('production-hold-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('Production HOLD');
  });

  it('withdrawal review menu links to customer admin review route', () => {
    renderWithProviders(<Sidebar />);
    const withdrawalLink = screen.getByRole('link', { name: /Withdrawal Request/i });
    expect(withdrawalLink).toHaveAttribute('href', '/customer/admin/withdrawal-review');
  });

  it('Sidebar renders expected number of navigation groups', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    const groupLabels = sidebar.querySelectorAll('.nav-group-label');
    expect(groupLabels.length).toBeGreaterThan(0);
  });

  describe('Sidebar contains additional expected items', () => {
    const additionalItems = [
      'Movement Ledger',
      'Stock Aging',
      'Customer Data',
      'Scan Center',
      'Customer Deposit',
      'Customer Requests',
      'Portal Overview',
      'Billing Movement Weight',
    ];

    it.each(additionalItems)('contains item: %s', (item) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });
});
