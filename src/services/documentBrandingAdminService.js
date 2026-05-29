import {
  applyDocumentBrandingDraft,
  createDocumentBrandingDraft,
  getDefaultDocumentBranding,
  summarizeDocumentBrandingConfig,
  validateDocumentBrandingConfig,
} from '../config/documentBrandingConfig.js';

export function createEditableBrandingDraft(currentConfig = getDefaultDocumentBranding()) {
  return createDocumentBrandingDraft(currentConfig);
}

export function validateEditableBrandingDraft(draft = {}) {
  return validateDocumentBrandingConfig(draft);
}

export function previewEditableBrandingDraft(draft = {}) {
  const branding = applyDocumentBrandingDraft(getDefaultDocumentBranding(), draft);

  return {
    branding,
    validation: validateEditableBrandingDraft(branding),
    summary: summarizeEditableBrandingDraft(branding),
  };
}

export function summarizeEditableBrandingDraft(draft = {}) {
  return summarizeDocumentBrandingConfig(draft);
}

export function getBrandingPersistenceReadiness() {
  return {
    ready: false,
    status: 'PREVIEW_ONLY',
    message: 'Branding persistence is not enabled in Sprint 11C.',
    nextAction: 'Design admin-approved persistence with backend security and RLS review.',
  };
}

export function getLogoUploadReadiness() {
  return {
    ready: false,
    status: 'NOT_ENABLED',
    message: 'Logo upload is not enabled in Sprint 11C.',
    nextAction: 'Design storage bucket rules, upload validation, and access control before enabling logo uploads.',
  };
}
