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
  const getStoredLanguage = () => {
    try {
      const stored = localStorage.getItem('tgd_wms_lang');
      return stored ? normalizeLanguage(stored) : getInitialLanguage(initialLanguage);
    } catch (e) {
      return getInitialLanguage(initialLanguage);
    }
  };

  const [language, setLanguageState] = useState(getStoredLanguage);

  const setNormalizedLanguage = (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage);
    setLanguageState(normalized);
    try {
      localStorage.setItem('tgd_wms_lang', normalized);
    } catch (e) {
      // Ignore
    }
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
