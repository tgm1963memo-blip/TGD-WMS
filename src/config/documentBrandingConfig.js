export const DOCUMENT_BRANDING_FIELDS = [
  'company_name_th',
  'company_name_en',
  'company_address_th',
  'company_address_en',
  'tax_id',
  'phone',
  'email',
  'website',
  'logo_url',
  'document_footer_note_th',
  'document_footer_note_en',
  'prepared_by_label_th',
  'prepared_by_label_en',
  'approved_by_label_th',
  'approved_by_label_en',
  'effective_date',
  'document_version',
];

export const DOCUMENT_BRANDING_EDITABLE_FIELDS = Object.freeze([...DOCUMENT_BRANDING_FIELDS]);

export const DOCUMENT_BRANDING_REQUIRED_FIELDS = Object.freeze([
  'company_name_th',
]);

export const DOCUMENT_BRANDING_LOGO_RULES = Object.freeze({
  field: 'logo_url',
  allowedValueType: 'string',
  disallowFileObject: true,
  disallowDataImage: true,
  disallowUnsafeScheme: true,
  disallowSecretLikeValue: true,
});

export const DEFAULT_DOCUMENT_BRANDING = {
  company_name_th: 'บริษัท ทีจีดี โคลด์สโตเรจ จำกัด',
  company_name_en: 'TGD Coldstorage Co., Ltd.',
  company_address_th: 'ที่อยู่บริษัทสำหรับเอกสารคลังเย็น',
  company_address_en: 'Company address for cold storage documents',
  tax_id: '',
  phone: '',
  email: '',
  website: '',
  logo_url: '',
  document_footer_note_th: 'เอกสารนี้จัดทำจากระบบ TGD WMS เพื่อการปฏิบัติงานคลังเย็น',
  document_footer_note_en: 'This document is prepared from TGD WMS for cold storage operations.',
  prepared_by_label_th: 'จัดทำโดย',
  prepared_by_label_en: 'Prepared by',
  approved_by_label_th: 'อนุมัติโดย',
  approved_by_label_en: 'Approved by',
  effective_date: '',
  document_version: 'Draft',
};

const SECRET_LIKE_PATTERNS = [
  /SERVICE[_-]?ROLE/i,
  /SECRET/i,
  /PRIVATE/i,
  /PASSWORD/i,
  /TOKEN/i,
  /DATABASE[_-]?URL/i,
];

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasSecretLikeValue(value) {
  return SECRET_LIKE_PATTERNS.some((pattern) => pattern.test(value));
}

export function getDefaultDocumentBranding() {
  return { ...DEFAULT_DOCUMENT_BRANDING };
}

export function normalizeDocumentBrandingConfig(config = {}) {
  return DOCUMENT_BRANDING_FIELDS.reduce((normalized, field) => {
    normalized[field] = normalizeString(config[field] ?? DEFAULT_DOCUMENT_BRANDING[field]);
    return normalized;
  }, {});
}

export function validateDocumentLogoReference(logoReference) {
  const value = normalizeString(logoReference);
  const errors = [];
  const warnings = [];

  if (!value) {
    warnings.push('Logo URL is not configured; text fallback will be used.');
    return {
      ok: true,
      errors,
      warnings,
      value,
    };
  }

  if (typeof logoReference !== 'string') {
    errors.push('logo_url must be a URL, path, or reference string only');
  }

  if (/^javascript:/i.test(value)) {
    errors.push('unsafe logo reference is not allowed');
  }

  if (/^data:image\//i.test(value)) {
    errors.push('base64 logo value is not allowed');
  }

  if (hasSecretLikeValue(value)) {
    errors.push('service-role-like logo value is not allowed');
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    value,
  };
}

export function validateDocumentBrandingConfig(config = {}) {
  const normalized = normalizeDocumentBrandingConfig(config);
  const errors = [];
  const warnings = [];

  DOCUMENT_BRANDING_REQUIRED_FIELDS.forEach((field) => {
    if (!normalized[field]) {
      errors.push(`${field} is required`);
    }
  });

  if (!normalized.company_name_en) {
    warnings.push('company_name_en should be configured for English documents.');
  }

  if (!normalized.document_footer_note_th || !normalized.document_footer_note_en) {
    warnings.push('Document footer notes should be configured for Thai and English.');
  }

  const logoValidation = validateDocumentLogoReference(normalized.logo_url);
  errors.push(...logoValidation.errors);
  warnings.push(...logoValidation.warnings);

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    config: normalized,
  };
}

export function summarizeDocumentBrandingConfig(config = {}) {
  const validation = validateDocumentBrandingConfig(config);

  return {
    status: validation.ok ? 'READY' : 'ERROR',
    hasLogo: Boolean(validation.config.logo_url),
    companyNameThai: validation.config.company_name_th,
    companyNameEnglish: validation.config.company_name_en,
    documentVersion: validation.config.document_version,
    errors: validation.errors,
    warnings: validation.warnings,
  };
}

export function createDocumentBrandingDraft(baseConfig = getDefaultDocumentBranding()) {
  return normalizeDocumentBrandingConfig(baseConfig);
}

export function applyDocumentBrandingDraft(baseConfig = getDefaultDocumentBranding(), draft = {}) {
  const normalizedBase = normalizeDocumentBrandingConfig(baseConfig);
  const editableDraft = DOCUMENT_BRANDING_EDITABLE_FIELDS.reduce((nextConfig, field) => {
    if (Object.prototype.hasOwnProperty.call(draft, field)) {
      nextConfig[field] = normalizeString(draft[field]);
    }
    return nextConfig;
  }, { ...normalizedBase });

  return normalizeDocumentBrandingConfig(editableDraft);
}
