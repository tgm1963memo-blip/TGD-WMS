import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HandheldPage } from '../../src/features/handheld/HandheldPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <HandheldPage />
    </MemoryRouter>
  );
}

describe('17E Handheld Mobile UI Polish', () => {
  it('Handheld/mobile UI renders without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Handheld Scan Operations')).toBeInTheDocument();
    });
  });

  it('UI includes Handheld or Scan wording', () => {
    renderPage();
    expect(screen.getAllByText(/Handheld/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Scan/i).length).toBeGreaterThan(0);
  });

  it('UI includes scan input or Scan / Enter wording', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Scan Location, Pallet, or Lot...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scan / Enter' })).toBeInTheDocument();
  });

  it('UI includes Last Scan', () => {
    renderPage();
    expect(screen.getByText('Last Scan')).toBeInTheDocument();
    expect(screen.getByText('Product')).toBeInTheDocument();
    expect(screen.getByText('Lot')).toBeInTheDocument();
    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Qty')).toBeInTheDocument();
  });

  it('UI includes Session Summary', () => {
    renderPage();
    expect(screen.getByText('Session Summary')).toBeInTheDocument();
    expect(screen.getByText('Total Scans')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });

  it('UI includes Undo Last Scan', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Undo Last Scan' })).toBeInTheDocument();
  });

  it('UI includes Complete Session', () => {
    renderPage();
    expect(screen.getByRole('button', { name: 'Complete Session' })).toBeInTheDocument();
  });

  it('UI includes Production remains HOLD', () => {
    renderPage();
    expect(screen.getAllByText('Production remains HOLD').length).toBeGreaterThan(0);
  });

  it('UI includes no Production migration applied', () => {
    renderPage();
    expect(screen.getByText('No Production migration applied')).toBeInTheDocument();
  });

  it('UI does not imply Production is enabled', () => {
    renderPage();
    const html = screen.getByRole('heading', { name: 'Production remains HOLD' }).parentElement.innerHTML;
    expect(html).not.toMatch(/Production is enabled/i);
    expect(html).not.toMatch(/Production applied/i);
    expect(html).not.toMatch(/FINAL GO/i);
  });
});
