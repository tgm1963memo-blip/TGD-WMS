import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { LoginPage } from '../../src/features/auth/LoginPage.jsx';
import { Sidebar } from '../../src/components/layout/Sidebar.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

const authMocks = vi.hoisted(() => ({
  signOutFromStaging: vi.fn(),
  getStagingSession: vi.fn(),
  subscribeToStagingAuth: vi.fn(),
  authChangeHandler: null,
}));

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: authMocks.getStagingSession,
  subscribeToStagingAuth: authMocks.subscribeToStagingAuth,
  signInToStaging: vi.fn(),
  signOutFromStaging: authMocks.signOutFromStaging,
}));

vi.mock('../../src/services/userProfileService.js', () => ({
  getCurrentUserProfile: vi.fn().mockResolvedValue({
    data: { role: 'accounting', is_active: true },
    error: null,
  }),
}));

function renderWithSession(session) {
  authMocks.getStagingSession.mockResolvedValue({ data: session, error: null });
  authMocks.subscribeToStagingAuth.mockImplementation((onChange) => {
    authMocks.authChangeHandler = onChange;
    onChange(session);
    return { unsubscribe: vi.fn() };
  });

  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <LanguageProvider initialLanguage="th">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<Sidebar />} />
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('Gate 3A.1 logout session behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.authChangeHandler = null;
    authMocks.signOutFromStaging.mockImplementation(async () => {
      authMocks.authChangeHandler?.(null);
      return { data: null, error: null };
    });
  });

  it('shows logout button only when session exists', async () => {
    renderWithSession({
      user: { email: 'uat.user@example.com' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-session-menu')).toBeInTheDocument();
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      expect(screen.getByText('uat.user@example.com')).toBeInTheDocument();
    });
  });

  it('hides logout button when user is not authenticated', async () => {
    renderWithSession(null);

    await waitFor(() => {
      expect(screen.queryByTestId('logout-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('user-session-menu')).not.toBeInTheDocument();
    });
  });

  it('calls signOut and redirects to login page', async () => {
    renderWithSession({
      user: { email: 'uat.user@example.com' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(authMocks.signOutFromStaging).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
  });

  it('shows safe error message when signOut fails', async () => {
    renderWithSession({
      user: { email: 'uat.user@example.com' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('logout-button')).toBeInTheDocument();
    });

    authMocks.signOutFromStaging.mockImplementation(async () => ({
      data: null,
      error: new Error('network failed'),
    }));

    fireEvent.click(screen.getByTestId('logout-button'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/ออกจากระบบไม่สำเร็จ|Unable to sign out/i);
      expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    });
  });
});
