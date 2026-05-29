// src/components/common/PermissionDeniedNotice.jsx
import React from 'react';
import { useLanguage } from '../../i18n/languageProvider';
import { getTranslation } from '../../i18n/translationCatalog';
import { brandConfig } from '../../config/brandConfig.js';

/**
 * PermissionDeniedNotice – displays a friendly access‑denied message.
 * Uses the translation keys: permission_denied, insufficient_permission, contact_admin.
 * No side‑effects, network, or storage usage.
 */
export default function PermissionDeniedNotice() {
  const { language } = useLanguage();
  const title = getTranslation('permission_denied', language);
  const detail = getTranslation('insufficient_permission', language);
  const contact = getTranslation('contact_admin', language);

  return (
    <div style={containerStyle} data-testid="permission-denied-notice">
      <h2>{title}</h2>
      <p>{detail}</p>
      <p>{contact}</p>
    </div>
  );
}

const containerStyle = {
  background: brandConfig.colors.redSoft,
  border: `1px solid ${brandConfig.colors.red}`,
  borderRadius: brandConfig.ui.borderRadius,
  boxShadow: '0 10px 28px rgba(193, 18, 31, 0.14)',
  color: '#8f0d18',
  padding: '16px',
  margin: '8px 0',
  fontFamily: 'Inter, sans-serif',
};
