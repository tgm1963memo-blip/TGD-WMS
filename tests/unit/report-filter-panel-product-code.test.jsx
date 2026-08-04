import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReportFilterPanel } from '../../src/components/reports/ReportFilterPanel.jsx';

// Regression coverage for a real reported bug: several real deposit/
// withdrawal lines were never resolvable via the "สินค้า" dropdown (which
// only lists products already registered in the internal product master),
// making them permanently unsearchable even though the movement itself was
// real and correct. showProductCode adds a direct text search against each
// row's own customer_product_code, independent of that dropdown/master.
describe('ReportFilterPanel product code search', () => {
  it('does not render the product code field unless showProductCode is set', () => {
    render(<ReportFilterPanel onChange={() => {}} />);
    expect(screen.queryByPlaceholderText('Product Code')).not.toBeInTheDocument();
  });

  it('renders the product code field when showProductCode is set and fires onChange with it on search', () => {
    const onChange = vi.fn();
    render(<ReportFilterPanel onChange={onChange} showProductCode />);

    const input = screen.getByPlaceholderText('Product Code');
    fireEvent.change(input, { target: { value: '10083-87' } });
    fireEvent.click(screen.getByRole('button', { name: /search/i }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ productCode: '10083-87' }));
  });
});
