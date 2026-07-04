import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  getCustomerDepositRequest: vi.fn().mockResolvedValue({
    data: {
      id: 'req-1',
      request_no: 'CDR-20260704-0001',
      customer_id: 'cust-1',
      status: 'WAREHOUSE_RECEIVING',
      expected_arrival_date: '2026-07-04',
      contact_name: 'Somchai',
      goods_temp: null,
    },
  }),
  listCustomerDepositRequestLines: vi.fn().mockResolvedValue({
    data: [{
      id: 'line-1',
      line_no: 1,
      customer_product_code: 'RPC060',
      product_name: 'สะโพกหมูตัดแต่งพิเศษ',
      lot_no: '181/01',
      temperature_type: 'FROZEN',
      expected_boxes: 60,
      expected_weight: 600,
      actual_boxes: 60,
      actual_weight: 600,
      mfg_date: null,
      exp_date: null,
      location_id: null,
      tracking_code: 'FR260704007',
    }],
  }),
  reviewCustomerDepositRequest: vi.fn(),
  recordDepositLineActualReceipt: vi.fn(),
  updateDepositLineLocation: vi.fn(),
  enqueueCustomerDepositNotification: vi.fn(),
}));

vi.mock('../../src/services/documentBrandingService.js', () => ({
  getDocumentBrandingConfig: vi.fn().mockReturnValue({}),
}));

vi.mock('../../src/services/warehouseLayoutService.js', () => ({
  getActiveLocations: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock('../../src/services/inventoryMovementService.js', () => ({
  checkLocationHasInventory: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: vi.fn().mockResolvedValue({
    data: [{ id: 'cust-1', customer_name: 'บริษัท ไทย - เยอรมัน มีท โปรดักท์ จำกัด', address: '-', fax: '-' }],
  }),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn().mockResolvedValue({
    data: [{ customer_product_code: 'RPC060', allergen: false }],
  }),
}));

const { CustomerDepositDetailModal } = await import('../../src/components/customer/CustomerDepositDetailModal.jsx');

describe('CustomerDepositDetailModal print sticker', () => {
  it('renders a per-line print-sticker button that opens the sticker window without crashing', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({
      document: { write: vi.fn(), close: vi.fn() },
      onload: null,
      print: vi.fn(),
    });

    render(
      <CustomerDepositDetailModal requestId="req-1" isOpen onClose={() => {}} onStatusChange={() => {}} />
    );

    const printButton = await screen.findByRole('button', { name: 'Print Sticker' });
    fireEvent.click(printButton);

    await waitFor(() => expect(openSpy).toHaveBeenCalled());

    openSpy.mockRestore();
  });
});
