import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerDepositStaffWorkOrderPrint } from '../../src/components/customer/CustomerDepositStaffWorkOrderPrint.jsx';

const mockHeader = {
  request_no: 'CDR-20260721-0001',
  customer_name: 'บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด',
  contact_name: 'Khun Somchai',
  expected_arrival_date: '2026-07-21',
  status: 'WAREHOUSE_RECEIVING',
};

const mockLines = [
  {
    id: 'line-1',
    line_no: 1,
    tracking_code: 'TRK-20260721-001',
    lot_no: 'LOT-998811',
    product_name: 'สะโพกหมูตัดแต่งพิเศษเกรดเอแช่แข็ง ชิ้นใหญ่พิเศษน้ำหนัก 10 กิโลกรัมต่อกล่อง',
    customer_product_code: 'PORK-HIP-EXTRA-LONG-CODE-9999',
    temperature_type: 'FROZEN',
    expected_boxes: 100,
    expected_weight: 1000,
    actual_boxes: 100,
    actual_weight: 1000,
    mfg_date: '2026-07-01',
    exp_date: '2027-07-01',
    argent_type: 'NOR',
    location: { location_code: 'A-01-02' },
  },
];

describe('CustomerDepositStaffWorkOrderPrint component', () => {
  it('renders receiving staff work order document with correct headers and line data', () => {
    render(
      <CustomerDepositStaffWorkOrderPrint
        header={mockHeader}
        lines={mockLines}
        language="th"
      />
    );

    const pages = screen.getAllByTestId('customer-deposit-staff-work-order-print');
    expect(pages.length).toBe(2); // customer copy + staff copy
    expect(screen.getAllByText('CUSTOMER PRODUCT').length).toBe(2);
    expect(screen.getAllByText('CODE').length).toBe(2);
    expect(screen.getAllByText('สะโพกหมูตัดแต่งพิเศษเกรดเอแช่แข็ง ชิ้นใหญ่พิเศษน้ำหนัก 10 กิโลกรัมต่อกล่อง').length).toBe(2);
    expect(screen.getAllByText('PORK-HIP-EXTRA-LONG-CODE-9999').length).toBe(2);
  });

  it('allocates sufficient width (>=18%) for CUSTOMER PRODUCT column and sums to 100%', () => {
    const { container } = render(
      <CustomerDepositStaffWorkOrderPrint
        header={mockHeader}
        lines={mockLines}
        language="th"
      />
    );

    const firstPage = container.querySelector('article');
    const cols = firstPage.querySelector('table.operational-report-table colgroup').querySelectorAll('col');
    expect(cols.length).toBeGreaterThan(0);

    const widths = Array.from(cols).map((col) => {
      const wStr = col.style.width;
      return parseFloat(wStr.replace('%', ''));
    });

    // CUSTOMER PRODUCT column is index 3
    expect(widths[3]).toBeGreaterThanOrEqual(18);

    // Sum of all column percentage widths on a single page should equal 100%
    const totalWidth = widths.reduce((acc, curr) => acc + curr, 0);
    expect(totalWidth).toBeCloseTo(100, 1);
  });

  it('renders the QR code and no merge note for a single (non-merged) request', () => {
    render(
      <CustomerDepositStaffWorkOrderPrint
        header={mockHeader}
        lines={mockLines}
        language="th"
      />
    );

    expect(screen.getAllByText('สแกนเปิดใบงาน').length).toBe(2);
    expect(screen.queryByText(/รวมจากเอกสาร/)).not.toBeInTheDocument();
  });

  it('omits the QR code and shows a combined-source note when the header represents multiple requests', () => {
    const mergedHeader = {
      ...mockHeader,
      request_no: 'CDR-20260721-0001, CDR-20260721-0002',
      source_request_nos: ['CDR-20260721-0001', 'CDR-20260721-0002'],
      _merge: { sourceCount: 2, headerConflicts: [] },
    };

    render(
      <CustomerDepositStaffWorkOrderPrint
        header={mergedHeader}
        lines={mockLines}
        language="th"
      />
    );

    expect(screen.queryByText('สแกนเปิดใบงาน')).not.toBeInTheDocument();
    expect(screen.getAllByText(/รวมจากเอกสาร 2 ใบ/).length).toBe(2);
  });

  it('shows a per-line warning when merged lines disagree on an identity field', () => {
    const conflictedLines = [
      { ...mockLines[0], _mergeConflicts: { lot_no: ['LOT-998811', 'LOT-998812'] } },
    ];

    render(
      <CustomerDepositStaffWorkOrderPrint
        header={mockHeader}
        lines={conflictedLines}
        language="th"
      />
    );

    expect(screen.getAllByText(/เอกสารต้นทางมีข้อมูลไม่ตรงกัน/).length).toBe(2);
    expect(screen.getAllByText(/lot_no/).length).toBeGreaterThan(0);
  });
});
