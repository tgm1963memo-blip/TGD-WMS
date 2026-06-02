import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TGD WMS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'แดชบอร์ดคลังสินค้า' })).toBeInTheDocument();
  });

  it.each([
    ['/', 'แดชบอร์ดคลังสินค้า', false],
    ['/customers', 'Customers'],
    ['/products', 'Products'],
    ['/locations', 'Locations'],
    ['/receiving', 'Receiving'],
    ['/inventory', 'Inventory'],
    ['/movement-ledger', 'Movement Ledger'],
    ['/picking', 'Picking'],
    ['/transfer', 'Transfer'],
    ['/adjustment', 'Adjustment'],
    ['/audit', 'Audit'],
  ])('renders %s route', (path, title, expectsPlaceholder = true) => {
    window.history.pushState({}, '', path);

    render(<App />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    if (expectsPlaceholder) {
      expect(screen.getByText('Sprint status: placeholder only')).toBeInTheDocument();
    } else {
      expect(screen.queryByText('Sprint status: placeholder only')).not.toBeInTheDocument();
    }
  });
});
