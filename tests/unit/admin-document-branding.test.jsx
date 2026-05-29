import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
import {
  createEditableBrandingDraft,
  previewEditableBrandingDraft,
  validateEditableBrandingDraft,
} from '../../src/services/documentBrandingAdminService.js';
import { DocumentBrandingForm } from '../../src/components/documents/DocumentBrandingForm.jsx';
import { DocumentBrandingAdminPage } from '../../src/features/admin/DocumentBrandingAdminPage.jsx';

describe('admin document branding config', () => {
  test('editable fields exist', () => {
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('company_name_th');
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('logo_url');
    expect(DOCUMENT_BRANDING_EDITABLE_FIELDS).toContain('document_footer_note_th');
    expect(typeof createDocumentBrandingDraft).toBe('function');
    expect(typeof applyDocumentBrandingDraft).toBe('function');
    expect(typeof createEditableBrandingDraft).toBe('function');
    expect(typeof previewEditableBrandingDraft).toBe('function');
    expect(typeof validateEditableBrandingDraft).toBe('function');
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

describe('admin document branding UI', () => {
  test('form renders Thai-first labels', () => {
    render(<DocumentBrandingForm />);

    expect(screen.getByText('แก้ไขการตั้งค่าเอกสาร')).toBeInTheDocument();
    expect(screen.getByText('ชื่อบริษัทภาษาไทย')).toBeInTheDocument();
    expect(screen.getByText('ข้อมูลบริษัท (Company Information)')).toBeInTheDocument();
  });

  test('no save button exists and no upload button exists', () => {
    render(<DocumentBrandingForm />);

    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
  });

  test('preview update uses local state only', () => {
    const handlePreviewChange = vi.fn();
    render(<DocumentBrandingForm onPreviewChange={handlePreviewChange} />);

    fireEvent.change(screen.getByLabelText('ชื่อบริษัทภาษาอังกฤษ'), {
      target: { value: 'Preview Company' },
    });
    fireEvent.click(screen.getByRole('button', { name: /update preview/i }));

    expect(handlePreviewChange).toHaveBeenCalledWith(
      expect.objectContaining({ company_name_en: 'Preview Company' }),
    );
  });

  test('admin page renders header/footer preview', () => {
    render(<DocumentBrandingAdminPage />);

    expect(screen.getAllByText(/ตั้งค่าเอกสาร/).length).toBeGreaterThan(0);
    expect(screen.getByText('Thai Preview')).toBeInTheDocument();
    expect(screen.getByText('English Preview')).toBeInTheDocument();
    expect(screen.getAllByText(/Prepared by|จัดทำโดย/).length).toBeGreaterThan(0);
  });

  test('/admin/document-branding route exists if route added', () => {
    const routesSource = fs.readFileSync(
      path.resolve(__dirname, '../../src/app/routes.jsx'),
      'utf8',
    );

    expect(routesSource).toContain('/admin/document-branding');
    expect(routesSource).toContain('DocumentBrandingAdminPage');
  });

  test('no database, storage, network, or browser persistence call exists', () => {
    const files = [
      '../../src/config/documentBrandingConfig.js',
      '../../src/services/documentBrandingAdminService.js',
      '../../src/components/documents/DocumentBrandingForm.jsx',
      '../../src/features/admin/DocumentBrandingAdminPage.jsx',
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
