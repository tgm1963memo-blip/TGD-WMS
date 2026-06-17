import { useEffect, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { normalizeCatalogBarcode } from '../../utils/customerProductExcelUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerWithdrawalLinesTable({
  customerId,
  depositOptions = [],
  lines,
  onChange,
  onRemoveLine,
  testId = 'customer-withdrawal-lines-table',
}) {
  const t = useTranslation();
  const [catalogProducts, setCatalogProducts] = useState([]);

  useEffect(() => {
    let active = true;
    if (!customerId) {
      setCatalogProducts([]);
      return undefined;
    }

    listCustomerProducts({ customerId, activeOnly: true }).then((result) => {
      if (!active) return;
      setCatalogProducts(result.data ?? []);
    });

    return () => {
      active = false;
    };
  }, [customerId]);

  function updateLine(lineKey, patch) {
    onChange(lines.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)));
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
        argent_type: '',
      });
      return;
    }

    updateLine(lineKey, {
      catalog_product_id: product.id,
      customer_product_code: product.customer_product_code ?? '',
      product_code: normalizeCatalogBarcode(product),
      product_name: product.product_name ?? '',
      temperature_type: product.temperature_type ?? 'FROZEN',
      argent_type: product.argent_type ?? 'NON_ARGENT',
    });
  }

  return (
    <div className="responsive-table customer-withdrawal-lines-table-wrap" data-testid={testId}>
      <table className="data-table customer-withdrawal-lines-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('catalog_col_customer_code')} <span className="field-required">*</span></th>
            <th>{t('catalog_col_product_name')}</th>
            <th>{t('catalog_col_barcode')}</th>
            <th>{t('customer_field_source_deposit')}</th>
            <th>{t('customer_field_lot_no')}</th>
            <th>{t('customer_col_mfg_date')}</th>
            <th>{t('customer_col_exp_date')}</th>
            <th>{t('customer_col_requested_qty')} <span className="field-required">*</span></th>
            <th>{t('customer_col_requested_boxes')}</th>
            <th>{t('customer_col_requested_weight')}</th>
            <th>{t('customer_field_picking_rule')}</th>
            <th>{t('catalog_col_argent')}</th>
            <th>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-withdrawal-line-0' : `customer-withdrawal-line-${line.key}`;
            return (
              <tr data-testid={rowTestId} key={line.key}>
                <td>{index + 1}</td>
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-withdrawal-product-picker-select' : `${rowTestId}-product-select`}
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
                  <input className="form-control form-control-table" disabled readOnly value={line.product_name} />
                </td>
                <td>
                  <input className="form-control form-control-table" disabled readOnly value={line.product_code} />
                </td>
                <td>
                  <select
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { source_deposit_request_id: event.target.value })}
                    value={line.source_deposit_request_id || ''}
                  >
                    <option value="">{t('customer_field_source_deposit_optional')}</option>
                    {depositOptions.map((row) => (
                      <option key={row.id} value={row.id}>{row.request_no} ({row.status})</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-lot`}
                    onChange={(event) => updateLine(line.key, { lot_no: event.target.value })}
                    value={line.lot_no}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { mfg_date: event.target.value })}
                    type="date"
                    value={line.mfg_date}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { exp_date: event.target.value })}
                    type="date"
                    value={line.exp_date}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-withdrawal-qty' : `${rowTestId}-qty`}
                    min="1"
                    onChange={(event) => updateLine(line.key, { requested_qty: event.target.value })}
                    type="number"
                    value={line.requested_qty}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    min="0"
                    onChange={(event) => updateLine(line.key, { requested_boxes: event.target.value })}
                    type="number"
                    value={line.requested_boxes}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    min="0"
                    onChange={(event) => updateLine(line.key, { requested_weight: event.target.value })}
                    step="0.01"
                    type="number"
                    value={line.requested_weight}
                  />
                </td>
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-picking-rule-select' : `${rowTestId}-picking-rule`}
                    onChange={(event) => updateLine(line.key, { picking_rule: event.target.value })}
                    value={line.picking_rule}
                  >
                    <option value="FEFO">FEFO</option>
                    <option value="SPECIFIC_DEPOSIT">SPECIFIC_DEPOSIT</option>
                    <option value="SPECIFIC_LOT">SPECIFIC_LOT</option>
                  </select>
                </td>
                <td>
                  <input className="form-control form-control-table" disabled readOnly value={line.argent_type || '-'} />
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
