import React from 'react';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import { SUPPORTED_LANGUAGES } from '../../i18n/translationCatalog.js';

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const t = useTranslation();

  const toggle = () => {
    const nextLang = language === SUPPORTED_LANGUAGES[0] ? SUPPORTED_LANGUAGES[1] : SUPPORTED_LANGUAGES[0];
    setLanguage(nextLang);
  };

  const currentLanguageLabel = language === 'th' ? 'ไทย' : 'English';
  const nextLanguageLabel = language === 'th' ? 'English' : 'ไทย';

  return (
    <div className="language-toggle" aria-label="Current language">
      <span className="language-toggle-label">
        {t('current_language') || 'Current language'} / Current language: {currentLanguageLabel}
      </span>
      <button className="language-toggle-btn btn btn-outline" onClick={toggle} aria-label="Toggle language" type="button">
        {nextLanguageLabel}
      </button>
    </div>
  );
}

export default LanguageToggle;
