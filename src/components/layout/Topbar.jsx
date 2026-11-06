import React from 'react';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import LanguageToggle from '../common/LanguageToggle.jsx';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { isGoLivePresentationEnabled } from '../../config/goLivePresentation.js';

/**
 * Top bar: "section / page" breadcrumb on the left, environment status and
 * language on the right. The app name stays as an sr-only heading.
 */
export function Topbar({ currentSection, sectionLabel = null, onMenuToggle, onSearch, theme = 'light', onToggleTheme }) {
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
        {onSearch ? (
          <button
            type="button"
            className="topbar-search"
            onClick={onSearch}
            aria-label={language === 'th' ? 'ค้นหา (Ctrl K)' : 'Search (Ctrl K)'}
            data-testid="topbar-search"
          >
            <Search size={16} aria-hidden="true" />
            <span className="topbar-search-text">{language === 'th' ? 'ค้นหา Lot, ใบฝาก, ใบเบิก…' : 'Search lots, documents…'}</span>
            <kbd className="topbar-search-kbd">Ctrl K</kbd>
          </button>
        ) : null}
        {!goLive ? (
          <>
            <span className="status-badge status-badge--uat hide-xs">{getTranslation('uat_mode', language)}</span>
            <span className="production-hold-badge hide-xs">{getTranslation('production_hold', language)}</span>
          </>
        ) : (
          <span className="status-badge status-badge--confirmed">{getTranslation('system_online', language)}</span>
        )}
        {onToggleTheme ? (
          <button
            type="button"
            className="topbar-theme"
            onClick={onToggleTheme}
            aria-pressed={theme === 'dark'}
            aria-label={language === 'th' ? 'โหมดมืด' : 'Dark mode'}
            data-testid="topbar-theme"
          >
            {theme === 'dark' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
        ) : null}
        <LanguageToggle />
      </div>
    </header>
  );
}
