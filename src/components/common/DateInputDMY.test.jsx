import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateInputDMY } from './DateInputDMY.jsx';

describe('DateInputDMY calendar picker (smoke)', () => {
  it('renders a calendar button alongside the text input and typing dd/mm/yyyy still fires ISO onChange', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" value="2026-06-15" onChange={onChange} />);

    const textInput = screen.getByDisplayValue('15/06/2026');
    expect(textInput).toBeInTheDocument();

    const calendarButton = screen.getByRole('button', { name: /เลือกวันที่จากปฏิทิน/ });
    expect(calendarButton).toBeInTheDocument();

    fireEvent.change(textInput, { target: { value: '20072026' } });
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2026-07-20' } });
  });

  it('firing a native ISO change (native date input / Playwright .fill()) updates the display value', () => {
    const onChange = vi.fn();
    const { rerender } = render(<DateInputDMY data-testid="date-field" value="2026-06-15" onChange={onChange} />);

    const textInput = screen.getByDisplayValue('15/06/2026');
    fireEvent.change(textInput, { target: { value: '2026-08-05' } });
    expect(onChange).toHaveBeenCalledWith({ target: { value: '2026-08-05' } });

    rerender(<DateInputDMY data-testid="date-field" value="2026-08-05" onChange={onChange} />);
    expect(screen.getByDisplayValue('05/08/2026')).toBeInTheDocument();
  });

  it('rejects a typed date beyond max (e.g. a mistyped year) and reverts on blur', () => {
    const onChange = vi.fn();
    render(<DateInputDMY data-testid="date-field" max="2026-12-31" value="2026-06-15" onChange={onChange} />);

    const textInput = screen.getByDisplayValue('15/06/2026');
    fireEvent.change(textInput, { target: { value: '17072027' } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(textInput);
    expect(screen.getByDisplayValue('15/06/2026')).toBeInTheDocument();
  });

  it('clicking the calendar button attempts to open the native date input picker', () => {
    const showPicker = vi.fn();
    window.HTMLInputElement.prototype.showPicker = showPicker;

    render(<DateInputDMY data-testid="date-field" value="2026-06-15" onChange={() => {}} />);
    const calendarButton = screen.getByRole('button', { name: /เลือกวันที่จากปฏิทิน/ });
    fireEvent.click(calendarButton);

    expect(showPicker).toHaveBeenCalled();
  });
});
