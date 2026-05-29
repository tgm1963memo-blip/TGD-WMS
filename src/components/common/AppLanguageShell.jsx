import React from 'react';
import { LanguageProvider } from '../../i18n/languageProvider.jsx';

export default function AppLanguageShell({ children }) {
  return (
    <LanguageProvider>
      {children}
    </LanguageProvider>
  );
}
