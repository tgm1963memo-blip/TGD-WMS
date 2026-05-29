import React from 'react';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { DocumentHeader } from '../../components/documents/DocumentHeader.jsx';
import { DocumentFooter } from '../../components/documents/DocumentFooter.jsx';
import { previewDocumentBrandingConfig } from '../../services/documentBrandingService.js';
import { getTranslation } from '../../i18n/translationCatalog.js';

export function DocumentBrandingPreviewPage() {
  const { branding, summary } = previewDocumentBrandingConfig();

  return (
    <section className="page-shell">
      <PageHeader
        title={getTranslation('document_branding_preview', 'en') || 'Document Branding Preview'}
        description="Preview/foundation only. No save, file action, or persistence action is available in Sprint 10A."
      />

      <p className="sprint-status tgm-status-pill">{getTranslation('preview_only', 'en') || 'Preview only'}</p>
      <p>Status: {summary.status}</p>

      <SectionCard title="Thai Preview">
        <DocumentHeader
          branding={branding}
          language="th"
          documentTitle="ตัวอย่างเอกสารคลังเย็น"
          documentNo="PREVIEW-TH-001"
          documentDate="2026-05-27"
        />
        <DocumentFooter branding={branding} language="th" preparedBy="UAT User" approvedBy="Controller" />
      </SectionCard>

      <SectionCard title="English Preview">
        <DocumentHeader
          branding={branding}
          language="en"
          documentTitle="Cold Storage Document Preview"
          documentNo="PREVIEW-EN-001"
          documentDate="2026-05-27"
        />
        <DocumentFooter branding={branding} language="en" preparedBy="UAT User" approvedBy="Controller" />
      </SectionCard>
    </section>
  );
}
