import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LanguageProvider, useLanguage, useTranslation } from '../../src/i18n/languageProvider.jsx';
import { DEFAULT_LANGUAGE, TRANSLATION_CATALOG, getTranslation } from '../../src/i18n/translationCatalog.js';
import LanguageToggle from '../../src/components/common/LanguageToggle.jsx';

const requiredKeys = [
  'app_name',
  'dashboard',
  'reports',
  'admin',
  'warehouse',
  'master_data',
  'receiving',
  'putaway',
  'transfer',
  'adjustment',
  'stock_count',
  'customer_withdrawal',
  'allocation',
  'picking',
  'dispatch_goods_issue',
  'inventory_dashboard',
  'movement_ledger',
  'customer_storage_balance',
  'storage_aging',
  'monthly_storage_billing_summary',
  'accounting_charge_review',
  'document_branding',
  'auth_readiness',
  'save',
  'cancel',
  'search',
  'filter',
  'reset',
  'clear',
  'view',
  'edit',
  'delete',
  'back',
  'next',
  'previous',
  'loading',
  'no_data',
  'status',
  'date',
  'customer',
  'product',
  'lot',
  'pallet',
  'location',
  'quantity',
  'weight',
  'created_at',
  'updated_at',
  'action',
  'warning',
  'error',
  'success',
  'preview_only',
  'not_saved_to_database',
];

function CurrentLanguageProbe() {
  const { language } = useLanguage();
  return <span data-testid="current-language">{language}</span>;
}

function ReportsLabelProbe() {
  const t = useTranslation();
  return <span data-testid="reports-label">{t('reports')}</span>;
}

describe('Thai language activation', () => {
  it('defaults to Thai', () => {
    expect(DEFAULT_LANGUAGE).toBe('th');

    render(
      <LanguageProvider>
        <CurrentLanguageProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('current-language')).toHaveTextContent('th');
  });

  it('renders a visible language toggle', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
      </LanguageProvider>
    );

    expect(screen.getByLabelText('Current language')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thai' })).toHaveTextContent('TH');
    expect(screen.getByRole('button', { name: /Toggle language/i })).toHaveTextContent('EN');
  });

  it('switches to English and back to Thai', () => {
    render(
      <LanguageProvider>
        <LanguageToggle />
        <CurrentLanguageProbe />
        <ReportsLabelProbe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('reports-label')).toHaveTextContent(getTranslation('reports', 'th'));

    fireEvent.click(screen.getByRole('button', { name: /Toggle language/i }));
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');
    expect(screen.getByTestId('reports-label')).toHaveTextContent('Reports');

    fireEvent.click(screen.getByRole('button', { name: 'Thai' }));
    expect(screen.getByTestId('current-language')).toHaveTextContent('th');
    expect(screen.getByTestId('reports-label')).toHaveTextContent(getTranslation('reports', 'th'));
  });

  it('has Thai translations for major navigation and report labels', () => {
    expect(getTranslation('receiving', 'th')).not.toBe('Receiving');
    expect(getTranslation('monthly_storage_billing_summary', 'th')).not.toBe('Monthly Storage Billing Summary');
    expect(getTranslation('accounting_charge_review', 'th')).not.toBe('Accounting Charge Review');
  });

  it('contains th/en values for every required Sprint 12C key', () => {
    for (const key of requiredKeys) {
      expect(TRANSLATION_CATALOG[key], key).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].th, `${key}.th`).toBeTruthy();
      expect(TRANSLATION_CATALOG[key].en, `${key}.en`).toBeTruthy();
    }
  });
});
