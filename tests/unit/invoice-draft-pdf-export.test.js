import { describe, expect, it, vi } from 'vitest';

// Regression coverage for the "ดาวน์โหลด PDF" feature: exportInvoiceDraftPdf
// must build a PDF (via jsPDF + jspdf-autotable, with the embedded Thai
// font registered) from the same buildInvoiceLotLedger data the printed
// template uses, and trigger a download without throwing -- doesn't inspect
// PDF byte content (out of scope for a unit test), just that the whole
// pipeline runs end-to-end for a realistic multi-lot draft.

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({
            data: { customer_name: 'บริษัท ทดสอบ จำกัด', address: '123 ถนนทดสอบ', phone: '02-000-0000', contact_name: 'คุณทดสอบ' },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

const baseDraft = {
  id: 'draft-1',
  draft_no: 'BID-20260901-0001',
  customer_id: 'cust-1',
  customer_name: 'บริษัท ทดสอบ จำกัด',
  billing_period_start: '2026-08-01',
  total_amount: 1000,
  currency: 'THB',
  status: 'DRAFT',
};

const lines = [
  {
    lot_no: 'A2-99999999', product_code: 'P-100', product_name: 'สินค้าฝาก',
    movement_type: 'STORAGE', rate: 0.23, amount: 354.20, chargeable_weight: 1540,
    line_note: 'ค่าฝาก 1 งวด (งวดละ 15 วัน: 2026-08-03 ถึง 2026-08-17, น้ำหนักที่คิดค่าฝาก 1540 กก.)',
    billing_period_start: '2026-08-03', billing_period_end: '2026-08-17',
  },
];

describe('exportInvoiceDraftPdf', () => {
  it('builds and saves a PDF end-to-end without throwing, for a realistic multi-lot draft', async () => {
    const { exportInvoiceDraftPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(exportInvoiceDraftPdf({ draft: baseDraft, lines })).resolves.toBeUndefined();
  });

  it('does not throw for a draft number carrying characters the filesystem rejects', async () => {
    const { exportInvoiceDraftPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(
      exportInvoiceDraftPdf({ draft: { ...baseDraft, draft_no: 'BID/2026:0001' }, lines }),
    ).resolves.toBeUndefined();
  });

  it('handles an approved draft (no draft marker) and an empty line list without throwing', async () => {
    const { exportInvoiceDraftPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(
      exportInvoiceDraftPdf({ draft: { ...baseDraft, status: 'APPROVED' }, lines: [] }),
    ).resolves.toBeUndefined();
  });

  it('does nothing when no draft is given', async () => {
    const { exportInvoiceDraftPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(exportInvoiceDraftPdf({ draft: null, lines })).resolves.toBeUndefined();
  });
});

describe('exportInvoiceDraftDetailPdf', () => {
  const flatLines = [
    {
      id: 'line-1', product_code: 'P-100', product_name: 'สินค้าฝาก', line_note: 'หมายเหตุทดสอบ',
      movement_type: 'STORAGE', qty: 0, chargeable_weight: 1540, storage_days: 15, rate: 0.23, amount: 354.2,
    },
  ];

  it('builds and saves the summary PDF end-to-end without throwing', async () => {
    const { exportInvoiceDraftDetailPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(exportInvoiceDraftDetailPdf({ draft: baseDraft, lines: flatLines })).resolves.toBeUndefined();
  });

  it('handles an empty line list without throwing', async () => {
    const { exportInvoiceDraftDetailPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(exportInvoiceDraftDetailPdf({ draft: baseDraft, lines: [] })).resolves.toBeUndefined();
  });

  it('does nothing when no draft is given', async () => {
    const { exportInvoiceDraftDetailPdf } = await import('../../src/utils/invoiceDraftPdfExport.js');
    await expect(exportInvoiceDraftDetailPdf({ draft: null, lines: flatLines })).resolves.toBeUndefined();
  });
});
