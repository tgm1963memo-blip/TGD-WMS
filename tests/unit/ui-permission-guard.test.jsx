// tests/unit/ui-permission-guard.test.jsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import PermissionDeniedNotice from '../../src/components/common/PermissionDeniedNotice.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

describe('PermissionDeniedNotice component', () => {
  test('renders Thai text by default', () => {
    render(
      <LanguageProvider>
        <PermissionDeniedNotice />
      </LanguageProvider>
    );
    expect(screen.getByText('ไม่มีสิทธิ์เข้าถึง')).toBeInTheDocument();
    expect(screen.getByText('สิทธิ์ไม่เพียงพอ')).toBeInTheDocument();
    expect(screen.getByText('ติดต่อผู้ดูแลระบบ')).toBeInTheDocument();
  });

  test('renders English text when language is set to en', () => {
    render(
      <LanguageProvider initialLanguage="en">
        <PermissionDeniedNotice />
      </LanguageProvider>
    );
    expect(screen.getByText('Permission denied')).toBeInTheDocument();
    expect(screen.getByText('Insufficient permission')).toBeInTheDocument();
    expect(screen.getByText('Contact admin')).toBeInTheDocument();
  });
});
