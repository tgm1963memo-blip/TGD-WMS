import React from 'react';
import { Menu } from 'lucide-react';
import LanguageToggle from '../common/LanguageToggle.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

/**
 * Top bar: "section / page" breadcrumb on the left, environment status and
 * language on the right. The app name stays as an sr-only heading.
 */
export function Topbar({ currentSection, sectionLabel = null, onMenuToggle }) {
  const { language } = useLanguage();
  const goLive = isGoLivePresentationEnabled();

  return (
    <header className="header topbar app-header">
      <div className="topbar-left">
        <button
          type="button"
          className="sidebar-hamburger"
          onClick={onMenuToggle}
          aria-label="Toggle navigation"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
        <nav className="topbar-crumbs" aria-label="Breadcrumb">
          {sectionLabel ? (
            <>
              <span className="topbar-crumb-section">{sectionLabel}</span>
              <span className="topbar-crumb-sep" aria-hidden="true">/</span>
            </>
          ) : null}
          <span className="topbar-crumb-page header-section" aria-current="page">{currentSection}</span>
        </nav>
        <h1 className="sr-only">{getTranslation('tgm_cold_storage_wms', language)}</h1>
        <h2 className="sr-only">TGC WMS</h2>
      </div>
      <div className="header-actions">
        {!goLive ? (
          <>
            <span className="status-badge status-badge--uat hide-xs">{getTranslation('uat_mode', language)}</span>
            <span className="production-hold-badge hide-xs">{getTranslation('production_hold', language)}</span>
          </>
        ) : (
          <span className="status-badge status-badge--confirmed">{getTranslation('system_online', language)}</span>
        )}
        <LanguageToggle />
      </div>
    </header>
  );
}
