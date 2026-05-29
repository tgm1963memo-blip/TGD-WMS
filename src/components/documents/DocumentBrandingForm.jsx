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
    <section className="form-page" aria-label="Document branding settings">
      <div className="form-section">
        <h2>{language === 'en' ? 'Edit Document Branding' : 'แก้ไขการตั้งค่าเอกสาร'}</h2>
        <div className="form-warning">
          Preview only / not saved to database. Logo upload is not enabled.
        </div>
      </div>
      <div className="form-section">
        <h3 className="form-section-header">ข้อมูลบริษัท (Company Information)</h3>
        <div className="form-grid">
          {DOCUMENT_BRANDING_EDITABLE_FIELDS.map((field) => (
            <label className="form-field" key={field}>
              <span className="form-label">{FIELD_LABELS_TH[field] || field}</span>
              <input
                className="form-input"
                type={getInputType(field)}
                value={draft[field] || ''}
                onChange={(e) => handleChange(field, e.target.value)}
                aria-label={FIELD_LABELS_TH[field] || field}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="form-section">
        <h3 className="form-section-header">Branding Validation Warning</h3>
        {warnings.length > 0 ? (
          <div className="form-warning">
            <ul>
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="form-label">พร้อมแสดงตัวอย่าง (Ready for preview)</p>
        )}
      </div>
      <div className="form-actions document-toolbar">
        <button className="form-button" type="button" onClick={handlePreview}>
          Update preview
        </button>
        <button className="form-button secondary" type="button" onClick={handleReset}>
          Reset draft
        </button>
      </div>
    </section>
  );
}
