export const MAX_PRODUCT_UNITS = 4;

export function emptyUnitRow() {
  return { id: null, unitCode: '', unitLabel: '', weightPerUnitKg: '', boxesPerUnit: '' };
}

// "แพ็ค/ลัง" packaging-unit editor -- a small repeatable-rows table nested
// inside the product catalog form (admin and customer self-service share
// this exact component). Kept fully local to `units`/`onUnitsChange` (plain
// array of row objects) so the parent form doesn't need to know anything
// about the underlying tgd_customer_product_units RPCs; the parent
// reconciles adds/edits/removals against the server on submit.
export function ProductUnitsEditor({ units, onUnitsChange, disabled }) {
  function updateRow(index, field, value) {
    onUnitsChange(units.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  function removeRow(index) {
    onUnitsChange(units.filter((_, i) => i !== index));
  }
  function addRow() {
    if (units.length >= MAX_PRODUCT_UNITS) return;
    onUnitsChange([...units, emptyUnitRow()]);
  }

  return (
    <div className="form-field" style={{ margin: '0 0 14px' }}>
      <span>หน่วยนับย่อย/หน่วยบรรจุ (เช่น แพ็ค, ลัง)</span>
      <p style={{ margin: '2px 0 8px', fontSize: 12, color: 'var(--tgd-muted-text)' }}>
        กำหนดหน่วยนับเพิ่มเติมจากกล่อง เพื่อให้กรอกจำนวนตอนฝาก/เบิกเป็นหน่วยนี้ได้โดยตรง — ระบบจะแปลงเป็นกล่อง/น้ำหนักให้อัตโนมัติ (สูงสุด {MAX_PRODUCT_UNITS} หน่วย)
      </p>
      {units.map((row, index) => (
        <div
          key={index}
          style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 8, marginBottom: 8, alignItems: 'center' }}
        >
          <input
            className="form-control"
            placeholder="ชื่อหน่วย เช่น ลัง"
            value={row.unitLabel}
            disabled={disabled}
            onChange={(e) => updateRow(index, 'unitLabel', e.target.value)}
          />
          <input
            className="form-control"
            type="number"
            min="0"
            step="0.001"
            placeholder="กล่อง/หน่วย (ไม่บังคับ)"
            value={row.boxesPerUnit}
            disabled={disabled}
            onChange={(e) => updateRow(index, 'boxesPerUnit', e.target.value)}
          />
          <input
            className="form-control"
            type="number"
            min="0"
            step="0.001"
            placeholder="กก./หน่วย"
            value={row.weightPerUnitKg}
            disabled={disabled}
            onChange={(e) => updateRow(index, 'weightPerUnitKg', e.target.value)}
          />
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={disabled}
            onClick={() => removeRow(index)}
          >
            ลบ
          </button>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={disabled || units.length >= MAX_PRODUCT_UNITS}
        onClick={addRow}
      >
        + เพิ่มหน่วย
      </button>
    </div>
  );
}

// Maps a catalog row's embedded `units` (from listCustomerProducts) into the
// editor's local row shape.
export function unitsFromCatalogRow(row) {
  return (row.units ?? []).map((u) => ({
    id: u.id,
    unitCode: u.unit_code ?? '',
    unitLabel: u.unit_label ?? '',
    weightPerUnitKg: u.weight_per_unit_kg != null ? String(u.weight_per_unit_kg) : '',
    boxesPerUnit: u.boxes_per_unit != null ? String(u.boxes_per_unit) : '',
  }));
}

// Reconciles a form's local `units` rows against the server: upserts every
// row still present (a brand-new row's unit_code is derived from the label
// it was given; existing rows keep their original code so historical
// entry_unit_code values on past deposit/withdrawal lines stay meaningful
// even if the label is edited later), then deletes whatever was removed
// from the list. Returns an array of human-readable warning strings for any
// row that failed (a delete blocked by "already used" is the expected case
// to surface here, not to treat as a hard failure of the whole save).
export async function saveProductUnits({ units, originalUnits, productId, upsertCustomerProductUnit, deleteCustomerProductUnit }) {
  const warnings = [];

  // Two brand-new rows sharing the same label would derive the same
  // unit_code and silently collapse into one row server-side (the upsert
  // RPC resolves an absent unitId by (customer_product_id, unit_code)) --
  // catch that here instead of quietly losing one of them.
  const seenNewCodes = new Set();

  for (const row of units) {
    const isEmptyRow = !row.unitLabel && !row.weightPerUnitKg && !row.boxesPerUnit;
    if (isEmptyRow) continue; // an unused blank row from "+ เพิ่มหน่วย" -- nothing to save, nothing to warn about
    if (!row.unitLabel || !row.weightPerUnitKg) {
      warnings.push(`${row.unitLabel || '(ไม่ได้ระบุชื่อหน่วย)'}: ข้ามการบันทึก — ต้องระบุทั้งชื่อหน่วยและกก./หน่วย`);
      continue;
    }

    const code = (row.unitCode || row.unitLabel).trim().toUpperCase();
    if (!row.id) {
      if (seenNewCodes.has(code)) {
        warnings.push(`${row.unitLabel}: ข้ามการบันทึก — ชื่อหน่วยซ้ำกับอีกแถวหนึ่ง กรุณาตั้งชื่อให้ต่างกัน`);
        continue;
      }
      seenNewCodes.add(code);
    }

    const result = await upsertCustomerProductUnit({
      unitId: row.id || null,
      customerProductId: productId,
      unitCode: row.unitCode || row.unitLabel,
      unitLabel: row.unitLabel,
      weightPerUnitKg: parseFloat(row.weightPerUnitKg),
      boxesPerUnit: row.boxesPerUnit !== '' ? parseFloat(row.boxesPerUnit) : null,
    });
    if (result.error) warnings.push(`${row.unitLabel}: ${result.error.message}`);
  }

  const keptIds = new Set(units.map((row) => row.id).filter(Boolean));
  const removedUnits = (originalUnits ?? []).filter((u) => !keptIds.has(u.id));
  for (const removed of removedUnits) {
    const result = await deleteCustomerProductUnit(removed.id);
    if (!result.error) continue;

    // The RPC blocks deleting a unit that's already been used on a real
    // deposit/withdrawal line and says to deactivate it instead -- there is
    // no separate "deactivate" control in this editor, so honor that by
    // falling back to an upsert that just flips is_active off, rather than
    // leaving the admin stuck with a unit they can neither remove nor hide.
    const deactivateResult = await upsertCustomerProductUnit({
      unitId: removed.id,
      customerProductId: productId,
      unitCode: removed.unit_code,
      unitLabel: removed.unit_label,
      weightPerUnitKg: removed.weight_per_unit_kg,
      boxesPerUnit: removed.boxes_per_unit,
      isActive: false,
    });
    if (deactivateResult.error) warnings.push(deactivateResult.error.message ?? result.error.message);
  }

  return warnings;
}
