import { useEffect, useRef, useState } from 'react';

// Native <input type="date"> renders its format (mm/dd/yyyy vs dd/mm/yyyy) based on the
// browser/OS locale, which we cannot reliably control from the page. This component always
// displays and accepts dates as dd/mm/yyyy ("วัน/เดือน/ปี") while still emitting the standard
// ISO (yyyy-mm-dd) value through onChange, so it's a drop-in replacement for type="date" inputs.

function isoToDisplay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function displayToIso(display) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return null;
  return `${yyyy}-${mm}-${dd}`;
}

function maskDigits(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  let out = dd;
  if (mm) out += `/${mm}`;
  if (yyyy) out += `/${yyyy}`;
  return out;
}

export function DateInputDMY({
  className,
  'data-testid': testId,
  disabled,
  id,
  min,
  onChange,
  placeholder = 'dd/mm/yyyy',
  required,
  style,
  title,
  value,
}) {
  const [text, setText] = useState(() => isoToDisplay(value));
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setText(isoToDisplay(value));
    }
  }, [value]);

  function fireChange(iso) {
    onChange?.({ target: { value: iso } });
  }

  function handleChange(event) {
    const raw = event.target.value;

    // Programmatic sets (e.g. Playwright's page.fill(), or any code that assigns an ISO
    // value directly) bypass keystroke masking and land here as a full yyyy-mm-dd string.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      setText(isoToDisplay(raw));
      if (!min || raw >= min) fireChange(raw);
      return;
    }

    const masked = maskDigits(raw);
    setText(masked);
    if (masked === '') {
      fireChange('');
      return;
    }
    if (masked.length === 10) {
      const iso = displayToIso(masked);
      if (iso && (!min || iso >= min)) fireChange(iso);
    }
  }

  function handleFocus() {
    isFocusedRef.current = true;
  }

  function handleBlur() {
    isFocusedRef.current = false;
    const iso = text === '' ? null : displayToIso(text);
    if (text !== '' && (!iso || (min && iso < min))) {
      setText(isoToDisplay(value));
    }
  }

  return (
    <input
      className={className}
      data-testid={testId}
      disabled={disabled}
      id={id}
      inputMode="numeric"
      maxLength={10}
      onBlur={handleBlur}
      onChange={handleChange}
      onFocus={handleFocus}
      pattern="\d{2}/\d{2}/\d{4}"
      placeholder={placeholder}
      required={required}
      style={style}
      title={title ?? 'วัน/เดือน/ปี'}
      type="text"
      value={text}
    />
  );
}
