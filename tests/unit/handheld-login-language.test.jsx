import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/features/handheld/HandheldContext.jsx', () => ({
  useHandheldAuth: () => ({
    listHandheldStaff: async () => [],
    loginWithPin: vi.fn(),
  }),
}));

import { HandheldLoginPage } from '../../src/features/handheld/HandheldLoginPage.jsx';
import { LanguageProvider } from '../../src/i18n/languageProvider.jsx';

function renderLogin(language) {
  return render(
    <LanguageProvider initialLanguage={language}>
      <HandheldLoginPage />
    </LanguageProvider>,
  );
}

describe('HandheldLoginPage language', () => {
  afterEach(cleanup);

  it('follows the UI language in Thai', () => {
    renderLogin('th');
    expect(screen.getByText('เลือกชื่อของคุณเพื่อเข้าสู่ระบบ')).toBeInTheDocument();
  });

  it('follows the UI language in English', () => {
    renderLogin('en');
    expect(screen.getByText('Select your name to continue')).toBeInTheDocument();
  });
});
