import { expect, test, vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../src/features/auth/AuthContext.jsx';
import { LoginPage } from '../../src/features/auth/LoginPage.jsx';
import { AppRoutes } from '../../src/app/routes.jsx';

vi.mock('../../src/services/stagingAuthService.js', () => ({
  getStagingSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  subscribeToStagingAuth: vi.fn(() => ({ unsubscribe: vi.fn() })),
}));

test('LoginPage renders standalone without layout wrappers', async () => {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>
  );

  // Expect login container to be present
  await waitFor(() => {
    expect(screen.getByText('TGM Cold Storage WMS')).toBeInTheDocument();
    expect(screen.getByText('เข้าสู่ระบบ Staging')).toBeInTheDocument();
  });

  // Expect sidebar/topbar to NOT be present
  expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
});
