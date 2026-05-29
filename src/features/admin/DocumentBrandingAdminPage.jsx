import React, { useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader.jsx';
import { SectionCard } from '../../components/layout/SectionCard.jsx';
import { DocumentBrandingForm } from '../../components/documents/DocumentBrandingForm.jsx';
import { DocumentHeader } from '../../components/documents/DocumentHeader.jsx';
import { DocumentFooter } from '../../components/documents/DocumentFooter.jsx';
import { getDefaultDocumentBranding } from '../../config/documentBrandingConfig.js';
import {
  getBrandingPersistenceReadiness,
  getLogoUploadReadiness,
} from '../../services/documentBrandingAdminService.js';

export function DocumentBrandingAdminPage() {
  const defaultBranding = getDefaultDocumentBranding();
  const [previewBranding, setPreviewBranding] = useState(defaultBranding);
  const persistenceReadiness = getBrandingPersistenceReadiness();
  const logoReadiness = getLogoUploadReadiness();

  return (
    <section className="page-shell">
      <PageHeader
        title="ตั้งค่าเอกสาร (Document Branding Settings)"
        description="แก้ไขแบบร่างในหน้าจอเท่านั้น ยังไม่บันทึกลงฐานข้อมูล และยังไม่เปิดใช้การอัปโหลดโลโก้"
      />

      <DocumentBrandingForm
        initialBranding={defaultBranding}
        language="th"
        onPreviewChange={setPreviewBranding}
      />

      <SectionCard title="Thai Preview">
        <DocumentHeader
          branding={previewBranding}
          language="th"
          documentTitle="ตัวอย่างเอกสารคลังเย็น"
          documentNo="BRAND-TH-001"
          documentDate="2026-05-27"
        />
        <DocumentFooter branding={previewBranding} language="th" preparedBy="ผู้ใช้งาน" approvedBy="ผู้ควบคุม" />
      </SectionCard>

      <SectionCard title="English Preview">
        <DocumentHeader
          branding={previewBranding}
          language="en"
          documentTitle="Cold Storage Document Preview"
          documentNo="BRAND-EN-001"
          documentDate="2026-05-27"
        />
        <DocumentFooter branding={previewBranding} language="en" preparedBy="User" approvedBy="Controller" />
      </SectionCard>

      <section className="document-section tgm-warning-section">
        <h2>ข้อจำกัดปัจจุบัน</h2>
        <p>{persistenceReadiness.message}</p>
        <p>{logoReadiness.message}</p>
      </section>
    </section>
  );
}
