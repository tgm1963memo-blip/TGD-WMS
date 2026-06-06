import React from 'react';
import LanguageToggle from '../common/LanguageToggle.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { brandConfig } from '../../config/brandConfig.js';

/**
 * Topbar – Black & Gold Professional header bar.
 * Shows brand, current section, and language toggle.
 */
export function Topbar({ currentSection }) {
  const { language } = useLanguage();

  return (
    <header
      className="header topbar"
      style={{
        alignItems: 'center',
        background: 'var(--tgd-sidebar-bg)',
        borderBottom: '1px solid rgba(212, 175, 55, 0.30)',
        color: '#ffffff',
        display: 'flex',
        gap: 12,
        justifyContent: 'space-between',
        minHeight: 64,
        padding: '12px clamp(16px, 3vw, 24px)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div className="tgm-topbar-title">
        <img alt="TGM logo" className="tgm-topbar-logo" src={brandConfig.logoPath} />
        <div>
          <p className="eyebrow" style={{ color: 'var(--tgd-primary-gold)', margin: 0 }}>
            {currentSection}
          </p>
          <h1 style={{ color: '#ffffff', fontSize: 20, lineHeight: 1.2, margin: '4px 0 0' }}>
            {getTranslation('tgm_cold_storage_wms', language) || brandConfig.brandName}
          </h1>
          <h2 className="sr-only">TGD WMS</h2>
        </div>
      </div>
      <LanguageToggle />
    </header>
  );
}
