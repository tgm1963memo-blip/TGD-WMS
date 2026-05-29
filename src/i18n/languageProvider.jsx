// src/i18n/languageProvider.jsx
import React, { createContext, useContext, useState } from 'react';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, getTranslation } from './translationCatalog.js';

/**
 * Returns the initial language for the app.
 * According to spec, it should be DEFAULT_LANGUAGE unless explicitly passed.
 */
export function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

export function getInitialLanguage(explicitLanguage) {
  return normalizeLanguage(explicitLanguage);
}

// Create a Context for language state.
export const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
});

/**
 * LanguageProvider component – holds in‑memory language state.
 * Wraps the application (or a subtree) to provide language via context.
 */
export const LanguageProvider = ({ children, initialLanguage }) => {
  const [language, setLanguage] = useState(getInitialLanguage(initialLanguage));
  const setNormalizedLanguage = (nextLanguage) => {
    setLanguage(normalizeLanguage(nextLanguage));
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setNormalizedLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

/** Hook to access language context. */
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const useTranslation = () => {
  const { language } = useLanguage();
  return (key) => getTranslation(key, language);
};

export default LanguageProvider;
