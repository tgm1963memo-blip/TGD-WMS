// tests/unit/role-based-navigation-i18n.test.jsx

import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { getCurrentUserRole, setDemoUserRole, listAvailableDemoRoles, DEFAULT_DEMO_ROLE } from '../../src/security/currentUserRole.js';
import UserRoleDemoSelector from '../../src/components/common/UserRoleDemoSelector.jsx';
import ReportsPage from '../../src/features/reports/ReportsPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';
import LanguageToggle from '../../src/components/common/LanguageToggle.jsx';
import { getTranslation } from '../../src/i18n/translationCatalog.js';
import fs from 'fs';
import path from 'path';
/** Helper to render with LanguageProvider */
function renderWithLanguage(ui, { lang = 'th' } = {}) {
  return render(
    <LanguageProvider initialLanguage={lang}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </LanguageProvider>
  );
}

describe('Demo role source', () => {
  test('exports exist and default role is admin', () => {
    expect(typeof getCurrentUserRole).toBe('function');
    expect(typeof setDemoUserRole).toBe('function');
    expect(typeof listAvailableDemoRoles).toBe('function');
    expect(getCurrentUserRole()).toBe('admin');
  });

  test('role switching works in memory', () => {
    setDemoUserRole('viewer');
    expect(getCurrentUserRole()).toBe('viewer');
    setDemoUserRole('accounting');
    expect(getCurrentUserRole()).toBe('accounting');
  });
});

describe('UserRoleDemoSelector component', () => {
  test('renders selector with current role and options', () => {
    setDemoUserRole('viewer');
    renderWithLanguage(<UserRoleDemoSelector />);
    expect(screen.getByText(/Demo only – frontend role selector/i)).toBeInTheDocument();
    expect(screen.getByText(/Current role:/i)).toBeInTheDocument();
    const select = screen.getByLabelText(/Switch role:/i);
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('viewer');
    // ensure all demo roles are present
    listAvailableDemoRoles().forEach((role) => {
      expect(screen.getByRole('option', { name: role })).toBeInTheDocument();
    });
  });
});

describe('ReportsPage role‑based visibility', () => {
  const getCardTitle = (key) => getTranslation(key, 'th') || key.replace(/_/g, ' ');

  test('admin sees all report cards', () => {
    setDemoUserRole('admin');
    renderWithLanguage(<ReportsPage />);
    const titles = [
      'movement_ledger_report',
      'customer_storage_balance_report',
      'storage_aging_report',
      'warehouse_operation_performance_report',
      'monthly_storage_billing_summary',
      'accounting_charge_staging_preview',
      'accounting_charge_handoff_review_draft',
    ];
    titles.forEach((key) => {
      expect(screen.getByText(getCardTitle(key))).toBeInTheDocument();
    });
  });

  test('viewer sees only general read‑only reports', () => {
    setDemoUserRole('viewer');
    renderWithLanguage(<ReportsPage />);
    const visible = [
      'movement_ledger_report',
      'customer_storage_balance_report',
      'storage_aging_report',
      'warehouse_operation_performance_report',
      'monthly_storage_billing_summary',
    ];
    const hidden = [
      'accounting_charge_staging_preview',
      'accounting_charge_handoff_review_draft',
    ];
    visible.forEach((key) => {
      expect(screen.getByText(getCardTitle(key))).toBeInTheDocument();
    });
    hidden.forEach((key) => {
      expect(screen.queryByText(getCardTitle(key))).toBeNull();
    });
  });

  test('accounting sees general reports plus accounting cards', () => {
    setDemoUserRole('accounting');
    renderWithLanguage(<ReportsPage />);
    const visible = [
      'movement_ledger_report',
      'customer_storage_balance_report',
      'storage_aging_report',
      'warehouse_operation_performance_report',
      'monthly_storage_billing_summary',
      'accounting_charge_staging_preview',
      'accounting_charge_handoff_review_draft',
    ];
    visible.forEach((key) => {
      expect(screen.getByText(getCardTitle(key))).toBeInTheDocument();
    });
  });
});

describe('LanguageToggle placement and function', () => {
  test('toggle appears in ReportsPage header and switches language', () => {
    setDemoUserRole('admin');
    renderWithLanguage(<ReportsPage />, { lang: 'th' });
    const toggle = screen.getByRole('button', { name: /Toggle language/i });
    expect(toggle).toBeInTheDocument();
    // button shows English label when current language is Thai
    expect(toggle).toHaveTextContent('English');
    fireEvent.click(toggle);
    // After click, language should be English; button now shows Thai label
    expect(toggle).toHaveTextContent('ไทย');
  });
});

/** Safety checks – ensure no forbidden globals are used */
describe('Safety checks', () => {
  test('no localStorage, sessionStorage, or fetch usage in demo files', () => {
    const demoFiles = [
      '../../src/security/currentUserRole.js',
      '../../src/components/common/UserRoleDemoSelector.jsx',
      '../../src/components/common/LanguageToggle.jsx',
    ];
     demoFiles.forEach((filePath) => {
       const absolutePath = path.resolve(__dirname, filePath);
       const source = fs.readFileSync(absolutePath, 'utf8');
      expect(source).not.toMatch(/localStorage/);
      expect(source).not.toMatch(/sessionStorage/);
      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/axios/);
      expect(source).not.toMatch(/Supabase/);
    });
  });
});
