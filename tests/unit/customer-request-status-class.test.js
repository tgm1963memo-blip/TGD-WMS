import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getCustomerRequestStatusClass } from '../../src/components/customer/customerRequestStatus.js';

const css = fs.readFileSync(path.resolve('src/styles.css'), 'utf8');

const TONES = [
  ['DRAFT', 'draft'],
  ['SUBMITTED_BY_CUSTOMER', 'submitted'],
  ['ADMIN_REVIEWING', 'reviewing'],
  ['ADMIN_ACCEPTED', 'accepted'],
  ['WAREHOUSE_PICKING', 'working'],
  ['WAREHOUSE_RECEIVING', 'working'],
  ['PALLETIZING', 'working'],
  ['DISPATCHED', 'shipped'],
  ['RECEIVED_CONFIRMED', 'shipped'],
  ['COMPLETED', 'done'],
  ['CUSTOMER_NOTIFIED', 'done'],
  ['CLOSED', 'done'],
  ['ADMIN_REJECTED', 'stopped'],
  ['REJECTED', 'stopped'],
  ['CANCELLED', 'stopped'],
  ['RECEIVING_VARIANCE', 'attention'],
  ['COUNT_VARIANCE_REVIEW', 'attention'],
  ['RECOUNT_REQUESTED', 'attention'],
  ['SOMETHING_NEW', 'hold'],
];

describe('getCustomerRequestStatusClass', () => {
  it.each(TONES)('%s → %s', (status, expected) => {
    expect(getCustomerRequestStatusClass(status)).toBe(expected);
  });

  it('keeps the three stages staff confused on different colours', () => {
    const tones = ['SUBMITTED_BY_CUSTOMER', 'WAREHOUSE_PICKING', 'COMPLETED'].map(getCustomerRequestStatusClass);
    expect(new Set(tones).size).toBe(3);
  });

  it.each([...new Set(TONES.map(([, tone]) => tone))])('.status-badge--%s has a style', (tone) => {
    expect(css).toContain(`.status-badge--${tone} {`);
  });

  it.each(['submitted', 'reviewing', 'accepted', 'working', 'shipped', 'done', 'stopped', 'attention'])('%s has light and dark colours', (tone) => {
    expect(css.split(`--status-${tone}-bg:`).length).toBe(3);
    expect(css.split(`--status-${tone}-text:`).length).toBe(3);
  });
});
