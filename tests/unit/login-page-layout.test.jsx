import { expect, test, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { AppRoutes } from '../../src/app/routes.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  subscribeToStagingAuth: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

test('LoginPage renders standalone without layout wrappers', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <LanguageProvider initialLanguage="th">
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </LanguageProvider>
    </MemoryRouter>
  );

  // Expect login container to be present
  await waitFor(() => {
    expect(screen.getByText('TGM Cold Storage WMS')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
    expect(screen.getByTestId('forgot-password-link')).toBeInTheDocument();
  });

  // Expect sidebar/topbar to NOT be present
  expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
});
