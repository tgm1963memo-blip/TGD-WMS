import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  listCustomerDepositRequests: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

describe('19C Operational Page Polish', () => {
  it('ReceivingListPage renders compact page structure', async () => {
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <ReceivingListPage />
        </LanguageProvider>
      </MemoryRouter>,
    );

    expect(container.querySelector('.page-shell')).toBeInTheDocument();
    expect(screen.getByTestId('receiving-source-document-guidance')).toBeInTheDocument();
  });
});
