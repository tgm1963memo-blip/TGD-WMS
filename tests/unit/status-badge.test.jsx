import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../src/components/ui/StatusBadge.jsx';

describe('StatusBadge', () => {
  it('renders compact status badge styling for table cells', () => {
    render(<StatusBadge value="OPEN" />);
    const badge = screen.getByTestId('document-status-badge');
    expect(badge).toHaveTextContent('OPEN');
    expect(badge.className).toContain('status-badge');
    expect(badge.className).toContain('status-badge--open');
    expect(badge.className).not.toContain('sprint-status');
  });

  it('maps draft statuses to draft modifier', () => {
    render(<StatusBadge value="DRAFT" />);
    expect(screen.getByTestId('document-status-badge').className).toContain('status-badge--draft');
  });

  it('maps reserved and available statuses', () => {
    render(<StatusBadge value="RESERVED" />);
    expect(screen.getByTestId('document-status-badge').className).toContain('status-badge--open');

    render(<StatusBadge value="Available" />);
    expect(screen.getAllByTestId('document-status-badge')[1].className).toContain('status-badge--confirmed');
  });
});
