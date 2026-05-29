import { useState } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const blankLine = {
  product_id: '',
  lot_id: '',
  lot_no: '',
  location_id: '',
  pallet_id: '',
  qty: '',
  uom: '',
  remark: '',
};

export function DraftLineEditor({ lines = [], onChange }) {
  const [draftLines, setDraftLines] = useState(lines.length ? lines : [blankLine]);
  const t = useTranslation();

  function updateLine(index, field, value) {
    const nextLines = draftLines.map((line, lineIndex) => (
      lineIndex === index ? { ...line, [field]: value } : line
    ));
    setDraftLines(nextLines);
    onChange?.(nextLines);
  }

  function addLine() {
    const nextLines = [...draftLines, blankLine];
    setDraftLines(nextLines);
    onChange?.(nextLines);
  }

  return (
    <section
      className="draft-line-editor"
      style={{ background: '#ffffff', border: '1px solid #d9e2ec', borderRadius: 8, padding: 16 }}
    >
      <h3 style={{ marginTop: 0 }}>{t('draft_lines') || 'Draft Lines'}</h3>
      <div className="draft-line-grid" style={{ display: 'grid', gap: 12 }}>
        {draftLines.map((line, index) => (
          <div
            className="draft-line-row"
            key={`draft-line-${index + 1}`}
            style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
          >
            <input aria-label="Product ID" style={inputStyle} placeholder={t('product') || 'Product ID'} value={line.product_id} onChange={(event) => updateLine(index, 'product_id', event.target.value)} />
            <input aria-label="Lot ID" style={inputStyle} placeholder={t('lot') || 'Lot ID'} value={line.lot_id} onChange={(event) => updateLine(index, 'lot_id', event.target.value)} />
            <input aria-label="Lot No" style={inputStyle} placeholder={t('scan_lot') || 'Lot No'} value={line.lot_no} onChange={(event) => updateLine(index, 'lot_no', event.target.value)} />
            <input aria-label="Location ID" style={inputStyle} placeholder={t('location') || 'Location ID'} value={line.location_id} onChange={(event) => updateLine(index, 'location_id', event.target.value)} />
            <input aria-label="Pallet ID" style={inputStyle} placeholder={t('pallet') || 'Pallet ID'} value={line.pallet_id} onChange={(event) => updateLine(index, 'pallet_id', event.target.value)} />
            <input aria-label="Quantity" style={inputStyle} placeholder={t('quantity') || 'Qty'} type="number" min="0" value={line.qty} onChange={(event) => updateLine(index, 'qty', event.target.value)} />
            <input aria-label="UOM" style={inputStyle} placeholder="UOM" value={line.uom} onChange={(event) => updateLine(index, 'uom', event.target.value)} />
            <input aria-label="Remark" style={inputStyle} placeholder={t('operation_note') || 'Remark'} value={line.remark} onChange={(event) => updateLine(index, 'remark', event.target.value)} />
          </div>
        ))}
      </div>
      <button type="button" onClick={addLine} style={buttonStyle}>{t('add_draft_line') || 'Add draft line'}</button>
    </section>
  );
}

const inputStyle = {
  border: '1px solid #bcccdc',
  borderRadius: 7,
  minHeight: 40,
  padding: '8px 10px',
};

const buttonStyle = {
  background: '#0f766e',
  border: 0,
  borderRadius: 7,
  color: '#ffffff',
  cursor: 'pointer',
  fontWeight: 700,
  marginTop: 12,
  minHeight: 40,
  padding: '8px 12px',
};
