import React from 'react';
import LanguageToggle from '../common/LanguageToggle.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

export function Topbar({ currentSection }) {
  const { language } = useLanguage();
  const goLive = isGoLivePresentationEnabled();

  return (
    <header className="header topbar app-header">
      <div className="header-title tgm-topbar-title">
        <span className="header-section eyebrow">{currentSection}</span>
        <h1 className="header-page-title">
          {getTranslation('tgm_cold_storage_wms', language)}
        </h1>
        <h2 className="sr-only">TGC WMS</h2>
      </div>
      <div className="header-actions">
        {!goLive ? (
          <>
            <span className="status-badge status-badge--uat">{getTranslation('uat_mode', language)}</span>
            <span className="production-hold-badge">{getTranslation('production_hold', language)}</span>
          </>
        ) : (
          <span className="status-badge status-badge--confirmed">{getTranslation('system_online', language)}</span>
        )}
        <LanguageToggle />
      </div>
    </header>
  );
}
