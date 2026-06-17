import { describe, expect, it } from 'vitest';
import { CustomerProcessTimeline } from '../../src/components/customer/CustomerProcessTimeline.jsx';
import { render, screen } from '@testing-library/react';
import { CUSTOMER_DEPOSIT_STATUSES } from '../../src/data/customerPortalDemoData.js';

describe('CustomerProcessTimeline', () => {
  it('highlights draft only while form is in draft state', () => {
    render(
      <CustomerProcessTimeline
        activeStatus="DRAFT"
        statuses={CUSTOMER_DEPOSIT_STATUSES}
        testId="deposit-timeline"
      />,
    );

    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveClass('is-complete');
    expect(steps[1]).not.toHaveClass('is-complete');
  });

  it('highlights submitted step after customer submission', () => {
    render(
      <CustomerProcessTimeline
        activeStatus="SUBMITTED_BY_CUSTOMER"
        statuses={CUSTOMER_DEPOSIT_STATUSES}
        testId="deposit-timeline"
      />,
    );

    const steps = screen.getAllByRole('listitem');
    expect(steps[0]).toHaveClass('is-complete');
    expect(steps[1]).toHaveClass('is-complete');
    expect(steps[2]).not.toHaveClass('is-complete');
  });
});
