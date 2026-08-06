import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';

// Regression: once filtered to one customer, every visible row repeated
// the exact same (often long) customer name in its own column for no
// reason — pure noise. The "ลูกค้า" column only carries real information
// when rows can belong to different customers, i.e. the unfiltered
// "ทุกลูกค้า" view.

vi.mock('../../src/features/auth/UserRoleProvider.jsx', () => ({
  useUserRole: () => ({ role: 'admin', ready: true }),
}));

vi.mock('../../src/services/masterDataService.js', () => ({
  getCustomers: vi.fn().mockResolvedValue({
    data: [{ id: 'cust-1', customer_code: 'C001', customer_name: 'บริษัท ทดสอบ จำกัด' }],
  }),
}));

vi.mock('../../src/services/customerProductCatalogService.js', () => ({
  listCustomerProducts: vi.fn().mockResolvedValue({
    data: [{
      id: 'p-1', customer_id: 'cust-1', customer_product_code: 'RPC001',
      product_name: 'สินค้าทดสอบ', internal_product_code: null, uom: 'กก.',
      temperature_type: 'FROZEN', storage_charge_basis: 'WEIGHT',
      product_category: null, is_active: true,
    }],
  }),
  deactivateCustomerProduct: vi.fn(),
  upsertCustomerProduct: vi.fn(),
}));

const { CustomerProductCatalogAdminPage } = await import('../../src/features/admin/CustomerProductCatalogAdminPage.jsx');

describe('CustomerProductCatalogAdminPage ลูกค้า column', () => {
  it('shows the ลูกค้า column when viewing all customers', async () => {
    render(<CustomerProductCatalogAdminPage />);
    const table = await screen.findByTestId('catalog-admin-table');
    expect(within(table).getByText('ลูกค้า')).toBeInTheDocument();
    await waitFor(() => expect(within(table).getByText('บริษัท ทดสอบ จำกัด')).toBeInTheDocument());
  });

  it('omits the ลูกค้า column once filtered to a single customer', async () => {
    render(<CustomerProductCatalogAdminPage />);
    const table = await screen.findByTestId('catalog-admin-table');
    await waitFor(() => expect(within(table).getByText('บริษัท ทดสอบ จำกัด')).toBeInTheDocument());

    const select = screen.getByTestId('catalog-admin-customer-filter');
    fireEvent.change(select, { target: { value: 'cust-1' } });

    await waitFor(() => expect(within(table).queryByText('ลูกค้า')).not.toBeInTheDocument());
    expect(within(table).queryByText('บริษัท ทดสอบ จำกัด')).not.toBeInTheDocument();
  });
});
