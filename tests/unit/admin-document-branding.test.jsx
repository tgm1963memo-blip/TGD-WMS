import React from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import {
  DOCUMENT_BRANDING_EDITABLE_FIELDS,
  applyDocumentBrandingDraft,
  createDocumentBrandingDraft,
  getDefaultDocumentBranding,
  validateDocumentBrandingConfig,
  validateDocumentLogoReference,
} from '../../src/config/documentBrandingConfig.js';

describe('admin document branding config', () => {
  test('editable fields exist', () => {
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('company_name_th');
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('logo_url');
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('document_footer_note_th');
    expect(typeof createDocumentBrandingDraft).toBe('function');
    expect(typeof applyDocumentBrandingDraft).toBe('function');
  });

  test('company_name_th required validation', () => {
    const result = validateDocumentBrandingConfig({
      ...getDefaultDocumentBranding(),
      company_name_th: '',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('company_name_th is required');
  });

  test('unsafe javascript logo reference rejected', () => {
    const result = validateDocumentLogoReference('javascript:alert(1)');

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('unsafe logo reference is not allowed');
  });

  test('service-role-like logo value rejected', () => {
    const result = validateDocumentLogoReference('SUPABASE_SERVICE_ROLE_KEY');

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('service-role-like logo value is not allowed');
  });

  test('base64 logo value rejected', () => {
    const result = validateDocumentLogoReference('data:image/png;base64,abc');

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('base64 logo value is not allowed');
  });
});

describe('admin document branding wiring', () => {
  test('document branding admin route is intentionally not wired in routes.jsx', () => {
    const routesSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/routes.jsx'),
      'utf8',
    );

    expect(routesSource).not.toContain('/admin/document-branding');
    expect(routesSource).not.toContain('DocumentBrandingAdminPage');
  });

  test('no database, storage, network, or browser persistence call exists', () => {
    const files = [
      '../../src/config/documentBrandingConfig.js',
    ];

    files.forEach((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/axios/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toMatch(/writeFile/);
      expect(source).not.toMatch(/localStorage/);
      expect(source).not.toMatch(/sessionStorage/);
      expect(source).not.toMatch(/insert\s*\(/);
      expect(source).not.toMatch(/update\s*\(/);
      expect(source).not.toMatch(/delete\s*\(/);
      expect(source).not.toMatch(/upsert\s*\(/);
    });
  });
});
