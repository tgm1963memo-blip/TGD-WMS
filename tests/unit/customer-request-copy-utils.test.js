import { describe, expect, it } from 'vitest';
import {
  buildCustomerRequestCopyPath,
  mapDepositHeaderForCopy,
  mapDepositLinesForCopy,
  mapWithdrawalFormForCopy,
  mapWithdrawalHeaderForCopy,
  mapWithdrawalLinesForCopy,
  resolveCatalogProductId,
} from '../../src/utils/customerRequestCopyUtils.js';

describe('customerRequestCopyUtils', () => {
  const catalogProducts = [{
    id: 'prod-1',
    customer_product_code: 'CUS-01',
    internal_product_code: 'INT-01',
    product_name: 'Chicken',
    temperature_type: 'FROZEN',
  }];

  it('builds copy path with encoded source id', () => {
    expect(buildCustomerRequestCopyPath('/customer/deposit-request/new', 'abc-123'))
      .toBe('/customer/deposit-request/new?copyFrom=abc-123');
  });

  it('maps deposit header and lines for copy', () => {
    expect(mapDepositHeaderForCopy({
      expected_arrival_date: '2026-06-10',
      contact_name: 'A',
      contact_phone: '081',
      note: 'note',
    })).toEqual({
      expected_arrival_date: '2026-06-10',
      contact_name: 'A',
      contact_phone: '081',
      note: 'note',
      vehicle_registration: '',
      arrival_time: '',
    });

    const lines = mapDepositLinesForCopy([
      {
        customer_product_code: 'CUS-01',
        internal_product_code: 'INT-01',
        product_name: 'Chicken',
        weight_per_box: 10,
        expected_boxes: 2,
        expected_weight: 100,
        note: 'line note',
        temperature_type: 'FROZEN',
      },
    ], catalogProducts);

    expect(lines[0]).toMatchObject({
      key: 1,
      catalog_product_id: 'prod-1',
      customer_product_code: 'CUS-01',
      product_code: 'INT-01',
      weight_per_box: '10',
      expected_boxes: '2',
      line_note: 'line note',
    });
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });

  it('resolves manual catalog entry when product is not in catalog', () => {
    expect(resolveCatalogProductId({
      customer_product_code: 'UNKNOWN',
      internal_product_code: 'X-1',
    }, catalogProducts)).toBe('__manual__');
  });

  it('maps withdrawal form and all lines for copy', () => {
    const sourceLines = [
      {
        source_customer_deposit_request_id: 'dep-1',
        source_lot_no: 'LOT-1',
        customer_product_code: 'CUS-01',
        internal_product_code: 'INT-01',
        product_name: 'Chicken',
        requested_qty: 5,
        requested_boxes: 1,
        requested_weight: 20,
        picking_rule: 'FEFO',
        note: 'line-1',
      },
      {
        customer_product_code: 'CUS-02',
        internal_product_code: 'INT-02',
        product_name: 'Beef',
        requested_qty: 3,
        picking_rule: 'SPECIFIC_LOT',
      },
    ];

    expect(mapWithdrawalHeaderForCopy({
      requested_dispatch_date: '2026-06-12',
      delivery_type: 'DELIVERY',
      pickup_contact: 'John',
      destination: 'Bangkok',
      note: 'header note',
    })).toMatchObject({
      requested_dispatch_date: '2026-06-12',
      delivery_type: 'DELIVERY',
      pickup_contact: 'John',
    });

    const copiedLines = mapWithdrawalLinesForCopy(sourceLines, catalogProducts);
    expect(copiedLines[0]).toMatchObject({
      key: 1,
      catalog_product_id: 'prod-1',
      customer_product_code: 'CUS-01',
      requested_qty: '5',
    });
    expect(copiedLines.length).toBeGreaterThanOrEqual(5);

    expect(mapWithdrawalFormForCopy({
      requested_dispatch_date: '2026-06-12',
      delivery_type: 'DELIVERY',
      pickup_contact: 'John',
      destination: 'Bangkok',
      note: 'header note',
    }, sourceLines, catalogProducts)).toMatchObject({
      catalog_product_id: 'prod-1',
      requested_dispatch_date: '2026-06-12',
      customer_product_code: 'CUS-01',
      delivery_type: 'DELIVERY',
    });
  });
});
