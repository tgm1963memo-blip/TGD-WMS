import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

vi.mock('../features/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({ session: { user: { email: 'uat@example.com' } }, loading: false, isAuthenticated: true })),
  AuthProvider: ({ children }) => children,
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TGD WMS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Operations Dashboard' })).toBeInTheDocument();
  });

  it.each([
    ['/', 'Operations Dashboard', false],
    ['/customers', 'Customers'],
    ['/products', 'Products'],
    ['/locations', 'Locations'],
    ['/receiving', 'Receiving', false],
    ['/inventory', 'Inventory'],
    ['/movement-ledger', 'Movement Ledger'],
    ['/picking', 'Picking'],
    ['/transfer', 'Internal Transfer', false],
    ['/adjustment', 'Inventory Adjustment', false],
    ['/audit', 'Audit'],
  ])('renders %s route', (path, title, expectsPlaceholder = true) => {
    window.history.pushState({}, '', path);

    render(<App />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    if (expectsPlaceholder) {
      expect(screen.getByText('Sprint status: placeholder only')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Sprint status: placeholder only')).not.toBeInTheDocument();
    }
  });
});
