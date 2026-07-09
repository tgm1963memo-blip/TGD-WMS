import { useState, useRef, useEffect } from 'react';

export function MultiSelectDropdown({
  options = [],
  value = [],
  onChange,
  placeholder = '— ทั้งหมด —',
  name
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchQuery('');
    }
  };

  const handleCheckboxChange = (optionValue, checked) => {
    let newValue = [...(value || [])];
    if (checked) {
      if (!newValue.includes(optionValue)) {
        newValue.push(optionValue);
      }
    } else {
      newValue = newValue.filter((v) => v !== optionValue);
    }
    onChange(newValue);
  };

  const getDisplayText = () => {
    if (!value || value.length === 0) return placeholder;
    if (value.length === 1) {
      const opt = options.find((o) => String(o.value) === String(value[0]));
      return opt ? opt.label : value[0];
    }
    return `เลือก ${value.length} รายการ`;
  };

  const filteredOptions = options.filter(opt =>
    (opt.label || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="multi-select-dropdown" ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-control"
        onClick={handleToggle}
        style={{
          textAlign: 'left',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#fff',
          cursor: 'pointer'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {getDisplayText()}
        </span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 8 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: '4px',
          backgroundColor: '#fff',
          border: '1px solid var(--tgd-border)',
          borderRadius: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          maxHeight: '280px',
          overflowY: 'auto',
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {options.length > 5 && (
            <div style={{ padding: '8px', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 2 }}>
              <input
                type="text"
                className="form-control"
                placeholder="ค้นหา..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={{ width: '100%', padding: '4px 8px', fontSize: '13px', minHeight: '30px' }}
              />
            </div>
          )}
          {filteredOptions.length === 0 ? (
            <div style={{ padding: '8px 12px', color: '#666', fontSize: '13px' }}>ไม่มีข้อมูล</div>
          ) : (
            filteredOptions.map((opt) => {
              const isChecked = (value || []).includes(String(opt.value));
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: '13px',
                    margin: 0
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleCheckboxChange(String(opt.value), e.target.checked)}
                    style={{ marginRight: '8px', marginTop: '2px', width: 'auto', height: 'auto' }}
                  />
                  <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.3 }}>{opt.label}</span>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
