import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerWithdrawalRequestPrintDocument } from '../../src/components/customer/CustomerWithdrawalRequestPrintDocument.jsx';

const mockHeader = {
  withdrawal_no: 'WDR-20260721-0001',
  customer_name: 'บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด',
  requested_dispatch_date: '2026-07-21',
  status: 'WAREHOUSE_PICKING',
};

const mockLines = [
  {
    id: 'wline-1',
    line_no: 1,
    tracking_code: 'TRK-20260721-001',
    lot_no: 'LOT-998811',
    product_name: 'สะโพกหมูตัดแต่งพิเศษเกรดเอแช่แข็ง',
    customer_product_code: 'PORK-HIP-9999',
    requested_boxes: 20,
    requested_weight: 200,
    picked_boxes: 20,
    picked_weight: 200,
  },
];

describe('CustomerWithdrawalRequestPrintDocument component', () => {
  it('renders a single-copy document with header and line data', () => {
    render(
      <CustomerWithdrawalRequestPrintDocument
        header={mockHeader}
        lines={mockLines}
        language="th"
      />
    );

    const doc = screen.getByTestId('customer-withdrawal-print-document');
    expect(doc).toBeInTheDocument();
    expect(screen.getByText('CUSTOMER PRODUCT')).toBeInTheDocument();
    // fmtWrap inserts invisible soft-break characters into long text, so
    // match on the raw text content (breaks stripped) rather than an exact node.
    expect(doc.textContent.replace(new RegExp('​', 'g'), '')).toContain('สะโพกหมูตัดแต่งพิเศษเกรดเอแช่แข็ง');
  });

  it('renders the QR code and no merge note for a single (non-merged) request', () => {
    render(
      <CustomerWithdrawalRequestPrintDocument
        header={mockHeader}
        lines={mockLines}
        language="th"
      />
    );

    expect(screen.getByText('สแกนเปิดใบงาน')).toBeInTheDocument();
    expect(screen.queryByText(/รวมจากเอกสาร/)).not.toBeInTheDocument();
  });

  it('omits the QR code and shows a combined-source note when the header represents multiple requests', () => {
    const mergedHeader = {
      ...mockHeader,
      withdrawal_no: 'WDR-20260721-0001, WDR-20260721-0002',
      source_request_nos: ['WDR-20260721-0001', 'WDR-20260721-0002'],
      _merge: { sourceCount: 2, headerConflicts: [] },
    };

    render(
      <CustomerWithdrawalRequestPrintDocument
        header={mergedHeader}
        lines={mockLines}
        language="th"
      />
    );

    expect(screen.queryByText('สแกนเปิดใบงาน')).not.toBeInTheDocument();
    expect(screen.getByText(/รวมจากเอกสาร 2 ใบ/)).toBeInTheDocument();
  });

  it('shows a per-line warning when merged lines disagree on an identity field', () => {
    const conflictedLines = [
      { ...mockLines[0], _mergeConflicts: { lot_no: ['LOT-998811', 'LOT-998812'] } },
    ];

    render(
      <CustomerWithdrawalRequestPrintDocument
        header={mockHeader}
        lines={conflictedLines}
        language="th"
      />
    );

    expect(screen.getByText(/เอกสารต้นทางมีข้อมูลไม่ตรงกัน/)).toBeInTheDocument();
    expect(screen.getByText(/lot_no/)).toBeInTheDocument();
  });
});
