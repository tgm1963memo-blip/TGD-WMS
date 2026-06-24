import React from 'react';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';
import { getTranslation } from '../../i18n/translationCatalog.js';

function getLocalizedValue(branding, baseKey, language) {
  return branding[`${baseKey}_${language}`] || branding[`${baseKey}_th`] || branding[`${baseKey}_en`] || '';
}

export function DocumentHeader({
  branding = getDefaultDocumentBranding(),
  documentTitle,
  language = 'th',
  documentNo,
  documentDate,
}) {
  const normalized = normalizeDocumentBrandingConfig(branding);
  const companyName = getLocalizedValue(normalized, 'company_name', language);
  const address = getLocalizedValue(normalized, 'company_address', language);

  return (
    <header className="document-header">
      <div className="document-header__brand">
        {normalized.logo_url ? (
          <img className="document-header__logo" src={normalized.logo_url} alt={getTranslation('company_logo', language) || 'Company logo'} />
        ) : (
          <div className="document-header__logo-placeholder">{getTranslation('no_logo_configured', language) || 'No logo configured'}</div>
        )}
        <div>
          <h2>{companyName}</h2>
          <p>{address}</p>
          <p>
            {normalized.phone && <span>{normalized.phone}</span>}
            {normalized.email && <span> | {normalized.email}</span>}
            {normalized.website && <span> | {normalized.website}</span>}
            {normalized.tax_id && <span> | เลขประจำตัวผู้เสียภาษี: {normalized.tax_id}</span>}
          </p>
        </div>
      </div>
      <div className="document-header__meta">
        <h1>{documentTitle}</h1>
        {documentNo && (
          <p>
            {getTranslation('document_no', language) || 'Document No.'}: {documentNo}
          </p>
        )}
        {documentDate && (
          <p>
            {getTranslation('document_date', language) || 'Document Date'}: {documentDate}
          </p>
        )}
      </div>
    </header>
  );
}
