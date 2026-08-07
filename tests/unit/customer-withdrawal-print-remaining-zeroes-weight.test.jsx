import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerWithdrawalRequestPrintDocument } from '../../src/components/customer/CustomerWithdrawalRequestPrintDocument.jsx';

// Regression coverage for the same class of bug fixed in the Movement
// Ledger: this document previews "what will remain in the lot after this
// withdrawal" by subtracting the line's own claim from
// lot_remaining_boxes/weight (live stock balance, not yet netted since
// the withdrawal isn't COMPLETED). When the claim exactly exhausts the
// boxes but the two independent scale readings (the deposit's, and this
// withdrawal's) don't net to exactly zero, boxes correctly floors to 0
// but weight used to keep whatever drift was left — e.g. printing "0 /
// 0.10 kg." instead of "0 / 0.00 kg.".

const mockHeader = {
  withdrawal_no: 'WDR-20260721-0001',
  customer_name: 'บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด',
  requested_dispatch_date: '2026-07-21',
  status: 'WAREHOUSE_PICKING', // not COMPLETED -> exercises remainingAfterThisWithdrawal's own subtraction
};

describe('CustomerWithdrawalRequestPrintDocument remaining-after-withdrawal', () => {
  it('zeroes the printed remaining weight once this claim exhausts the boxes, despite weight drift', () => {
    const lines = [{
      id: 'wline-1', line_no: 1, tracking_code: 'XX260630135', lot_no: 'LOT-135',
      customer_product_code: 'RPC049', product_name: 'เศษขาสามชั้น (หมู 5)',
      picked_boxes: 4, picked_weight: 38.00,
      lot_remaining_boxes: 4, lot_remaining_weight: 38.10,
    }];

    render(<CustomerWithdrawalRequestPrintDocument header={mockHeader} lines={lines} language="th" />);

    const doc = screen.getByTestId('customer-withdrawal-print-document');
    expect(doc.textContent).not.toContain('0.10 kg.');
    expect(doc.textContent).toContain('0.00 kg.');
  });

  it('still prints a genuine partial remaining weight normally', () => {
    const lines = [{
      id: 'wline-1', line_no: 1, tracking_code: 'XX260630131', lot_no: 'LOT-131',
      customer_product_code: 'RPC039', product_name: 'มันหมูตัดแต่ง',
      picked_boxes: 10, picked_weight: 100,
      lot_remaining_boxes: 32, lot_remaining_weight: 317.79,
    }];

    render(<CustomerWithdrawalRequestPrintDocument header={mockHeader} lines={lines} language="th" />);

    const doc = screen.getByTestId('customer-withdrawal-print-document');
    expect(doc.textContent).toContain('217.79 kg.');
  });
});
