import { describe, expect, it } from 'vitest';
import { getCustomerRequestStatusClass } from '../../src/components/customer/customerRequestStatus.js';

describe('getCustomerRequestStatusClass', () => {
  it.each([
    ['DRAFT', 'draft'],
    ['SUBMITTED_BY_CUSTOMER', 'open'],
    ['ADMIN_REVIEWING', 'open'],
    ['ADMIN_ACCEPTED', 'open'],
    ['WAREHOUSE_PICKING', 'open'],
    ['RECEIVED_CONFIRMED', 'success'],
    ['DISPATCHED', 'success'],
    ['COMPLETED', 'success'],
    ['ADMIN_REJECTED', 'blocked'],
    ['REJECTED', 'blocked'],
    ['CANCELLED', 'blocked'],
    ['RECEIVING_VARIANCE', 'warning'],
    ['SOMETHING_NEW', 'hold'],
  ])('%s → %s', (status, expected) => {
    expect(getCustomerRequestStatusClass(status)).toBe(expected);
  });
});
