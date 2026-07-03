import { useEffect, useMemo, useState } from 'react';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { normalizeCatalogBarcode } from '../../utils/customerProductExcelUtils.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';
import { DateInputDMY } from '../common/DateInputDMY.jsx';
import {
  NULL_LOT_SENTINEL,
  WITHDRAWAL_IDENTIFIER_TYPES,
  WITHDRAWAL_QTY_MODES,
  getMatchedDepositLine,
  getProductMatchedDepositLines,
  getWithdrawalBalanceInfo,
} from '../../utils/customerWithdrawalLineDefaults.js';

const IDENTIFIER_TYPE_LABELS = {
  [WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE]: 'รหัสติดตาม',
  [WITHDRAWAL_IDENTIFIER_TYPES.LOT]: 'LOT',
  [WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE]: 'วันผลิต',
  [WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE]: 'วันหมดอายุ',
  [WITHDRAWAL_IDENTIFIER_TYPES.NOTE]: 'หมายเหตุ (admin)',
};

export function CustomerWithdrawalLinesTable({
  customerId,
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
        identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.LOT,
        identifier_value: '',
        lot_no: '',
        mfg_date: '',
        exp_date: '',
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
      identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.LOT,
      identifier_value: '',
      lot_no: '',
      mfg_date: '',
      exp_date: '',
    });
  }

  function selectIdentifierType(lineKey, type) {
    updateLine(lineKey, { identifier_type: type, identifier_value: '', lot_no: '', mfg_date: '', exp_date: '' });
  }

  function selectIdentifierValue(line, value) {
    if (!value) {
      updateLine(line.key, { identifier_value: '', lot_no: '', mfg_date: '', exp_date: '' });
      return;
    }

    const type = line.identifier_type || WITHDRAWAL_IDENTIFIER_TYPES.LOT;
    const isNullLot = type === WITHDRAWAL_IDENTIFIER_TYPES.LOT && value === NULL_LOT_SENTINEL;
    const productMatched = getProductMatchedDepositLines(line, allDepositLines);
    const matches = productMatched.filter((dl) => {
      if (type === WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE) return dl.tracking_code === value;
      if (type === WITHDRAWAL_IDENTIFIER_TYPES.LOT) return isNullLot ? !dl.lot_no : dl.lot_no === value;
      if (type === WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE) return dl.mfg_date === value;
      if (type === WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE) return dl.exp_date === value;
      if (type === WITHDRAWAL_IDENTIFIER_TYPES.NOTE) return dl.actual_note === value;
      return false;
    });
    const first = matches[0];
    const lotSet = [...new Set(matches.map((m) => m.lot_no || ''))].filter(Boolean);

    updateLine(line.key, {
      identifier_value: value,
      lot_no: type === WITHDRAWAL_IDENTIFIER_TYPES.LOT ? value : (lotSet.length === 1 ? lotSet[0] : ''),
      mfg_date: type === WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE ? value : (first?.mfg_date ?? ''),
      exp_date: type === WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE ? value : (first?.exp_date ?? ''),
      note: line.note ? line.note : (first?.actual_note ?? ''),
    });
  }

  // Tracking code uniquely identifies one deposit line, so picking it here sets
  // the source deposit + LOT + dates in one step, replacing the old "pick a
  // deposit note, then pick a LOT within it" two-step flow.
  function selectSourceTrackingCode(line, trackingCode) {
    if (!trackingCode) {
      updateLine(line.key, {
        source_deposit_request_id: '',
        identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.LOT,
        identifier_value: '',
        lot_no: '',
        mfg_date: '',
        exp_date: '',
      });
      return;
    }
    const match = getProductMatchedDepositLines(line, allDepositLines).find((dl) => dl.tracking_code === trackingCode);
    updateLine(line.key, {
      source_deposit_request_id: match?.deposit_request_id ?? '',
      identifier_type: WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE,
      identifier_value: trackingCode,
      lot_no: match?.lot_no ?? '',
      mfg_date: match?.mfg_date ?? '',
      exp_date: match?.exp_date ?? '',
      note: line.note ? line.note : (match?.actual_note ?? ''),
    });
  }

  function pullNoteFromDeposit(line, matchedDepositLine) {
    updateLine(line.key, { note: matchedDepositLine?.actual_note ?? '' });
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
            <th className="col-line-no" style={{ width: 32, whiteSpace: 'nowrap' }}>#</th>
            <th style={{ minWidth: 180 }}>รหัสสินค้า <span className="field-required">*</span></th>
            <th style={{ minWidth: 170 }}>อ้างอิงคงเหลือจาก (LOT/วันที่/หมายเหตุ)</th>
            <th style={{ minWidth: 130, whiteSpace: 'nowrap' }}>วันผลิต</th>
            <th style={{ minWidth: 130, whiteSpace: 'nowrap' }}>วันหมดอายุ</th>
            <th style={{ minWidth: 110, whiteSpace: 'nowrap' }}>ระบุเป็น</th>
            <th style={{ minWidth: 80, whiteSpace: 'nowrap' }}>กล่อง <span className="field-required">*</span></th>
            <th style={{ minWidth: 100, whiteSpace: 'nowrap' }}>น้ำหนัก (กก.) <span className="field-required">*</span></th>
            <th style={{ minWidth: 160 }}>แหล่งที่มา (รหัสติดตาม)</th>
            <th style={{ minWidth: 150 }}>หมายเหตุ</th>
            <th style={{ width: 70, whiteSpace: 'nowrap' }}>{t('catalog_col_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => {
            const rowTestId = index === 0 ? 'customer-withdrawal-line-0' : `customer-withdrawal-line-${line.key}`;

            // Source deposit lines (filtered by selected deposit or all)
            const sourceDepositLines = line.source_deposit_request_id
              ? (depositLinesMap[line.source_deposit_request_id] ?? [])
              : allDepositLines;

            const identifierType = line.identifier_type || WITHDRAWAL_IDENTIFIER_TYPES.LOT;
            const productMatchedLines = getProductMatchedDepositLines(line, sourceDepositLines);

            const hasNullLot = identifierType === WITHDRAWAL_IDENTIFIER_TYPES.LOT
              && productMatchedLines.some((dl) => !dl.lot_no);

            const trackingCodeOptions = [...new Set(
              getProductMatchedDepositLines(line, allDepositLines).filter((dl) => dl.tracking_code).map((dl) => dl.tracking_code),
            )].sort();

            let identifierOptions = [];
            if (identifierType === WITHDRAWAL_IDENTIFIER_TYPES.LOT) {
              identifierOptions = [...new Set(productMatchedLines.filter((dl) => dl.lot_no).map((dl) => dl.lot_no))];
            } else if (identifierType === WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE) {
              identifierOptions = [...new Set(productMatchedLines.filter((dl) => dl.mfg_date).map((dl) => dl.mfg_date))].sort();
            } else if (identifierType === WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE) {
              identifierOptions = [...new Set(productMatchedLines.filter((dl) => dl.exp_date).map((dl) => dl.exp_date))].sort();
            } else if (identifierType === WITHDRAWAL_IDENTIFIER_TYPES.NOTE) {
              identifierOptions = [...new Set(productMatchedLines.filter((dl) => dl.actual_note).map((dl) => dl.actual_note))];
            }

            const showManualLotInput = identifierType === WITHDRAWAL_IDENTIFIER_TYPES.LOT
              && identifierOptions.length === 0 && !hasNullLot;

            const matchedDL = getMatchedDepositLine(line, sourceDepositLines);
            const weightPerBox = matchedDL?.weight_per_box ? Number(matchedDL.weight_per_box) : null;
            const { maxBoxBalance, maxWtBalance, exceedsBoxBalance, exceedsWtBalance } = getWithdrawalBalanceInfo(line, sourceDepositLines);

            const qtyMode = line.withdrawal_qty_mode || WITHDRAWAL_QTY_MODES.WEIGHT;
            const boxesDisabled = Boolean(weightPerBox) && qtyMode === WITHDRAWAL_QTY_MODES.WEIGHT;
            const weightDisabled = Boolean(weightPerBox) && qtyMode === WITHDRAWAL_QTY_MODES.BOXES;

            return (
              <tr data-testid={rowTestId} key={line.key}>
                <td className="col-line-no" style={{ textAlign: 'center', color: 'var(--tgd-muted-text)', fontWeight: 600 }}>{index + 1}</td>

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

                {/* Identifier reference type + value dropdown */}
                <td>
                  {identifierType === WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE ? (
                    <div className="form-control form-control-table" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'var(--tgd-surface-muted, #f1f5f9)' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{line.identifier_value}</span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => selectSourceTrackingCode(line, '')}
                      >
                        เปลี่ยน
                      </button>
                    </div>
                  ) : (
                    <>
                      <select
                        className="form-control form-control-table"
                        data-testid={`${rowTestId}-identifier-type`}
                        onChange={(e) => selectIdentifierType(line.key, e.target.value)}
                        style={{ marginBottom: 4 }}
                        value={identifierType}
                      >
                        <option value={WITHDRAWAL_IDENTIFIER_TYPES.LOT}>อ้างอิง: LOT</option>
                        <option value={WITHDRAWAL_IDENTIFIER_TYPES.MFG_DATE}>อ้างอิง: วันผลิต</option>
                        <option value={WITHDRAWAL_IDENTIFIER_TYPES.EXP_DATE}>อ้างอิง: วันหมดอายุ</option>
                        <option value={WITHDRAWAL_IDENTIFIER_TYPES.NOTE}>อ้างอิง: หมายเหตุ (admin)</option>
                      </select>

                      {showManualLotInput ? (
                        <input
                          className="form-control form-control-table"
                          data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-identifier`}
                          type="text"
                          placeholder="เลข LOT"
                          value={line.lot_no === NULL_LOT_SENTINEL ? '' : (line.lot_no || '')}
                          onChange={(e) => updateLine(line.key, { lot_no: e.target.value, identifier_value: e.target.value })}
                        />
                      ) : (
                        <select
                          className="form-control form-control-table"
                          data-testid={index === 0 ? 'withdrawal-lot-select' : `${rowTestId}-identifier`}
                          disabled={identifierOptions.length === 0 && !hasNullLot}
                          onChange={(e) => selectIdentifierValue(line, e.target.value)}
                          value={line.identifier_value || ''}
                        >
                          <option value="">— เลือก{IDENTIFIER_TYPE_LABELS[identifierType]} —</option>
                          {hasNullLot && (
                            <option value={NULL_LOT_SENTINEL}>ไม่ระบุ (ใบฝากไม่ระบุ LOT)</option>
                          )}
                          {identifierOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      )}
                    </>
                  )}
                </td>

                {/* Mfg date */}
                <td>
                  <DateInputDMY
                    className="form-control form-control-table"
                    value={line.mfg_date || ''}
                    onChange={(e) => updateLine(line.key, { mfg_date: e.target.value })}
                  />
                </td>

                {/* Exp date */}
                <td>
                  <DateInputDMY
                    className="form-control form-control-table"
                    value={line.exp_date || ''}
                    onChange={(e) => updateLine(line.key, { exp_date: e.target.value })}
                  />
                </td>

                {/* Qty mode */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={`${rowTestId}-qty-mode`}
                    onChange={(e) => updateLine(line.key, { withdrawal_qty_mode: e.target.value })}
                    value={qtyMode}
                  >
                    <option value={WITHDRAWAL_QTY_MODES.WEIGHT}>ระบุน้ำหนัก</option>
                    <option value={WITHDRAWAL_QTY_MODES.BOXES}>ระบุกล่อง</option>
                  </select>
                  {!weightPerBox && (
                    <div
                      style={{ fontSize: 11, color: '#b45309', marginTop: 4, whiteSpace: 'nowrap' }}
                      title="ไม่ทราบน้ำหนัก/กล่อง กรุณาระบุทั้งสองค่า"
                    >
                      ⚠ ระบุทั้งสองค่า
                    </div>
                  )}
                </td>

                {/* Box quantity with weight auto-calc */}
                <td>
                  <input
                    className="form-control form-control-table"
                    disabled={boxesDisabled}
                    min="0"
                    type="number"
                    placeholder="กล่อง"
                    style={exceedsBoxBalance ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : {}}
                    value={line.requested_boxes}
                    onChange={(e) => {
                      const boxes = e.target.value;
                      const weight = weightPerBox && boxes !== '' ? (Number(boxes) * weightPerBox).toFixed(2) : line.requested_weight;
                      updateLine(line.key, { requested_boxes: boxes, requested_weight: weight });
                    }}
                  />
                  {exceedsBoxBalance && (
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                      เกินยอดคงเหลือ (มี {maxBoxBalance} กล่อง)
                    </div>
                  )}
                </td>

                {/* Weight quantity with box auto-calc */}
                <td>
                  <input
                    className="form-control form-control-table"
                    disabled={weightDisabled}
                    min="0"
                    step="0.01"
                    type="number"
                    placeholder="กก."
                    style={exceedsWtBalance ? { borderColor: '#dc2626', backgroundColor: '#fef2f2' } : {}}
                    value={line.requested_weight}
                    onChange={(e) => {
                      const weight = e.target.value;
                      const boxes = weightPerBox && weight !== '' ? Math.round(Number(weight) / weightPerBox).toString() : line.requested_boxes;
                      updateLine(line.key, { requested_weight: weight, requested_boxes: boxes });
                    }}
                  />
                  {exceedsWtBalance && (
                    <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                      เกินยอดคงเหลือ (มี {maxWtBalance.toFixed(2)} กก.)
                    </div>
                  )}
                </td>

                {/* Source: tracking code (uniquely pins the deposit line) */}
                <td>
                  <select
                    className="form-control form-control-table"
                    data-testid={index === 0 ? 'withdrawal-source-deposit-select' : `${rowTestId}-source-deposit`}
                    onChange={(e) => selectSourceTrackingCode(line, e.target.value)}
                    value={identifierType === WITHDRAWAL_IDENTIFIER_TYPES.TRACKING_CODE ? (line.identifier_value || '') : ''}
                  >
                    <option value="">— ทั้งหมด —</option>
                    {trackingCodeOptions.map((code) => (
                      <option key={code} value={code}>{code}</option>
                    ))}
                  </select>
                </td>

                {/* Note */}
                <td>
                  <input
                    className="form-control form-control-table"
                    data-testid={`${rowTestId}-note`}
                    type="text"
                    placeholder="หมายเหตุ"
                    value={line.note || ''}
                    onChange={(e) => updateLine(line.key, { note: e.target.value })}
                  />
                  {matchedDL?.actual_note ? (
                    <button
                      data-testid={`${rowTestId}-pull-note-button`}
                      onClick={() => pullNoteFromDeposit(line, matchedDL)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--tgd-link-color, #2563eb)',
                        cursor: 'pointer',
                        fontSize: 11,
                        padding: '2px 0',
                        textDecoration: 'underline',
                      }}
                      type="button"
                    >
                      ดึงหมายเหตุจากใบฝาก
                    </button>
                  ) : null}
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
