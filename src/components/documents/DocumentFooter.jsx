import React from 'react';
import { getDefaultDocumentBranding, normalizeDocumentBrandingConfig } from '../../config/documentBrandingConfig.js';

function getLocalizedValue(branding, baseKey, language) {
  return branding[`${baseKey}_${language}`] || branding[`${baseKey}_th`] || branding[`${baseKey}_en`] || '';
}

export function DocumentFooter({
  branding = getDefaultDocumentBranding(),
  language = 'th',
  preparedBy,
  approvedBy,
}) {
  const normalized = normalizeDocumentBrandingConfig(branding);
  const footerNote = getLocalizedValue(normalized, 'document_footer_note', language);
  const preparedByLabel = getLocalizedValue(normalized, 'prepared_by_label', language);
  const approvedByLabel = getLocalizedValue(normalized, 'approved_by_label', language);

  return (
    <footer className="document-footer">
      <p>{footerNote}</p>
      <div className="document-footer__signatures">
        <span>
          {preparedByLabel}: {preparedBy || '-'}
        </span>
        <span>
          {approvedByLabel}: {approvedBy || '-'}
        </span>
      </div>
    </footer>
  );
}
