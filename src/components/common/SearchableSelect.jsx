import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * A lightweight searchable <select> replacement: click to open, type to
 * filter, click/Enter to choose. The codebase has no combobox dependency
 * (no react-select/downshift), so this is a small from-scratch component
 * used where option lists are long enough that typing to search matters
 * (e.g. tracking codes, LOT numbers).
 */
export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = '— เลือก —',
  disabled = false,
  className = '',
  testId,
  allowClear = true,
  noOptionsText = 'ไม่พบข้อมูล',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) ?? null,
    [options, value],
  );

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label ?? ''} ${o.searchText ?? ''} ${o.value ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  function selectOption(opt) {
    onChange(opt ? opt.value : '');
    setOpen(false);
    setQuery('');
  }

  function handleKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      setHighlight(0);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }} data-testid={testId ? `${testId}-wrap` : undefined}>
      <input
        className={className}
        data-testid={testId}
        disabled={disabled}
        type="text"
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected ? selected.label : '')}
        onFocus={() => { setOpen(true); setHighlight(0); }}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        style={{ width: '100%', boxSizing: 'border-box', paddingRight: allowClear && selected ? 26 : undefined }}
      />
      {allowClear && selected && !open && !disabled && (
        <button
          type="button"
          onClick={() => selectOption(null)}
          title="ล้างค่า"
          style={{
            position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer',
            fontSize: 15, lineHeight: 1, padding: 4,
          }}
        >×</button>
      )}
      {open && !disabled && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 2,
            background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(15,23,42,0.15)', zIndex: 50,
            maxHeight: 240, overflowY: 'auto', minWidth: '100%', width: 'max-content', maxWidth: 360,
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>{noOptionsText}</div>
          ) : (
            filtered.map((opt, idx) => (
              <div
                key={opt.value}
                onMouseDown={(e) => { e.preventDefault(); selectOption(opt); }}
                onMouseEnter={() => setHighlight(idx)}
                style={{
                  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                  background: idx === highlight ? '#f1f5f9' : '#fff',
                  color: '#0f172a', fontWeight: String(opt.value) === String(value) ? 700 : 400,
                  whiteSpace: 'normal', wordBreak: 'break-word',
                }}
              >
                {opt.label}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
