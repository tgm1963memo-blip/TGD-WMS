import { useEffect, useMemo, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { normalizeCatalogBarcode } from '../../utils/customerProductExcelUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const NULL_LOT_SENTINEL = '__null_lot__';

export function CustomerWithdrawalLinesTable({
  customerId,
  depositOptions = [],
  depositLinesMap = {},
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

  const allDepositLines = useMemo(() => Object.values(depositLinesMap).flat(), [depositLinesMap]);

  const availableCatalogProducts = useMemo(() => {
    return catalogProducts.filter((product) => {
      const pLines = allDepositLines.filter((dl) =>
        (product.customer_product_code && dl.customer_product_code === product.customer_product_code) ||
        (product.product_name && dl.product_name === product.product_name),
      );
      const balance = pLines.reduce((sum, dl) => sum + (Number(dl.actual_weight) || Number(dl.expected_weight) || 0), 0);
      return balance > 0;
    });
  }, [catalogProducts, allDepositLines]);

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
      lot_no: '',
      mfg_date: '',
      exp_date: '',
    });
  }

  function selectLotFromBalance(line, lotValue) {
    if (!lotValue) {
      updateLine(line.key, { lot_no: '', mfg_date: '', exp_date: '' });
      return;
    }
    const isNullLot = lotValue === NULL_LOT_SENTINEL;
    const matchedDepositLine = allDepositLines.find(
      (dl) =>
        (isNullLot ? !dl.lot_no : dl.lot_no === lotValue) &&
        (dl.customer_product_code === line.customer_product_code || dl.product_name === line.product_name),
    );
    updateLine(line.key, {
      lot_no: lotValue,
      mfg_date: matchedDepositLine?.mfg_date ?? '',
      exp_date: matchedDepositLine?.exp_date ?? '',
    });
  }

  function selectSourceDeposit(lineKey, depositId) {
    updateLine(lineKey, { source_deposit_request_id: depositId, lot_no: '', mfg_date: '', exp_date: '' });
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
            <th style={{ minWidth: 180 }}>LOT (จากยอดคงเหลือ)</th>
            <th style={{ minWidth: 110 }}>วันผลิต</th>
            <th style={{ minWidth: 110 }}>วันหมดอายุ</th>
            <th style={{ minWidth: 120 }}>น้ำหนัก (กก.) <span className="field-required">*</span></th>
            <th style={{ minWidth: 160 }}>แหล่งที่มา (ใบฝาก)</th>
            <th style={{ width: 80 }}>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-withdrawal-line-0' : `customer-withdrawal-line-${line.key}`;

            // Source deposit lines (filtered by selected deposit or all)
            const sourceDepositLines = line.source_deposit_request_id
              ? (depositLinesMap[line.source_deposit_request_id] ?? [])
              : allDepositLines;

            // Product-matching lines including null-lot entries
            const productMatchedLines = sourceDepositLines.filter((dl) =>
              !line.customer_product_code ||
              dl.customer_product_code === line.customer_product_code ||
              dl.product_name === line.product_name,
            );

            const hasNullLot = productMatchedLines.some((dl) => !dl.lot_no);
            const displayLots = [...new Set(productMatchedLines.filter((dl) => dl.lot_no).map((dl) => dl.lot_no))];

            const effectiveLotNo = line.lot_no === NULL_LOT_SENTINEL ? '' : (line.lot_no || '');
            const isNullLotSelected = line.lot_no === NULL_LOT_SENTINEL;

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
                    {availableCatalogProducts.map((product) => (
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

                {/* LOT dropdown including null-lot deposits */}
                <td>
                  {displayLots.length > 0 || hasNullLot ? (
                    <select
                      className="form-control form-control-table"
                      data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-identifier`}
                      value={line.lot_no || ''}
                      onChange={(e) => selectLotFromBalance(line, e.target.value)}
                    >
                      <option value="">— เลือก LOT —</option>
                      {hasNullLot && (
                        <option value={NULL_LOT_SENTINEL}>ไม่ระบุ (ใบฝากไม่ระบุ LOT)</option>
                      )}
                      {displayLots.map((lot) => (
                        <option key={lot} value={lot}>{lot}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="form-control form-control-table"
                      data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-identifier`}
                      type="text"
                      placeholder="เลข LOT"
                      value={line.lot_no === NULL_LOT_SENTINEL ? '' : (line.lot_no || '')}
                      onChange={(e) => updateLine(line.key, { lot_no: e.target.value })}
                    />
                  )}
                </td>

                {/* Mfg date */}
                <td>
                  <input
                    className="form-control form-control-table"
                    type="date"
                    value={line.mfg_date || ''}
                    onChange={(e) => updateLine(line.key, { mfg_date: e.target.value })}
                  />
                </td>

                {/* Exp date */}
                <td>
                  <input
                    className="form-control form-control-table"
                    type="date"
                    value={line.exp_date || ''}
                    onChange={(e) => updateLine(line.key, { exp_date: e.target.value })}
                  />
                </td>

                {/* Weight with balance validation */}
                <td>
                  {(() => {
                    const lotsBalance = {};
                    productMatchedLines.forEach((dl) => {
                      const l = dl.lot_no || 'ไม่ระบุ';
                      if (!lotsBalance[l]) lotsBalance[l] = 0;
                      lotsBalance[l] += (Number(dl.actual_weight) || Number(dl.expected_weight) || 0);
                    });

                    const balanceLines = productMatchedLines.filter((dl) => {
                      if (isNullLotSelected) return !dl.lot_no;
                      if (!effectiveLotNo) return true;
                      return dl.lot_no === effectiveLotNo;
                    });
                    const maxBalance = balanceLines.reduce((sum, dl) => sum + (Number(dl.actual_weight) || Number(dl.expected_weight) || 0), 0);
                    const exceedsBalance = maxBalance > 0 && Number(line.requested_weight) > maxBalance;
                    return (
                      <>
                        <input
                          className="form-control form-control-table"
                          min="0"
                          step="0.01"
                          type="number"
                          placeholder="กก."
                          style={exceedsBalance ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : {}}
                          onChange={(e) => updateLine(line.key, { requested_weight: e.target.value })}
                          value={line.requested_weight}
                        />
                        {exceedsBalance && (
                          <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4, lineHeight: 1.4 }}>
                            <div>เกินยอดคงเหลือ (มี {maxBalance.toFixed(2)} กก.)</div>
                            {Object.keys(lotsBalance).length > 0 && (
                              <div style={{ marginTop: 4, padding: '4px', background: '#fee2e2', borderRadius: '4px' }}>
                                <div style={{ fontWeight: 700, marginBottom: 2 }}>คงเหลือแต่ละ LOT:</div>
                                {Object.entries(lotsBalance).map(([l, b]) => (
                                  <div key={l}>- {l}: {b.toFixed(2)} กก.</div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </td>

                {/* Source deposit */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-source-deposit-select' : `${rowTestId}-source-deposit`}
                    onChange={(e) => selectSourceDeposit(line.key, e.target.value)}
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
