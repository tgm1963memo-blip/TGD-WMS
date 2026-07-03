import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateInputDMY } from '../../src/components/common/DateInputDMY.jsx';

describe('DateInputDMY', () => {
  it('displays an ISO value as dd/mm/yyyy', () => {
    render(<DateInputDMY data-testid="date-field" onChange={() => {}} value="2026-07-03" />);
    expect(screen.getByTestId('date-field')).toHaveValue('03/07/2026');
  });

  it('emits an ISO value once the user finishes typing dd/mm/yyyy', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" onChange={onChange} value="" />);
    const input = screen.getByTestId('date-field');
    fireEvent.change(input, { target: { value: '03072026' } });
    expect(input).toHaveValue('03/07/2026');
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2026-07-03' } });
  });

  it('accepts a programmatic ISO fill (e.g. Playwright .fill()) and reformats it', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" onChange={onChange} value="" />);
    const input = screen.getByTestId('date-field');
    fireEvent.change(input, { target: { value: '2026-12-31' } });
    expect(input).toHaveValue('31/12/2026');
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2026-12-31' } });
  });

  it('rejects a date before min and reverts on blur', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" min="2026-07-01" onChange={onChange} value="" />);
    const input = screen.getByTestId('date-field');
    fireEvent.change(input, { target: { value: '01062026' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input).toHaveValue('');
  });

  it('reverts an invalid calendar date (e.g. 31/02) on blur', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" onChange={onChange} value="2026-01-15" />);
    const input = screen.getByTestId('date-field');
    fireEvent.change(input, { target: { value: '31022026' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(input).toHaveValue('15/01/2026');
  });
});
