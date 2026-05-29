import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App.jsx';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TGD WMS' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it.each([
    ['/', 'Dashboard'],
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
  ])('renders %s route', (path, title) => {
    window.history.pushState({}, '', path);

    render(<App />);

    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.getByText('Sprint status: placeholder only')).toBeInTheDocument();
  });
});
