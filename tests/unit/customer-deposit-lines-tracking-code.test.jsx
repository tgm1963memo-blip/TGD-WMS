import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CustomerDepositRequestLinesDisplay } from '../../src/components/customer/CustomerDepositRequestLinesDisplay.jsx';

const line = { id: 'l1', line_no: 1, customer_product_code: 'RPC060', product_name: 'สะโพกหมู', expected_boxes: 60 };

describe('CustomerDepositRequestLinesDisplay tracking code', () => {
  it('shows the code once the document has been submitted', () => {
    render(<CustomerDepositRequestLinesDisplay lines={[{ ...line, tracking_code: 'FR261106011' }]} />);
    expect(screen.getByRole('columnheader', { name: /รหัสติดตาม/ })).toBeInTheDocument();
    expect(screen.getByTestId('deposit-line-tracking-code')).toHaveTextContent('FR261106011');
  });

  it('leaves the column out of a draft, which has no codes yet', () => {
    render(<CustomerDepositRequestLinesDisplay lines={[{ ...line, tracking_code: null }]} />);
    expect(screen.queryByRole('columnheader', { name: /รหัสติดตาม/ })).not.toBeInTheDocument();
  });
});
