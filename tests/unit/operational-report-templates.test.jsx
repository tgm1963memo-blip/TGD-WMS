import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReceivingReportTemplate } from '../../src/components/reports/ReceivingReportTemplate.jsx';
import { InventoryMovementReportTemplate } from '../../src/components/reports/InventoryMovementReportTemplate.jsx';

const receivingData = {
  customerName: 'ACME Cold Chain',
  address: 'Bangkok',
  attention: 'Ms. Somchai',
  receiveDate: '2026-06-01',
  arrivalTime: '08:00',
  startTime: '08:15',
  finishTime: '09:00',
  goodsTemp: '-18C',
  truckTemp: '-20C',
  truckNo: 'TRK-001',
  sealNo: 'SEAL-88',
  receiveFrom: 'Supplier A',
  remark: 'UAT sample',
  documentNo: 'RCV-001',
  lines: [{ id: '1', lotNo: 'LOT-1', customerProduct: 'Pork Loin', code: 'PRD-1', qty: 10 }],
  totalQty: 10,
  totalWeight: 120,
};

const inventoryData = {
  customer: 'ACME Cold Chain',
  address: 'Bangkok',
  reportMonth: '2026-06',
  dateFrom: '2026-06-01',
  dateTo: '2026-06-30',
  issuedDate: '2026-06-08',
  lines: [{
    id: '1',
    date: '2026-06-01',
    receivedDate: '2026-06-01',
    deliveryDate: '2026-06-02',
    lotNo: 'LOT-1',
    customerProduct: 'Pork Loin',
    descCode: 'PRD-1',
    weightKg: 120,
    balanceForward: 0,
    received: 10,
    delivery: 2,
    balance: 8,
    volumeUnit: 'kg',
    remark: '-',
  }],
  subtotalReceived: 10,
  subtotalDelivery: 2,
  subtotalWeight: 120,
  totalReceived: 10,
  totalDelivery: 2,
  totalWeight: 120,
};

describe('20B operational report templates', () => {
  it('renders receiving report with headings, lines, totals, and signatures', () => {
    render(<ReceivingReportTemplate data={receivingData} language="en" />);

    expect(screen.getByTestId('receiving-report-template')).toBeInTheDocument();
    expect(screen.getByText('Receiving Information')).toBeInTheDocument();
    expect(screen.getByText('Pork Loin')).toBeInTheDocument();
    const totals = screen.getByTestId('report-totals-section');
    expect(totals).toBeInTheDocument();
    expect(totals).toHaveTextContent('10');
    expect(screen.getByTestId('report-signature-section')).toBeInTheDocument();
  });

  it('renders inventory movement report with headings, lines, totals, and signatures', () => {
    render(<InventoryMovementReportTemplate data={inventoryData} language="en" />);

    expect(screen.getByTestId('inventory-movement-report-template')).toBeInTheDocument();
    expect(screen.getByText('Entry-Delivery Inventory Report')).toBeInTheDocument();
    expect(screen.getByText('LOT-1')).toBeInTheDocument();
    expect(screen.getAllByText(/ACME Cold Chain/).length).toBeGreaterThan(0);
  });
});
