import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Regression coverage for a new feature: both stock-balance pages can now
// filter by the catalog's product_category (added in a prior migration —
// free text, per-customer, no fixed enum). product_category has no
// per-line snapshot, so each page must build its own code -> category
// lookup from the catalog and join it in on the client.

const getAllCustomerStockBalancesMock = vi.fn();
const getCustomerStockBalanceMock = vi.fn();
const listCustomerProductsMock = vi.fn();

vi.mock('../../src/services/customerDepositRequestService.js', () => ({
  getAllCustomerStockBalances: getAllCustomerStockBalancesMock,
  getCustomerStockBalance: getCustomerStockBalanceMock,
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: vi.fn().mockResolvedValue({
    data: [{ id: 'cust-1', customer_code: 'C1', customer_name: 'Customer One' }],
  }),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: listCustomerProductsMock,
}));

vi.mock('../../src/features/customer/useCustomerPortalProfile.js', () => ({
  useCustomerPortalProfile: () => ({ customerId: 'cust-1', loading: false, isRequestProxy: false }),
  getAdminPortalCustomerId: () => null,
  setAdminPortalCustomerId: vi.fn(),
}));

const { InventoryBalancePage } = await import('../../src/features/inventory/InventoryBalancePage.jsx');
const { CustomerStockBalancePage } = await import('../../src/features/customer/CustomerStockBalancePage.jsx');

function makeBalanceRow(overrides = {}) {
  return {
    id: 'line-1',
    customer_product_code: 'P-FROZEN',
    product_name: 'Frozen widget',
    temperature_type: 'FROZEN',
    actual_boxes: 10,
    actual_weight: 100,
    lot_no: 'L1',
    tracking_code: 'FR1',
    request: { id: 'req-1', request_no: 'CDR-1', customer_id: 'cust-1' },
    ...overrides,
  };
}

describe('InventoryBalancePage product category filter', () => {
  it('filters rows by the selected catalog category and clears via the reset button', async () => {
    getAllCustomerStockBalancesMock.mockResolvedValue({
      data: [
        makeBalanceRow({ id: 'line-frozen', customer_product_code: 'P-FROZEN', product_name: 'Frozen widget' }),
        makeBalanceRow({ id: 'line-chilled', customer_product_code: 'P-CHILLED', product_name: 'Chilled widget' }),
      ],
      error: null,
    });
    listCustomerProductsMock.mockResolvedValue({
      data: [
        { customer_id: 'cust-1', customer_product_code: 'P-FROZEN', product_category: 'เนื้อ' },
        { customer_id: 'cust-1', customer_product_code: 'P-CHILLED', product_category: 'นม' },
      ],
      error: null,
    });

    render(<InventoryBalancePage />);

    await screen.findByText('Frozen widget');
    expect(screen.getByText('Chilled widget')).toBeInTheDocument();

    const select = await screen.findByRole('combobox', { name: 'ประเภทสินค้า' });
    fireEvent.change(select, { target: { value: 'เนื้อ' } });

    await waitFor(() => expect(screen.queryByText('Chilled widget')).not.toBeInTheDocument());
    expect(screen.getByText('Frozen widget')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ล้างตัวกรอง' }));
    await waitFor(() => expect(screen.getByText('Chilled widget')).toBeInTheDocument());
  });
});

describe('CustomerStockBalancePage product category filter', () => {
  it('filters rows by the selected catalog category, scoped to this customer only', async () => {
    getCustomerStockBalanceMock.mockResolvedValue({
      data: [
        makeBalanceRow({ id: 'line-frozen', customer_product_code: 'P-FROZEN', product_name: 'Frozen widget' }),
        makeBalanceRow({ id: 'line-chilled', customer_product_code: 'P-CHILLED', product_name: 'Chilled widget' }),
      ],
      error: null,
    });
    listCustomerProductsMock.mockResolvedValue({
      data: [
        { customer_product_code: 'P-FROZEN', product_category: 'เนื้อ' },
        { customer_product_code: 'P-CHILLED', product_category: 'นม' },
      ],
      error: null,
    });

    render(<CustomerStockBalancePage />);

    await screen.findByText('Frozen widget');
    expect(listCustomerProductsMock).toHaveBeenCalledWith({ customerId: 'cust-1' });

    const select = await screen.findByRole('combobox', { name: 'ประเภทสินค้า' });
    fireEvent.change(select, { target: { value: 'นม' } });

    await waitFor(() => expect(screen.queryByText('Frozen widget')).not.toBeInTheDocument());
    expect(screen.getByText('Chilled widget')).toBeInTheDocument();
  });
});
