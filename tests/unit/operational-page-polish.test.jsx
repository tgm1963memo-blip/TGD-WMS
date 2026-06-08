import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import { ReceivingListPage } from '../../src/features/operations/receiving/ReceivingListPage.jsx';
import { DocumentFilterBar } from '../../src/components/operations/DocumentFilterBar.jsx';
import { DocumentToolbar } from '../../src/components/operations/DocumentToolbar.jsx';

vi.mock('../../src/services/receivingService.js', () => ({
  getReceivingDocuments: vi.fn().mockResolvedValue({ 
    data: [{ id: '1', receiving_no: 'RCV-001', status: 'DRAFT' }], 
    error: null 
  })
}));

describe('19C Operational Page Polish', () => {
  it('ReceivingListPage renders compact page structure', async () => {
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <ReceivingListPage />
        </LanguageProvider>
      </MemoryRouter>
    );

    // Verify shell wrapper
    expect(container.querySelector('.page-shell')).toBeInTheDocument();
    
    // Verify table structure wrapper
    await waitFor(() => {
      expect(container.querySelector('.table-responsive')).toBeInTheDocument();
    });
  });

  it('DocumentFilterBar uses compact class structure', () => {
    const { container } = render(
      <LanguageProvider>
        <DocumentFilterBar onChange={() => {}} />
      </LanguageProvider>
    );

    // Filter grid layout
    expect(container.querySelector('.filter-grid')).toBeInTheDocument();
    
    // Check input controls use .form-control
    expect(container.querySelectorAll('.form-control').length).toBeGreaterThan(0);
    
    // Check button uses .btn
    expect(container.querySelector('.btn')).toBeInTheDocument();
  });

  it('DocumentToolbar uses compact flex layout', () => {
    const { container } = render(
      <MemoryRouter>
        <LanguageProvider>
          <DocumentToolbar title="Test Title" createHref="/test/create" />
        </LanguageProvider>
      </MemoryRouter>
    );

    // Should contain a btn-primary-gold for the main action
    expect(container.querySelector('.btn-primary-gold')).toBeInTheDocument();
  });
});
