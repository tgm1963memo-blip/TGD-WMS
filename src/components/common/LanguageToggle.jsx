import React from 'react';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { SUPPORTED_LANGUAGES } from '../../i18n/translationCatalog.js';

function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="language-toggle-compact" aria-label="Current language" role="group">
      <button
        aria-label="Thai"
        aria-pressed={language === 'th'}
        className={`lang-btn${language === 'th' ? ' active' : ''}`}
        onClick={() => setLanguage('th')}
        type="button"
      >
        TH
      </button>
      <button
        aria-label={language === 'th' ? 'Toggle language' : 'English'}
        aria-pressed={language === 'en'}
        className={`lang-btn${language === 'en' ? ' active' : ''}`}
        onClick={() => setLanguage('en')}
        type="button"
      >
        EN
      </button>
    </div>
  );
}

export default LanguageToggle;
