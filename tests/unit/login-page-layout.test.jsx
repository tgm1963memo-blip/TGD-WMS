import { expect, test, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { UserRoleProvider } from '../../src/features/auth/UserRoleProvider.jsx';
import { AppRoutes } from '../../src/app/routes.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  subscribeToStagingAuth: vi.fn((onChange) => {
    onChange(null);
    return { unsubscribe: vi.fn() };
  }),
  subscribeToAuthEvents: vi.fn(() => ({ unsubscribe: vi.fn() })),
  verifyRecoveryToken: vi.fn(async () => ({ data: null, error: null })),
}));

vi.mock('../../src/services/userProfileService.js', () => ({
  getCurrentUserProfile: vi.fn().mockResolvedValue({ data: null, error: null }),
}));

test('LoginPage renders standalone without layout wrappers', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LanguageProvider initialLanguage="th">
        <AuthProvider>
          <UserRoleProvider>
            <AppRoutes />
          </UserRoleProvider>
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>,
  );

  await waitFor(() => {
    expect(screen.getByText('TG Cold Storage WMS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
  });

  expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
});
