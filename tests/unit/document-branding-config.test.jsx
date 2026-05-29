import React from 'react';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_DOCUMENT_BRANDING,
  DOCUMENT_BRANDING_FIELDS,
  getDefaultDocumentBranding,
  normalizeDocumentBrandingConfig,
  validateDocumentBrandingConfig,
  summarizeDocumentBrandingConfig,
} from '../../src/config/documentBrandingConfig.js';
import {
  getDocumentBrandingConfig,
  previewDocumentBrandingConfig,
  validateDocumentBrandingForDocument,
} from '../../src/services/documentBrandingService.js';
import { DocumentHeader } from '../../src/components/documents/DocumentHeader.jsx';
import { DocumentFooter } from '../../src/components/documents/DocumentFooter.jsx';
import { DocumentBrandingPreviewPage } from '../../src/features/admin/DocumentBrandingPreviewPage.jsx';

describe('document branding config', () => {
  test('config exports exist', () => {
    expect(DEFAULT_DOCUMENT_BRANDING).toBeDefined();
    expect(Array.isArray(DOCUMENT_BRANDING_FIELDS)).toBe(true);
    expect(typeof getDefaultDocumentBranding).toBe('function');
    expect(typeof normalizeDocumentBrandingConfig).toBe('function');
    expect(typeof validateDocumentBrandingConfig).toBe('function');
    expect(typeof summarizeDocumentBrandingConfig).toBe('function');
    expect(typeof getDocumentBrandingConfig).toBe('function');
    expect(typeof previewDocumentBrandingConfig).toBe('function');
    expect(typeof validateDocumentBrandingForDocument).toBe('function');
  });

  test('default branding has required fields', () => {
    const branding = getDefaultDocumentBranding();

    DOCUMENT_BRANDING_FIELDS.forEach((field) => {
      expect(branding).toHaveProperty(field);
    });
  });

  test('validation catches missing company name', () => {
    const result = validateDocumentBrandingConfig({
      ...getDefaultDocumentBranding(),
      company_name_th: '',
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('company_name_th is required');
  });
});

describe('document branding components', () => {
  test('header renders Thai company name', () => {
    render(<DocumentHeader language="th" documentTitle="เอกสารทดสอบ" />);

    expect(screen.getByText('บริษัท ทีจีดี โคลด์สโตเรจ จำกัด')).toBeInTheDocument();
  });

  test('header renders English company name', () => {
    render(<DocumentHeader language="en" documentTitle="Test Document" />);

    expect(screen.getByText('TGD Coldstorage Co., Ltd.')).toBeInTheDocument();
  });

  test('header handles missing logo safely', () => {
    render(<DocumentHeader language="en" documentTitle="Test Document" branding={{ ...getDefaultDocumentBranding(), logo_url: '' }} />);

    expect(screen.getByText('No logo configured')).toBeInTheDocument();
  });

  test('footer renders prepared and approved labels', () => {
    render(<DocumentFooter language="en" preparedBy="Prepared User" approvedBy="Approved User" />);

    expect(screen.getByText(/Prepared by: Prepared User/)).toBeInTheDocument();
    expect(screen.getByText(/Approved by: Approved User/)).toBeInTheDocument();
  });

  test('preview page renders without write actions', () => {
    render(<DocumentBrandingPreviewPage />);

    expect(screen.getByText('Document Branding Preview')).toBeInTheDocument();
    expect(screen.getByText('Thai Preview')).toBeInTheDocument();
    expect(screen.getByText('English Preview')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /upload/i })).toBeNull();
  });
});

describe('document branding safety', () => {
  test('source contains no database calls, network calls, or file writes', () => {
    const files = [
      '../../src/config/documentBrandingConfig.js',
      '../../src/services/documentBrandingService.js',
      '../../src/components/documents/DocumentHeader.jsx',
      '../../src/components/documents/DocumentFooter.jsx',
      '../../src/features/admin/DocumentBrandingPreviewPage.jsx',
    ];

    files.forEach((file) => {
      const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
      expect(source).not.toMatch(/supabase/i);
      expect(source).not.toMatch(/fetch\s*\(/);
      expect(source).not.toMatch(/axios/);
      expect(source).not.toMatch(/XMLHttpRequest/);
      expect(source).not.toMatch(/writeFile/);
      expect(source).not.toMatch(/upload/i);
      expect(source).not.toMatch(/insert\s*\(/);
      expect(source).not.toMatch(/update\s*\(/);
      expect(source).not.toMatch(/delete\s*\(/);
      expect(source).not.toMatch(/upsert\s*\(/);
    });
  });
});
