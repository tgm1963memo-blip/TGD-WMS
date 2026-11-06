import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const roleMock = vi.hoisted(() => ({ role: 'admin', allowedMenuKeys: null }));
const searchMock = vi.hoisted(() => vi.fn());

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => roleMock,
}));

vi.mock('../../src/services/globalSearchService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  searchRecords: searchMock,
}));

import {
  CommandPalette,
  getSearchSourcesForRole,
  isCommandPaletteShortcut,
} from '../../src/components/layout/CommandPalette.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { buildContainsPattern } from '../../src/services/globalSearchService.js';

function Where() {
  return <div data-testid="where">{useLocation().pathname}{useLocation().search}</div>;
}

function renderPalette() {
  const onClose = vi.fn();
  render(
    <MemoryRouter>
      <LanguageProvider initialLanguage="en">
        <CommandPalette isOpen onClose={onClose} />
        <Where />
      </LanguageProvider>
    </MemoryRouter>,
  );
  return { onClose };
}

describe('search permissions', () => {
  it.each(['customer_admin', 'customer_user'])('%s never searches records', (role) => {
    expect(getSearchSourcesForRole(role)).toEqual([]);
  });

  it('admin can search every source', () => {
    expect(getSearchSourcesForRole('admin')).toEqual(['deposit', 'withdrawal', 'invoice', 'customer']);
  });

  it('staff roles below the review pages search nothing', () => {
    expect(getSearchSourcesForRole('warehouse_staff')).toEqual([]);
    expect(getSearchSourcesForRole('viewer')).toEqual([]);
  });

  it('accounting cannot search customers, whose page it cannot open', () => {
    expect(getSearchSourcesForRole('accounting')).toEqual(['deposit', 'withdrawal', 'invoice']);
  });
});

describe('buildContainsPattern', () => {
  it('escapes ILIKE wildcards so they match literally', () => {
    expect(buildContainsPattern(' 100%_a\\ ')).toBe('%100\\%\\_a\\\\%');
  });
});

describe('isCommandPaletteShortcut', () => {
  it('matches Ctrl K and Cmd K only', () => {
    expect(isCommandPaletteShortcut({ ctrlKey: true, key: 'k' })).toBe(true);
    expect(isCommandPaletteShortcut({ metaKey: true, key: 'K' })).toBe(true);
    expect(isCommandPaletteShortcut({ key: 'k' })).toBe(false);
    expect(isCommandPaletteShortcut({ ctrlKey: true, shiftKey: true, key: 'k' })).toBe(false);
  });
});

describe('CommandPalette', () => {
  beforeEach(() => {
    roleMock.role = 'admin';
    searchMock.mockReset();
    searchMock.mockResolvedValue({ data: [], failed: false });
  });
  afterEach(cleanup);

  it('jumps to a menu item with the keyboard', () => {
    const { onClose } = renderPalette();
    const input = screen.getByTestId('command-palette-input');
    fireEvent.change(input, { target: { value: 'Stock Aging' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/reports/storage-aging');
  });

  it('shows record results and opens the chosen one', async () => {
    searchMock.mockResolvedValue({
      data: [{ type: 'withdrawal', id: 'w1', title: 'CWR-1', subtitle: 'Acme', path: '/customer/admin/withdrawal-review?open=w1' }],
      failed: false,
    });
    renderPalette();
    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'CWR' } });
    fireEvent.click(await screen.findByText('CWR-1'));
    expect(screen.getByTestId('where').textContent).toBe('/customer/admin/withdrawal-review?open=w1');
  });

  it('tells the user when part of the search failed', async () => {
    searchMock.mockResolvedValue({ data: [], failed: true });
    renderPalette();
    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'CWR' } });
    expect(await screen.findByText(/results may be incomplete/)).toBeInTheDocument();
  });

  it('never calls record search for a customer role', async () => {
    roleMock.role = 'customer_user';
    renderPalette();
    fireEvent.change(screen.getByTestId('command-palette-input'), { target: { value: 'CDR-2026' } });
    await new Promise((r) => { setTimeout(r, 350); });
    await waitFor(() => expect(searchMock).not.toHaveBeenCalled());
  });
});
