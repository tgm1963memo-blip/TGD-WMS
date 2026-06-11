import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BPLUS_EXPORT_READINESS_STATUS,
  buildInvoiceDraftBplusHeaderPreview,
  buildInvoiceDraftBplusLinePreview,
  evaluateInvoiceDraftBplusExportReadiness,
  normalizeCustomerForBplusReadiness,
} from '../../src/utils/billingInvoiceDraftBplusExportUtils.js';
import { INVOICE_DRAFT_STATUS } from '../../src/utils/billingInvoiceDraftUtils.js';

const approvedDraft = {
  id: 'draft-1',
  draft_no: 'BID-20260611-0002',
  customer_id: 'cust-1',
  customer_name: 'Demo Customer Alpha',
  status: INVOICE_DRAFT_STATUS.APPROVED,
  billing_period_start: '2026-06-01',
  billing_period_end: '2026-06-30',
  total_chargeable_weight: 250,
  total_amount: 5000,
  currency: 'THB',
  updated_at: '2026-06-11T10:00:00.000Z',
};

const completeLine = {
  product_code: 'FSHR-001',
  product_name: 'Frozen Shrimp',
  lot_no: 'LOT-1',
  pallet_no: 'PAL-1',
  movement_type: 'RECEIVE_CONFIRM',
  movement_date: '2026-06-11T08:00:00.000Z',
  source_document_no: 'RCV-001',
  qty: 50,
  uom: 'kg',
  net_weight: 250,
  gross_weight: 250,
  chargeable_weight: 250,
  rate: 20,
  amount: 5000,
};

describe('Gate 3B-4 billing invoice draft Bplus export readiness utils', () => {
  it('returns READY for APPROVED draft with complete data', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [completeLine],
      customer: { customer_code: 'ALPHA-001', customer_name: 'Demo Customer Alpha' },
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.READY);
    expect(result.ready).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.header_preview.draft_no).toBe('BID-20260611-0002');
    expect(result.header_preview.customer_code).toBe('ALPHA-001');
    expect(result.line_previews[0].product_code).toBe('FSHR-001');
    expect(result.line_previews[0].bplus_service_code).toBe('INBOUND_HANDLING');
  });

  it('returns BLOCKED for non-APPROVED draft', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: { ...approvedDraft, status: INVOICE_DRAFT_STATUS.DRAFT },
      lines: [completeLine],
      customer: { customer_code: 'ALPHA-001' },
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.BLOCKED);
    expect(result.blockers.some((item) => /APPROVED/i.test(item))).toBe(true);
  });

  it('returns BLOCKED when customer_code is missing', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [completeLine],
      customer: null,
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.BLOCKED);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('Missing Bplus customer code.');
    expect(result.warnings.some((item) => /Customer code mapping is not configured/i.test(item))).toBe(true);
    expect(result.line_previews).toHaveLength(1);
    expect(result.header_preview.customer_code).toBeNull();
  });

  it('normalizes UAT customer master row without customer_code column', () => {
    const normalized = normalizeCustomerForBplusReadiness({
      id: 'cust-1',
      name: 'Demo Customer Alpha',
      contact_email: 'alpha.demo@tgd-wms.local',
    });

    expect(normalized.customer_code).toBeNull();
    expect(normalized.customer_name).toBe('Demo Customer Alpha');

    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [completeLine],
      customer: normalized,
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.BLOCKED);
    expect(result.blockers).toContain('Missing Bplus customer code.');
    expect(result.warnings.some((item) => /Customer code mapping is not configured/i.test(item))).toBe(true);
  });

  it('falls back to code field when customer_code is absent', () => {
    const normalized = normalizeCustomerForBplusReadiness({
      id: 'cust-1',
      name: 'Alpha',
      code: 'ALPHA-001',
    });

    expect(normalized.customer_code).toBe('ALPHA-001');

    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [completeLine],
      customer: normalized,
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.READY);
    expect(result.header_preview.customer_code).toBe('ALPHA-001');
  });

  it('returns BLOCKED when chargeable_weight is missing', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [{ ...completeLine, chargeable_weight: 0 }],
      customer: { customer_code: 'ALPHA-001' },
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.BLOCKED);
    expect(result.blockers.some((item) => /chargeable_weight/i.test(item))).toBe(true);
  });

  it('returns NEEDS_REVIEW when rate or amount is missing', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: { ...approvedDraft, total_amount: null },
      lines: [{ ...completeLine, rate: null, amount: null }],
      customer: { customer_code: 'ALPHA-001' },
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.NEEDS_REVIEW);
    expect(result.warnings.some((item) => /rate or amount/i.test(item))).toBe(true);
    expect(result.line_previews[0].amount).toBeNull();
  });

  it('returns NEEDS_REVIEW when Bplus service mapping is not confirmed', () => {
    const result = evaluateInvoiceDraftBplusExportReadiness({
      draft: approvedDraft,
      lines: [{ ...completeLine, movement_type: 'CUSTOM_MOVEMENT' }],
      customer: { customer_code: 'ALPHA-001' },
    });

    expect(result.readiness_status).toBe(BPLUS_EXPORT_READINESS_STATUS.NEEDS_REVIEW);
    expect(result.warnings.some((item) => /service mapping/i.test(item))).toBe(true);
    expect(result.line_previews[0].bplus_service_code).toBeNull();
  });

  it('builds header and line preview fields', () => {
    const header = buildInvoiceDraftBplusHeaderPreview(approvedDraft, { customer_code: 'ALPHA-001' });
    const line = buildInvoiceDraftBplusLinePreview(completeLine);

    expect(header.billing_period).toBe('2026-06');
    expect(header.total_chargeable_weight).toBe(250);
    expect(line.source_document_no).toBe('RCV-001');
    expect(line.chargeable_weight).toBe(250);
  });

  it('does not expose executable export or billed controls in service source', () => {
    const serviceSource = readFileSync(path.join(process.cwd(), 'src/services/billingInvoiceDraftService.js'), 'utf8');
    const detailSource = readFileSync(path.join(process.cwd(), 'src/features/billing/InvoiceDraftDetailPage.jsx'), 'utf8');

    expect(serviceSource).toContain('getBillingInvoiceDraftBplusExportReadiness');
    expect(serviceSource).not.toContain('EXPORTED_TO_BPLUS');
    expect(serviceSource).not.toContain('markBilled');
    expect(detailSource).not.toContain('export-bplus-button');
    expect(detailSource).not.toContain('mark-billed-button');
    expect(detailSource).not.toContain('bplus-invoice-no-input');
  });
});
