import React, { useMemo, useState } from 'react';
import {
  DOCUMENT_BRANDING_EDITABLE_FIELDS,
  getDefaultDocumentBranding,
} from '../../config/documentBrandingConfig.js';
import {
  createEditableBrandingDraft,
  previewEditableBrandingDraft,
} from '../../services/documentBrandingAdminService.js';

const FIELD_LABELS_TH = {
  company_name_th: 'ชื่อบริษัทภาษาไทย',
  company_name_en: 'ชื่อบริษัทภาษาอังกฤษ',
  company_address_th: 'ที่อยู่ภาษาไทย',
  company_address_en: 'ที่อยู่ภาษาอังกฤษ',
  tax_id: 'เลขประจำตัวผู้เสียภาษี',
  phone: 'โทรศัพท์',
  email: 'อีเมล',
  website: 'เว็บไซต์',
  logo_url: 'Logo Reference / URL',
  document_footer_note_th: 'ข้อความท้ายเอกสารภาษาไทย',
  document_footer_note_en: 'ข้อความท้ายเอกสารภาษาอังกฤษ',
  prepared_by_label_th: 'ป้ายชื่อผู้จัดทำภาษาไทย',
  prepared_by_label_en: 'Prepared by label',
  approved_by_label_th: 'ป้ายชื่อผู้อนุมัติภาษาไทย',
  approved_by_label_en: 'Approved by label',
  effective_date: 'วันที่เริ่มใช้',
  document_version: 'เวอร์ชันเอกสาร',
};

function getInputType(field) {
  if (field === 'effective_date') return 'date';
  if (field === 'email') return 'email';
  if (field === 'website' || field === 'logo_url') return 'text';
  return 'text';
}

export function DocumentBrandingForm({
  initialBranding = getDefaultDocumentBranding(),
  language = 'th',
  onPreviewChange,
}) {
  const initialDraft = useMemo(() => createEditableBrandingDraft(initialBranding), [initialBranding]);
  const [draft, setDraft] = useState(initialDraft);
  const preview = previewEditableBrandingDraft(draft);
  const warnings = [...preview.validation.errors, ...preview.validation.warnings];

  function handleChange(field, value) {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handlePreview() {
    if (onPreviewChange) {
      onPreviewChange(preview.branding);
    }
  }

  function handleReset() {
    setDraft(initialDraft);
    if (onPreviewChange) {
      onPreviewChange(initialDraft);
    }
  }

  return (
    <section className="document-branding-form" aria-label="Document branding settings">
      <div className="document-section">
        <h2>{language === 'en' ? 'Edit Document Branding' : 'แก้ไขการตั้งค่าเอกสาร'}</h2>
        <p className="sprint-status">
          Preview only / not saved to database. Logo upload is not enabled.
        </p>
      </div>

      <div className="document-section">
        <h3>ข้อมูลบริษัท (Company Information)</h3>
        {DOCUMENT_BRANDING_EDITABLE_FIELDS.map((field) => (
          <label className="form-field" key={field}>
            <span>{FIELD_LABELS_TH[field] || field}</span>
            <input
              type={getInputType(field)}
              value={draft[field] || ''}
              onChange={(event) => handleChange(field, event.target.value)}
              aria-label={FIELD_LABELS_TH[field] || field}
            />
          </label>
        ))}
      </div>

      <div className="document-section">
        <h3>Branding Validation Warning</h3>
        {warnings.length > 0 ? (
          <ul>
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>พร้อมแสดงตัวอย่าง (Ready for preview)</p>
        )}
      </div>

      <div className="document-toolbar">
        <button type="button" onClick={handlePreview}>
          Update preview
        </button>
        <button type="button" onClick={handleReset}>
          Reset draft
        </button>
      </div>
    </section>
  );
}
