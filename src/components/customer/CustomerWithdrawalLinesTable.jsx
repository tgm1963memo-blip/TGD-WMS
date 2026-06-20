import { useEffect, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { normalizeCatalogBarcode } from '../../utils/customerProductExcelUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const ID_TYPES = [
  { value: 'LOT', label: 'เลข LOT' },
  { value: 'MFG_DATE', label: 'วันที่ผลิต' },
  { value: 'EXP_DATE', label: 'วันหมดอายุ' },
];

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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!customerId) {
      setCatalogProducts([]);
      return undefined;
    }

    setLoading(true);
    listCustomerProducts({ customerId, activeOnly: true }).then((result) => {
      if (!active) return;
      setCatalogProducts(result.data ?? []);
      setLoading(false);
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

  function changeIdentifierType(lineKey, newType) {
    updateLine(lineKey, { identifier_type: newType, lot_no: '', mfg_date: '', exp_date: '' });
  }

  function setIdentifierValue(line, val) {
    const type = line.identifier_type ?? 'LOT';
    if (type === 'LOT') return updateLine(line.key, { lot_no: val, mfg_date: '', exp_date: '' });
    if (type === 'MFG_DATE') return updateLine(line.key, { mfg_date: val, lot_no: '', exp_date: '' });
    if (type === 'EXP_DATE') return updateLine(line.key, { exp_date: val, lot_no: '', mfg_date: '' });
  }

  function getIdentifierValue(line) {
    const type = line.identifier_type ?? 'LOT';
    if (type === 'LOT') return line.lot_no ?? '';
    if (type === 'MFG_DATE') return line.mfg_date ?? '';
    if (type === 'EXP_DATE') return line.exp_date ?? '';
    return '';
  }

  const noCustomer = !customerId;

  return (
    <div className="responsive-table customer-withdrawal-lines-table-wrap" data-testid={testId}>
      {noCustomer && (
        <div className="banner banner-warning" style={{ margin: '0 0 12px' }}>
          กรุณาเลือกลูกค้าก่อน เพื่อโหลดรายการสินค้าที่เบิกได้
        </div>
      )}
      {loading && (
        <div className="banner banner-info" style={{ margin: '0 0 12px' }}>
          กำลังโหลดรายการสินค้า...
        </div>
      )}
      {!noCustomer && !loading && catalogProducts.length === 0 && (
        <div className="banner banner-warning" style={{ margin: '0 0 12px' }}>
          ยังไม่มีรายการสินค้าในแคตตาล็อกของลูกค้านี้
        </div>
      )}
      <table className="data-table customer-withdrawal-lines-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th style={{ minWidth: 200 }}>รหัสสินค้า <span className="field-required">*</span></th>
            <th style={{ minWidth: 160 }}>ชื่อสินค้า</th>
            <th style={{ minWidth: 220 }}>LOT / วันผลิต / วันหมดอายุ</th>
            <th style={{ minWidth: 120 }}>น้ำหนัก (กก.) <span className="field-required">*</span></th>
            <th style={{ minWidth: 140 }}>กฎการหยิบ</th>
            <th style={{ minWidth: 160 }}>แหล่งที่มา (ใบฝาก)</th>
            <th style={{ width: 80 }}>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-withdrawal-line-0' : `customer-withdrawal-line-${line.key}`;
            const idType = line.identifier_type ?? 'LOT';
            const idValue = getIdentifierValue(line);
            const isDateType = idType === 'MFG_DATE' || idType === 'EXP_DATE';

            return (
              <tr data-testid={rowTestId} key={line.key}>
                <td style={{ textAlign: 'center', color: 'var(--tgd-muted-text)', fontWeight: 600 }}>{index + 1}</td>

                {/* Product code dropdown */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'customer-withdrawal-product-picker-select' : `${rowTestId}-product-select`}
                    disabled={noCustomer || loading}
                    onChange={(e) => selectCatalogProduct(line.key, e.target.value)}
                    value={line.catalog_product_id || ''}
                  >
                    <option value="">{noCustomer ? '— เลือกลูกค้าก่อน —' : t('customer_deposit_select_product')}</option>
                    {catalogProducts.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.customer_product_code} — {product.product_name}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Product name (auto-filled) */}
                <td>
                  <input
                    className="form-control form-control-table"
                    disabled
                    readOnly
                    placeholder="ชื่อสินค้า"
                    value={line.product_name}
                  />
                </td>

                {/* Combined identifier: type selector + input */}
                <td>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <select
                      className="form-control form-control-table"
                      style={{ flex: '0 0 110px', fontSize: 12 }}
                      value={idType}
                      onChange={(e) => changeIdentifierType(line.key, e.target.value)}
                    >
                      {ID_TYPES.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <input
                      className="form-control form-control-table"
                      data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-identifier`}
                      style={{ flex: 1 }}
                      type={isDateType ? 'date' : 'text'}
                      placeholder={idType === 'LOT' ? 'เลข LOT' : ''}
                      value={idValue}
                      onChange={(e) => setIdentifierValue(line, e.target.value)}
                    />
                  </div>
                </td>

                {/* Weight */}
                <td>
                  <input
                    className="form-control form-control-table"
                    min="0"
                    step="0.01"
                    type="number"
                    placeholder="กก."
                    onChange={(e) => updateLine(line.key, { requested_weight: e.target.value })}
                    value={line.requested_weight}
                  />
                </td>

                {/* Picking rule */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-picking-rule-select' : `${rowTestId}-picking-rule`}
                    onChange={(e) => updateLine(line.key, { picking_rule: e.target.value })}
                    value={line.picking_rule}
                  >
                    <option value="FEFO">FEFO (หมดก่อน-หยิบก่อน)</option>
                    <option value="SPECIFIC_DEPOSIT">ระบุใบฝาก</option>
                    <option value="SPECIFIC_LOT">ระบุ LOT</option>
                  </select>
                </td>

                {/* Source deposit */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-source-deposit-select' : `${rowTestId}-source-deposit`}
                    onChange={(e) => updateLine(line.key, { source_deposit_request_id: e.target.value })}
                    value={line.source_deposit_request_id || ''}
                  >
                    <option value="">— ทั้งหมด —</option>
                    {depositOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label ?? opt.id}</option>
                    ))}
                  </select>
                </td>

                {/* Remove */}
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
