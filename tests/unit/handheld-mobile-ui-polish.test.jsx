import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HandheldPage } from '../../src/features/handheld/HandheldPage.jsx';

function renderPage() {
  return render(
    <MemoryRouter>
      <HandheldPage />
    </MemoryRouter>,
  );
}

describe('17E Handheld Mobile UI Polish', () => {
  it('Handheld/mobile UI renders login shell without crashing', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('handheld-page')).toBeInTheDocument();
      expect(screen.getByTestId('handheld-login-page')).toBeInTheDocument();
    });
  });

  it('UI includes Handheld wording on login page', () => {
    renderPage();
    expect(screen.getAllByText(/Handheld/i).length).toBeGreaterThan(0);
  });

  it('handheld page root is present for mobile operations entry', () => {
    renderPage();
    expect(screen.getByTestId('handheld-page')).toBeInTheDocument();
  });
});
