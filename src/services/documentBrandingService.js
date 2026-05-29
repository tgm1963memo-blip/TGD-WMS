import {
  getDefaultDocumentBranding,
  normalizeDocumentBrandingConfig,
  validateDocumentBrandingConfig,
  summarizeDocumentBrandingConfig,
} from '../config/documentBrandingConfig.js';

export function getDocumentBrandingConfig() {
  return getDefaultDocumentBranding();
}

export function previewDocumentBrandingConfig(config = getDocumentBrandingConfig()) {
  const normalized = normalizeDocumentBrandingConfig(config);

  return {
    branding: normalized,
    summary: summarizeDocumentBrandingConfig(normalized),
  };
}

export function validateDocumentBrandingForDocument(documentType, config = getDocumentBrandingConfig()) {
  const validation = validateDocumentBrandingConfig(config);

  return {
    documentType,
    ok: validation.ok,
    errors: validation.errors,
    warnings: validation.warnings,
    branding: validation.config,
  };
}
