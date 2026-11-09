import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RevenueOverview, deriveRevenueView } from '../../src/features/dashboard/RevenueOverview.jsx';

// Past months only, so no bar is treated as "month to date".
const DATA = {
  months: [
    {
      monthKey: '2025-01', amount: 3000, weight: 1500,
      byCustomer: [
        { customerId: 'c1', customerName: 'บริษัท ไทย', amount: 2000, weight: 1000 },
        { customerId: 'c2', customerName: 'OVO Foodtech', amount: 1000, weight: 500 },
      ],
    },
    {
      monthKey: '2025-02', amount: 4000, weight: 1000,
      byCustomer: [
        { customerId: 'c1', customerName: 'บริษัท ไทย', amount: 4000, weight: 1000 },
      ],
    },
  ],
  currentMonth: { monthKey: '2025-02' },
  totalAmount: 7000,
  totalWeight: 2500,
};

describe('deriveRevenueView', () => {
  it('uses month totals for all customers', () => {
    const view = deriveRevenueView(DATA, { metric: 'amount' });
    expect(view.months.map((m) => m.value)).toEqual([3000, 4000]);
    expect(view.customers.map((c) => c.customerId)).toEqual(['c1', 'c2']);
    expect(view.total).toBe(7000);
  });

  it('filters to one customer and fills missing months with 0', () => {
    const view = deriveRevenueView(DATA, { customerId: 'c2', metric: 'weight' });
    expect(view.customerId).toBe('c2');
    expect(view.months.map((m) => m.value)).toEqual([500, 0]);
    expect(view.months.map((m) => m.amount)).toEqual([1000, 0]);
    expect(view.total).toBe(500);
  });

  it('falls back to all customers for an unknown customer id', () => {
    const view = deriveRevenueView(DATA, { customerId: 'gone' });
    expect(view.customerId).toBe('');
    expect(view.total).toBe(7000);
  });

  it('sorts each month\'s customer split by the chosen metric', () => {
    const data = {
      months: [{
        monthKey: '2025-01', amount: 300, weight: 300,
        byCustomer: [
          { customerId: 'a', customerName: 'A', amount: 200, weight: 50 },
          { customerId: 'b', customerName: 'B', amount: 100, weight: 250 },
        ],
      }],
    };
    expect(deriveRevenueView(data, { metric: 'weight' }).months[0].byCustomer.map((c) => c.customerId)).toEqual(['b', 'a']);
  });

  it('marks a customer with no revenue as empty', () => {
    const data = {
      months: [{ monthKey: '2025-01', amount: 0, weight: 0, byCustomer: [{ customerId: 'z', customerName: 'Z', amount: 0, weight: 0 }] }],
    };
    expect(deriveRevenueView(data).isEmpty).toBe(true);
  });
});

describe('RevenueOverview', () => {
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { cleanup(); window.localStorage.clear(); });

  it('shows the latest month in THB with billed weight and baht per kg', () => {
    render(<RevenueOverview data={DATA} language="th" />);
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('฿4,000.00');
    expect(screen.getByTestId('revenue-selected-secondary').textContent).toBe('1,000 กก. · ฿4.00/กก.');
  });

  it('switches to kg and back', () => {
    render(<RevenueOverview data={DATA} language="th" />);
    const group = screen.getByRole('group', { name: 'หน่วยที่แสดง' });
    const kg = within(group).getByRole('button', { name: 'กก.' });
    fireEvent.click(kg);
    expect(kg.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('1,000 กก.');
    expect(screen.getByTestId('revenue-selected-secondary').textContent).toBe('฿4,000.00');
    expect(window.localStorage.getItem('tgd.dashboard.revenue.metric')).toBe('weight');

    fireEvent.click(within(group).getByRole('button', { name: 'บาท' }));
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('฿4,000.00');
  });

  it('filters to one customer and shows a month table', () => {
    render(<RevenueOverview data={DATA} language="th" />);
    fireEvent.change(screen.getByLabelText('ลูกค้า'), { target: { value: 'c2' } });
    // OVO had nothing in Feb.
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('฿0.00');
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    fireEvent.click(within(table).getByRole('button', { name: /ม\.ค\./ }));
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('฿1,000.00');
    expect(screen.getByTestId('revenue-selected-secondary').textContent).toBe('500 กก. · ฿2.00/กก.');
  });

  it('remembers the unit but not the customer filter', () => {
    window.localStorage.setItem('tgd.dashboard.revenue.metric', 'weight');
    render(<RevenueOverview data={DATA} language="th" />);
    fireEvent.change(screen.getByLabelText('ลูกค้า'), { target: { value: 'c2' } });
    cleanup();
    render(<RevenueOverview data={DATA} language="th" />);
    expect(screen.getByLabelText('ลูกค้า').value).toBe('');
    expect(screen.getByTestId('revenue-selected-amount').textContent).toBe('1,000 กก.');
    expect(window.localStorage.getItem('tgd.dashboard.revenue.customer')).toBeNull();
  });

  it('labels lines with no customer', () => {
    const data = {
      months: [{ monthKey: '2025-01', amount: 10, weight: 5, byCustomer: [{ customerId: 'UNASSIGNED', customerName: 'UNASSIGNED', amount: 10, weight: 5 }] }],
      currentMonth: { monthKey: '2025-01' },
    };
    render(<RevenueOverview data={data} language="th" />);
    expect(screen.getByRole('option', { name: 'ไม่ระบุลูกค้า' })).toBeTruthy();
  });

  it('shows an empty message when the filtered customer has no revenue', () => {
    const data = {
      months: [{ monthKey: '2025-01', amount: 0, weight: 0, byCustomer: [] }],
      currentMonth: { monthKey: '2025-01' },
    };
    render(<RevenueOverview data={data} language="th" />);
    expect(screen.getByText('ไม่มีรายได้ในช่วงนี้')).toBeTruthy();
    expect(screen.queryByTestId('revenue-selected-amount')).toBeNull();
  });
});
