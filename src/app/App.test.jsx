import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import React from 'react';
import App from './App.jsx';
import { getTranslation } from '../i18n/translationCatalog.js';

// Stable mock reference to prevent infinite React re-renders in useEffect dependencies
const mockAuthContextValue = {
  session: { user: { email: 'uat@example.com' } },
  loading: false,
  isAuthenticated: true
};

vi.mock('../features/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => mockAuthContextValue),
  AuthProvider: ({ children }) => children,
}));

vi.mock('../features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: vi.fn(() => ({ role: 'admin', ready: true })),
  UserRoleProvider: ({ children }) => children,
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    BrowserRouter: ({ children }) => <actual.MemoryRouter initialEntries={[window.location.pathname]}>{children}</actual.MemoryRouter>,
  };
});

// Provide a stable mock for supabaseClient that doesn't instantiate createClient
vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: function(resolve) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      }
    })),
    rpc: vi.fn(() => Promise.resolve({ data: [], error: null })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } }))
    }
  }
}));

describe('App', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TGC WMS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: getTranslation('operations_dashboard', 'th') })).toBeInTheDocument();
  });

  it.each([
    ['/', getTranslation('operations_dashboard', 'th'), false],
    ['/customers', 'Customers'],
    ['/products', 'Products'],
    ['/locations', 'Locations'],
    ['/receiving', getTranslation('receiving', 'th'), false],
    ['/inventory', 'Inventory'],
    ['/movement-ledger', 'Movement Ledger'],
    ['/picking', 'Picking', false],
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


