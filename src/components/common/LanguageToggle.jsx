import React from 'react';
import { useLanguage, useTranslation } from '../../i18n/languageProvider.jsx';
import { SUPPORTED_LANGUAGES } from '../../i18n/translationCatalog.js';
import { brandConfig } from '../../config/brandConfig.js';

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
    <div
      className="language-toggle"
      aria-label="Current language"
      style={{
        alignItems: 'center',
        background: brandConfig.colors.goldSoft,
        border: `1px solid ${brandConfig.colors.gold}`,
        borderRadius: 8,
        color: brandConfig.colors.black,
        display: 'inline-flex',
        gap: 8,
        minHeight: 32,
        padding: '4px 8px',
        fontSize: 13,
      }}
    >
      <span>
        {t('current_language') || 'Current language'} / Current language: {currentLanguageLabel}
      </span>
      <button
        onClick={toggle}
        style={{
          background: brandConfig.colors.gold,
          border: 0,
          borderRadius: 7,
          color: brandConfig.colors.black,
          cursor: 'pointer',
          fontWeight: 700,
          minHeight: 32,
          padding: '6px 12px',
        }}
        aria-label="Toggle language"
        type="button"
      >
        {nextLanguageLabel}
      </button>
    </div>
  );
}

export default LanguageToggle;
