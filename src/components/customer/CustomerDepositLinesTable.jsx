import { useEffect, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { normalizeCatalogBarcode } from '../../utils/customerProductCsvUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CustomerDepositLinesTable({
  customerId,
  lines,
  onChange,
  onRemoveLine,
  testId = 'customer-deposit-lines-table',
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
      });
      return;
    }

    updateLine(lineKey, {
      catalog_product_id: product.id,
      customer_product_code: product.customer_product_code ?? '',
      product_code: normalizeCatalogBarcode(product),
      product_name: product.product_name ?? '',
      temperature_type: product.temperature_type ?? 'FROZEN',
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
            <th>{t('catalog_col_barcode')}</th>
            <th>{t('customer_field_lot_no')}</th>
            <th>{t('customer_col_expected_qty')} <span className="field-required">*</span></th>
            <th>{t('customer_col_expected_boxes')}</th>
            <th>{t('customer_col_expected_weight')}</th>
            <th>{t('catalog_col_temperature')}</th>
            <th>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-deposit-line-0' : `customer-deposit-line-${line.key}`;
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
                    data-testid={index === 0 ? 'customer-deposit-product-code' : `${rowTestId}-barcode`}
                    disabled
                    readOnly
                    value={line.product_code}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { lot_no: event.target.value })}
                    value={line.lot_no}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-deposit-qty' : `${rowTestId}-qty`}
                    min="1"
                    onChange={(event) => updateLine(line.key, { expected_qty: event.target.value })}
                    type="number"
                    value={line.expected_qty}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    min="0"
                    onChange={(event) => updateLine(line.key, { expected_boxes: event.target.value })}
                    type="number"
                    value={line.expected_boxes}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-table"
                    min="0"
                    onChange={(event) => updateLine(line.key, { expected_weight: event.target.value })}
                    step="0.01"
                    type="number"
                    value={line.expected_weight}
                  />
                </td>
                <td>
                  <select
                    className="form-control form-control-table"
                    onChange={(event) => updateLine(line.key, { temperature_type: event.target.value })}
                    value={line.temperature_type}
                  >
                    <option value="FROZEN">FROZEN</option>
                    <option value="CHILLED">CHILLED</option>
                    <option value="AMBIENT">AMBIENT</option>
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
