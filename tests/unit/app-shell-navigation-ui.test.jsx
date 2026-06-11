import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { AppShell } from '../../src/components/layout/AppShell.jsx';

/**
 * 17B App Shell and Navigation UI Tests.
 *
 * Safety:
 * - No Production touched.
 * - No Supabase write operations.
 * - Tests UI rendering only.
 */

function renderWithProviders(ui) {
  return render(
    <MemoryRouter>
      <LanguageProvider initialLanguage="en">
        {ui}
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('17B App Shell and Navigation UI', () => {
  // ── Layout Rendering ────────────────────────────────────────

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

  // ── Full Professional Text Labels ───────────────────────────

  describe('Sidebar contains full text professional labels', () => {
    const requiredLabels = [
      'Dashboard',
      'Receiving',
      'Putaway',
      'Stock Balance',
      'Picking Confirmation',
      'Post Outbound',
      'Users and Roles',
    ];

    it.each(requiredLabels)('contains label: %s', (label) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  // ── Professional Group Labels ───────────────────────────────

  describe('Sidebar contains professional group labels', () => {
    const requiredGroups = [
      'Main Operation',
      'Inbound Management',
      'Inventory Control',
      'Outbound Management',
      'Barcode / Handheld',
      'Customer Portal',
      'Reports',
      'System Administration',
    ];

    it.each(requiredGroups)('contains group label: %s', (group) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(group)).toBeInTheDocument();
    });
  });

  // ── No Emoji Icons ──────────────────────────────────────────

  it('Sidebar does not render cute emoji icons', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    const textContent = sidebar.textContent;

    // Common emoji ranges and specific warehouse emojis
    const emojiPattern = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]/u;
    expect(textContent).not.toMatch(emojiPattern);
  });

  // ── No Short Code-Only Labels ───────────────────────────────

  it('Sidebar does not use short code-only primary labels', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');

    // These short code labels must not appear as standalone nav items
    const codeLabels = ['RCV', 'PTW', 'PCK', 'PST', 'ADJ', 'TRF', 'DSP'];
    const navLinks = sidebar.querySelectorAll('.nav-link');

    navLinks.forEach((link) => {
      const text = link.textContent.trim();
      codeLabels.forEach((code) => {
        expect(text).not.toBe(code);
      });
    });
  });

  // ── Production HOLD Indicator ───────────────────────────────

  it('Production HOLD text is visible', () => {
    renderWithProviders(<Sidebar />);

    const indicator = screen.getByTestId('production-hold-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('Production HOLD');
  });

  // ── Post Outbound Menu Item ─────────────────────────────────

  it('Post Outbound menu is visible but does not imply feature gate enabled', () => {
    renderWithProviders(<Sidebar />);

    const postOutbound = screen.getByText('Post Outbound');
    expect(postOutbound).toBeInTheDocument();

    // Post Outbound should be a regular nav link, not indicating "enabled" or "active"
    // It should not have text indicating the feature gate is on
    const sidebar = screen.getByTestId('sidebar');
    expect(sidebar.textContent).not.toContain('Feature Gate: ON');
    expect(sidebar.textContent).not.toContain('Gate Enabled');
  });

  // ── Disabled Items ──────────────────────────────────────────

  it('disabled items are marked as aria-disabled', () => {
    renderWithProviders(<Sidebar />);

    const disabledItems = screen.getAllByTitle('Coming soon');
    expect(disabledItems.length).toBeGreaterThan(0);

    disabledItems.forEach((item) => {
      expect(item).toHaveAttribute('aria-disabled', 'true');
    });
  });

  // ── Navigation Structure ────────────────────────────────────

  it('Sidebar renders expected number of navigation groups', () => {
    renderWithProviders(<Sidebar />);
    const sidebar = screen.getByTestId('sidebar');
    const groupLabels = sidebar.querySelectorAll('.nav-group-label');

    // 10 groups, including Customer Portal and the meeting-only Customer Ops Demo group.
    expect(groupLabels.length).toBe(10);
  });

  // ── Additional Menu Items ───────────────────────────────────

  describe('Sidebar contains additional expected items', () => {
    const additionalItems = [
      'Transfer',
      'Adjustment',
      'Withdrawal Request',
      'Reservation',
      'Dispatch History',
      'Movement Ledger',
      'Stock Aging',
      'Master Data',
      'Handheld Receiving',
      'Scan Center',
      'Customer Deposit',
      'Customer Requests',
      'Portal Overview',
    ];

    it.each(additionalItems)('contains item: %s', (item) => {
      renderWithProviders(<Sidebar />);
      expect(screen.getByText(item)).toBeInTheDocument();
    });
  });
});
