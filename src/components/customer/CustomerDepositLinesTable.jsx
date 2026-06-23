import { useTranslation } from '../../i18n/languageProvider.jsx';
import {
  applyPackFieldChange,
  PACK_ENTRY_MODES,
} from '../../utils/customerDepositPackCalcUtils.js';

export function CustomerDepositLinesTable({
  catalogProducts = [],
  lines,
  onChange,
  onRemoveLine,
  testId = 'customer-deposit-lines-table',
}) {
  const t = useTranslation();

  function updateLine(lineKey, patch) {
    onChange(lines.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)));
  }

  function updatePackField(line, field, value) {
    const patch = applyPackFieldChange({
      mode: line.pack_entry_mode ?? PACK_ENTRY_MODES.BOXES,
      field,
      value,
      weightPerBox: line.weight_per_box,
      expectedBoxes: line.expected_boxes,
      expectedWeight: line.expected_weight,
    });
    updateLine(line.key, patch);
  }

  function selectCatalogProduct(lineKey, productId) {
    const product = catalogProducts.find((row) => row.id === productId);
    if (!product) {
      updateLine(lineKey, {
        catalog_product_id: '',
        customer_product_code: '',
        product_code: '',
        product_name: '',
        temperature_type: 'FROZEN',
        weight_per_box: '',
        weight_from_master: false,
      });
      return;
    }

    const hasPackWeight = product.pack_weight_kg != null && product.pack_weight_kg !== '';
    updateLine(lineKey, {
      catalog_product_id: product.id,
      customer_product_code: product.customer_product_code ?? '',
      product_code: product.internal_product_code ?? product.customer_product_code ?? '',
      product_name: product.product_name ?? '',
      temperature_type: product.temperature_type ?? 'FROZEN',
      weight_per_box: hasPackWeight ? String(product.pack_weight_kg) : '',
      weight_from_master: hasPackWeight,
    });
  }

  return (
    <div className="responsive-table customer-deposit-lines-table-wrap" data-testid={testId}>
      <table className="data-table customer-deposit-lines-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('catalog_col_customer_code')} <span className="field-required">*</span></th>
            <th>{t('catalog_col_product_name')}</th>
            <th>{t('customer_col_weight_per_box')} <span className="field-required">*</span></th>
            <th>{t('customer_col_total_deposit_weight')} <span className="field-required">*</span></th>
            <th>{t('customer_col_box_count')} <span className="field-required">*</span></th>
            <th>เลข LOT</th>
            <th>วันผลิต / วันหมดอายุ</th>
            <th>{t('customer_col_line_note')}</th>
            <th>{t('customer_col_pack_entry_mode')}</th>
            <th>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-deposit-line-0' : `customer-deposit-line-${line.key}`;
            const packMode = line.pack_entry_mode ?? PACK_ENTRY_MODES.BOXES;
            const weightReadonly = Boolean(line.weight_from_master);
            return (
              <tr data-testid={rowTestId} key={line.key}>
                <td>{index + 1}</td>
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-product-picker-select' : `${rowTestId}-product-select`}
                    onChange={(event) => selectCatalogProduct(line.key, event.target.value)}
                    value={line.catalog_product_id || ''}
                  >
                    <option value="">{t('customer_deposit_select_product')}</option>
                    {catalogProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.customer_product_code} — {product.product_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-product-name' : `${rowTestId}-product-name`}
                    disabled
                    readOnly
                    value={line.product_name}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-weight-per-box' : `${rowTestId}-weight-per-box`}
                    disabled={weightReadonly}
                    min="0"
                    onChange={weightReadonly ? undefined : (event) => updatePackField(line, 'weight_per_box', event.target.value)}
                    readOnly={weightReadonly}
                    step="0.01"
                    title={weightReadonly ? t('weight_from_master_readonly') : undefined}
                    type="number"
                    value={line.weight_per_box}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-total-weight' : `${rowTestId}-total-weight`}
                    disabled={packMode === PACK_ENTRY_MODES.BOXES}
                    min="0"
                    onChange={(event) => updatePackField(line, 'expected_weight', event.target.value)}
                    step="0.01"
                    type="number"
                    value={line.expected_weight}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-box-count' : `${rowTestId}-box-count`}
                    disabled={packMode === PACK_ENTRY_MODES.WEIGHT}
                    min="1"
                    onChange={(event) => updatePackField(line, 'expected_boxes', event.target.value)}
                    type="number"
                    value={line.expected_boxes}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { lot_no: event.target.value })}
                    placeholder="LOT number"
                    value={line.lot_no ?? ''}
                  />
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                    <input
                      className="form-control form-control-table"
                      onChange={(event) => updateLine(line.key, { mfg_date: event.target.value })}
                      placeholder="วันผลิต"
                      title="วันผลิต"
                      type="date"
                      value={line.mfg_date ?? ''}
                    />
                    <input
                      className="form-control form-control-table"
                      onChange={(event) => updateLine(line.key, { exp_date: event.target.value })}
                      placeholder="วันหมดอายุ"
                      title="วันหมดอายุ"
                      type="date"
                      value={line.exp_date ?? ''}
                    />
                  </div>
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-line-note' : `${rowTestId}-line-note`}
                    onChange={(event) => updateLine(line.key, { line_note: event.target.value })}
                    value={line.line_note}
                  />
                </td>
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-pack-entry-mode' : `${rowTestId}-pack-entry-mode`}
                    onChange={(event) => updateLine(line.key, { pack_entry_mode: event.target.value })}
                    value={packMode}
                  >
                    <option value={PACK_ENTRY_MODES.BOXES}>{t('customer_pack_mode_boxes')}</option>
                    <option value={PACK_ENTRY_MODES.WEIGHT}>{t('customer_pack_mode_weight')}</option>
                  </select>
                </td>
                <td>
                  {lines.length > 1 ? (
                    <button
                      className="btn btn-secondary btn-sm"
                      data-testid={`${rowTestId}-remove-button`}
                      onClick={() => onRemoveLine(line.key)}
                      type="button"
                    >
                      {t('customer_deposit_remove_line')}
                    </button>
                  ) : (
                    <span className="table-meta-text">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
