import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InvoiceDraftPrintTemplate } from '../../src/components/billing/InvoiceDraftPrintTemplate.jsx';

const baseDraft = {
  id: 'draft-1',
  draft_no: 'BID-20260901-0001',
  customer_id: 'cust-1',
  customer_name: 'บริษัท ทดสอบ จำกัด',
  billing_period_start: '2026-08-01',
  total_amount: 1000,
  currency: 'THB',
};

const lines = [
  {
    lot_no: 'LOT-001',
    product_code: 'P-001',
    product_name: 'สินค้าทดสอบ',
    movement_type: 'STORAGE_OPENING_BALANCE',
    movement_date: '2026-08-01',
    qty: 10,
    chargeable_weight: 100,
  },
];

describe('InvoiceDraftPrintTemplate', () => {
  it('shows the (ร่าง)/(DRAFT) marker and draft-only note while still a DRAFT', () => {
    const { container } = render(<InvoiceDraftPrintTemplate draft={{ ...baseDraft, status: 'DRAFT' }} lines={lines} />);
    expect(container.textContent).toContain('(ร่าง)');
    expect(container.textContent).toContain('(DRAFT)');
    expect(container.textContent).toContain('เอกสารนี้เป็นร่างเท่านั้น');
  });

  it('hides the (ร่าง)/(DRAFT) marker and draft-only note once APPROVED', () => {
    const { container } = render(<InvoiceDraftPrintTemplate draft={{ ...baseDraft, status: 'APPROVED' }} lines={lines} />);
    expect(container.textContent).not.toContain('(ร่าง)');
    expect(container.textContent).not.toContain('(DRAFT)');
    expect(container.textContent).not.toContain('เอกสารนี้เป็นร่างเท่านั้น');
  });

  it('hides the draft marker for statuses past approval too (exported/billed)', () => {
    const exported = render(<InvoiceDraftPrintTemplate draft={{ ...baseDraft, status: 'EXPORTED_TO_BPLUS' }} lines={lines} />);
    expect(exported.container.textContent).not.toContain('(ร่าง)');

    const billed = render(<InvoiceDraftPrintTemplate draft={{ ...baseDraft, status: 'BILLED' }} lines={lines} />);
    expect(billed.container.textContent).not.toContain('(ร่าง)');
  });

  it('repeats a slim identifying header row inside the table thead for continuation pages', () => {
    const { container } = render(<InvoiceDraftPrintTemplate draft={{ ...baseDraft, status: 'DRAFT' }} lines={lines} />);
    const runningHeader = container.querySelector('.operational-report-running-header');
    expect(runningHeader).not.toBeNull();
    expect(runningHeader.textContent).toContain('BID-20260901-0001');
    expect(runningHeader.textContent).toContain('บริษัท ทดสอบ จำกัด');
  });
});
