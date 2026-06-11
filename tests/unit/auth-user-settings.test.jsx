import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { LoginPage } from '../../src/features/auth/LoginPage.jsx';
import { ForgotPasswordPage } from '../../src/features/auth/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../../src/features/auth/ResetPasswordPage.jsx';
import { ProfileSettingsPage } from '../../src/features/settings/ProfileSettingsPage.jsx';
import { UserSessionMenu } from '../../src/components/auth/UserSessionMenu.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { validatePasswordConfirmation, validatePasswordStrength } from '../../src/utils/authPasswordUtils.js';
import {
  canReadBillingInvoiceDrafts,
  canWriteBillingInvoiceDrafts,
} from '../../src/security/billingInvoiceDraftPermissions.js';

const authMocks = vi.hoisted(() => ({
  getStagingSession: vi.fn(),
  subscribeToStagingAuth: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateStagingPassword: vi.fn(),
  signOutFromStaging: vi.fn(),
}));

const profileMocks = vi.hoisted(() => ({
  getCurrentUserProfile: vi.fn(),
}));

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: authMocks.getStagingSession,
  subscribeToStagingAuth: authMocks.subscribeToStagingAuth,
  requestPasswordReset: authMocks.requestPasswordReset,
  updateStagingPassword: authMocks.updateStagingPassword,
  signOutFromStaging: authMocks.signOutFromStaging,
  signInToStaging: vi.fn(),
}));

vi.mock('../../src/services/userProfileService.js', () => ({
  getCurrentUserProfile: profileMocks.getCurrentUserProfile,
}));

function renderWithProviders(ui, { route = '/login' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <LanguageProvider initialLanguage="th">
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/settings/profile" element={<ProfileSettingsPage />} />
            <Route path="/dashboard" element={<UserSessionMenu />} />
          </Routes>
          {ui}
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe('UX-AUTH-1 auth and user settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getStagingSession.mockResolvedValue({ data: null, error: null });
    authMocks.subscribeToStagingAuth.mockImplementation((onChange) => {
      onChange(null);
      return { unsubscribe: vi.fn() };
    });
    authMocks.requestPasswordReset.mockResolvedValue({ data: {}, error: null });
    authMocks.updateStagingPassword.mockResolvedValue({ data: { id: 'user-1' }, error: null });
    profileMocks.getCurrentUserProfile.mockResolvedValue({
      data: {
        role: 'accounting',
        is_active: true,
        customer_id: null,
        display_name: 'UAT Accounting',
      },
      error: null,
    });
  });

  it('login page shows forgot password link', async () => {
    renderWithProviders(null, { route: '/login' });

    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
      expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
      expect(screen.getByText('ลืมรหัสผ่าน?')).toBeInTheDocument();
    });
  });

  it('forgot password submit shows generic success message', async () => {
    renderWithProviders(null, { route: '/forgot-password' });

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByTestId('forgot-password-submit-button'));

    await waitFor(() => {
      expect(authMocks.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
      expect(screen.getByTestId('forgot-password-success')).toBeInTheDocument();
    });
  });

  it('forgot password shows validation error for invalid email submit', async () => {
    renderWithProviders(null, { route: '/forgot-password' });

    fireEvent.change(screen.getByTestId('forgot-password-email-input'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByTestId('forgot-password-submit-button'));

    await waitFor(() => {
      expect(screen.getByTestId('forgot-password-error')).toBeInTheDocument();
    });
  });

  it('reset password validation rejects short password', () => {
    expect(validatePasswordStrength('short').valid).toBe(false);
    expect(validatePasswordStrength('longenough').valid).toBe(true);
    expect(validatePasswordConfirmation('longenough', 'different').valid).toBe(false);
  });

  it('reset password page renders form when recovery session exists', async () => {
    authMocks.getStagingSession.mockResolvedValue({
      data: { user: { email: 'user@example.com' } },
      error: null,
    });
    authMocks.subscribeToStagingAuth.mockImplementation((onChange) => {
      onChange({ user: { email: 'user@example.com' } });
      return { unsubscribe: vi.fn() };
    });

    renderWithProviders(null, { route: '/reset-password' });

    await waitFor(() => {
      expect(screen.getByTestId('reset-password-new-input')).toBeInTheDocument();
      expect(screen.getByTestId('reset-password-confirm-input')).toBeInTheDocument();
    });
  });

  it('profile settings renders user email and role', async () => {
    authMocks.getStagingSession.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'accounting@example.com' } },
      error: null,
    });
    authMocks.subscribeToStagingAuth.mockImplementation((onChange) => {
      onChange({ user: { id: 'auth-1', email: 'accounting@example.com' } });
      return { unsubscribe: vi.fn() };
    });

    renderWithProviders(null, { route: '/settings/profile' });

    await waitFor(() => {
      expect(screen.getByTestId('profile-settings-email')).toHaveTextContent('accounting@example.com');
      expect(screen.getByTestId('profile-settings-role')).toHaveTextContent('accounting');
    });
  });

  it('user menu shows profile settings link', async () => {
    authMocks.getStagingSession.mockResolvedValue({
      data: { user: { id: 'auth-1', email: 'uat.user@example.com' } },
      error: null,
    });
    authMocks.subscribeToStagingAuth.mockImplementation((onChange) => {
      onChange({ user: { id: 'auth-1', email: 'uat.user@example.com' } });
      return { unsubscribe: vi.fn() };
    });

    renderWithProviders(null, { route: '/dashboard' });

    await waitFor(() => {
      expect(screen.getByTestId('user-profile-settings-link')).toBeInTheDocument();
      expect(screen.getByTestId('user-session-role')).toHaveTextContent('accounting');
    });
  });

  it('billing permission tests still pass for role boundaries', () => {
    expect(canReadBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canReadBillingInvoiceDrafts('viewer')).toBe(false);
    expect(canWriteBillingInvoiceDrafts('accounting')).toBe(true);
    expect(canWriteBillingInvoiceDrafts('warehouse_manager')).toBe(false);
  });
});
