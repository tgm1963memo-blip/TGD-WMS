import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { RequestProgress } from '../../src/components/customer/RequestProgress.jsx';

describe('RequestProgress', () => {
  afterEach(cleanup);

  it('marks the current withdrawal stage', () => {
    render(<RequestProgress kind="withdrawal" status="WAREHOUSE_PICKING" />);
    expect(screen.getByText('คลังจัดสินค้า')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('ธุรการตรวจสอบ').className).toContain('--done');
  });

  it('shows every stage done once the deposit is finished', () => {
    render(<RequestProgress kind="deposit" status="RECEIVED_CONFIRMED" />);
    expect(screen.getByText('เสร็จสิ้น').className).toContain('--done');
  });

  it.each(['CANCELLED', 'REJECTED', 'ADMIN_REJECTED', 'DRAFT', undefined])('shows nothing for %s', (status) => {
    render(<RequestProgress kind="withdrawal" status={status} />);
    expect(screen.queryByTestId('request-progress')).not.toBeInTheDocument();
  });
});
