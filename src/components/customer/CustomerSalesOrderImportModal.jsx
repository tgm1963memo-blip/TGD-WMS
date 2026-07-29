import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal } from '../ui/Modal.jsx';
import {
  readSalesOrderExcelFile,
  parseSalesOrderRows,
} from '../../utils/customerSalesOrderImportUtils.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { getDepositInventoryLines } from '../../services/customerDepositRequestService.js';
import {
  createCustomerWithdrawalRequest,
  upsertCustomerWithdrawalRequestLine,
} from '../../services/customerWithdrawalRequestService.js';
import { allocateFefoAcrossLots } from '../../utils/customerWithdrawalLineExcelUtils.js';

// Bulk-import a customer's own ERP-exported "ใบส่งสินค้า" file into one
// withdrawal request PER DEBTOR GROUP found in the file — see
// customerSalesOrderImportUtils.js for the parsing/aggregation rules and
// the plan notes behind this feature (2026-07-27 session: bulk warehouse
// pick, then sort per destination outside afterward). The customer can
// select a subset of debtor groups to create withdrawal requests for now
// and leave the rest for a later import run.
function groupKey(group) {
  return `${group.debtorCode}|${group.debtorName}`;
}

// Attaches a stock-availability check to each matched product — separate
// from catalog matching (which only asks "do we know this code at all").
// A code can match the catalog perfectly and still have zero AVAILABLE
// balance right now because it's already claimed by another pending
// withdrawal request (own or otherwise) — that's a normal, expected state,
// not a data error, so it gets its own distinct label instead of reusing
// "ไม่พบในแคตตาล็อก" (not in catalog) or a bare "no stock found" message
// that reads like the product doesn't exist.
// A deposit line's balance already has every non-cancelled withdrawal
// claim against it subtracted out (see getDepositInventoryLines) — this
// just reads back WHICH withdrawal request(s) hold those claims, so a
// "0 available" message can point at the customer's own other pending
// request instead of leaving them to wonder if the deposit went missing.
function describeClaimHolders(candidates) {
  const withdrawalNos = new Set();
  for (const dl of candidates) {
    for (const claim of dl.claimed_by ?? []) {
      if (claim.withdrawalNo) withdrawalNos.add(claim.withdrawalNo);
    }
  }
  return [...withdrawalNos];
}

function withStockCheck(product, depositLines) {
  if (!product.matched) return { ...product, stockAvailableQty: null, stockShortfall: null };
  const canonicalCode = product.matchedProductCode ?? product.productCode;
  const mode = product.requestedWeight != null ? 'weight' : 'boxes';
  const requestedQty = Number(mode === 'weight' ? product.requestedWeight : product.requestedBoxes) || 0;
  const candidates = depositLines.filter((dl) => dl.customer_product_code === canonicalCode);
  const { shortfall } = allocateFefoAcrossLots(candidates, requestedQty, mode);
  return {
    ...product,
    stockAvailableQty: requestedQty - shortfall,
    stockShortfall: shortfall,
    stockMode: mode,
    stockClaimedBy: shortfall > 0 ? describeClaimHolders(candidates) : [],
  };
}

export function CustomerSalesOrderImportModal({ isOpen, onClose, customerId, onImported }) {
  const [step, setStep] = useState('upload'); // upload | preview | submitting | done
  const [fileName, setFileName] = useState('');
  const [groups, setGroups] = useState([]);
  const [selectedKeys, setSelectedKeys] = useState(new Set()); // stores itemKey: `${groupKey(group)}|${productCode}`
  const [depositLines, setDepositLines] = useState([]);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);

  function reset() {
    setStep('upload');
    setFileName('');
    setGroups([]);
    setSelectedKeys(new Set());
    setDepositLines([]);
    setError('');
    setResults([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError('');
    try {
      const [rawRows, catalogResult, depositResult] = await Promise.all([
        readSalesOrderExcelFile(file),
        listCustomerProducts({ customerId }),
        getDepositInventoryLines({ customerId }),
      ]);
      if (catalogResult.error) {
        setError(catalogResult.error.message);
        return;
      }
      if (depositResult.error) {
        setError(depositResult.error.message);
        return;
      }
      const { groups: parsedGroups } = parseSalesOrderRows(rawRows, catalogResult.data ?? []);
      if (parsedGroups.length === 0) {
        setError('ไม่พบรายการสินค้าในไฟล์นี้ — ตรวจสอบว่าเป็นไฟล์รูปแบบ "ใบส่งสินค้า" ที่ถูกต้อง');
        return;
      }
      const linesForStockCheck = depositResult.data ?? [];
      const checkedGroups = parsedGroups.map((g) => ({
        ...g,
        products: g.products.map((p) => withStockCheck(p, linesForStockCheck)),
      }));
      setGroups(checkedGroups);
      setDepositLines(linesForStockCheck);

      // Auto-select only items with enough available stock to fully cover
      // the requested quantity — anything short (including zero available,
      // e.g. already claimed by another pending withdrawal) starts
      // unselected so the customer explicitly opts in to a partial/empty
      // withdrawal instead of it happening silently.
      const defaultSelected = new Set(
        checkedGroups.flatMap((g) =>
          g.products.filter((p) => p.matched && p.stockShortfall === 0).map((p) => `${groupKey(g)}|${p.productCode}`),
        ),
      );
      setSelectedKeys(defaultSelected);
      
      setStep('preview');
    } catch (err) {
      setError(err.message ?? 'ไม่สามารถอ่านไฟล์นี้ได้');
    }
  }

  function isGroupFullySelected(group) {
    const eligible = group.products.filter((p) => p.matched);
    if (eligible.length === 0) return false;
    const gKey = groupKey(group);
    return eligible.every((p) => selectedKeys.has(`${gKey}|${p.productCode}`));
  }

  function toggleGroup(group) {
    const eligible = group.products.filter((p) => p.matched);
    if (eligible.length === 0) return;
    
    const fullySelected = isGroupFullySelected(group);
    const gKey = groupKey(group);
    
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (fullySelected) {
        eligible.forEach((p) => next.delete(`${gKey}|${p.productCode}`));
      } else {
        eligible.forEach((p) => next.add(`${gKey}|${p.productCode}`));
      }
      return next;
    });
  }

  function toggleItem(group, product) {
    if (!product.matched) return;
    const key = `${groupKey(group)}|${product.productCode}`;
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllEligible() {
    setSelectedKeys(new Set(
      groups.flatMap((g) => 
        g.products.filter((p) => p.matched).map((p) => `${groupKey(g)}|${p.productCode}`)
      )
    ));
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  async function handleSubmit() {
    // Filter groups to those that have at least one selected product
    const groupsToSubmit = groups.map((group) => ({
      ...group,
      selectedProducts: group.products.filter((p) => selectedKeys.has(`${groupKey(group)}|${p.productCode}`))
    })).filter((group) => group.selectedProducts.length > 0);

    setStep('submitting');
    setError('');
    const createResults = [];

    for (const group of groupsToSubmit) {
      // Left as WITHDRAWAL_DRAFT, not auto-submitted — the file has no
      // pickup contact, vehicle, or delivery-type preference to go on, so
      // the customer reviews/fills those in via the normal edit flow
      // before submitting each request themselves.
      // eslint-disable-next-line no-await-in-loop
      const createResult = await createCustomerWithdrawalRequest({
        requestedDispatchDate: group.date,
        deliveryType: 'DELIVERY',
        pickupContact: group.debtorName,
        destination: group.debtorName,
        note: `นำเข้าจากไฟล์ Sales Order — เลขที่: ${group.soNumbers.join(', ')}`,
        customerId,
      });
      if (createResult.error) {
        createResults.push({ debtorName: group.debtorName, error: createResult.error.message });
        continue;
      }
      const requestId = createResult.data?.id;
      const lineErrors = [];
      for (const product of group.selectedProducts) {
        // Resolve by the catalog's own canonical code, not the raw file
        // text — matchSalesOrderGroupsToCatalog already proved they refer
        // to the same product; comparing the file's as-typed casing against
        // deposit lines here would silently find zero stock for a product
        // that has plenty, just recorded under the canonical code.
        const canonicalCode = product.matchedProductCode ?? product.productCode;
        const mode = product.requestedWeight != null ? 'weight' : 'boxes';
        const requestedQty = mode === 'weight' ? product.requestedWeight : product.requestedBoxes;
        const candidates = depositLines.filter((dl) => dl.customer_product_code === canonicalCode);
        const { allocations, shortfall } = allocateFefoAcrossLots(candidates, Number(requestedQty) || 0, mode);

        const claimNote = product.stockClaimedBy?.length > 0
          ? ` (ถูกจองไว้ในใบเบิกอื่นที่ยังไม่เสร็จสิ้น: ${product.stockClaimedBy.join(', ')})`
          : '';

        if (!allocations.length) {
          lineErrors.push(`${canonicalCode}: ของไม่เพียงพอ (คงเหลือ 0 ${mode === 'weight' ? 'กก.' : 'กล่อง'})${claimNote} — ไม่ได้สร้างรายการนี้`);
          continue;
        }

        for (const alloc of allocations) {
          const dl = alloc.depositLine;
          // eslint-disable-next-line no-await-in-loop
          const lineResult = await upsertCustomerWithdrawalRequestLine(requestId, {
            customerProductCode: canonicalCode,
            productName: product.matchedProductName ?? product.productName,
            requestedBoxes: alloc.boxes,
            requestedWeight: alloc.weight,
            sourceDepositRequestId: dl.deposit_request_id,
            sourceDepositRequestLineId: dl.id,
            sourceLotNo: dl.lot_no,
            trackingCode: dl.tracking_code,
            lotNo: dl.lot_no,
            mfgDate: dl.mfg_date,
            expDate: dl.exp_date,
            pickingRule: 'FEFO',
          });
          if (lineResult.error) lineErrors.push(`${canonicalCode} (LOT ${dl.lot_no ?? '-'}): ${lineResult.error.message}`);
        }

        if (shortfall > 0) {
          lineErrors.push(`${canonicalCode}: สต๊อกไม่พอ ขาดอีก ${shortfall} ${mode === 'weight' ? 'กก.' : 'กล่อง'}${claimNote} — กรุณาตรวจสอบและเพิ่มรายการเองหลังจากนี้`);
        }
      }
      createResults.push({
        debtorName: group.debtorName,
        requestId,
        requestNo: createResult.data?.withdrawal_no ?? createResult.data?.request_no,
        lineErrors,
      });
    }

    setResults(createResults);
    setStep('done');
  }

  function handleFinish() {
    onImported?.();
    handleClose();
  }

  // Count uniquely selected groups (groups that have > 0 selected items)
  const selectedGroupsCount = groups.filter((g) => 
    g.products.some((p) => selectedKeys.has(`${groupKey(g)}|${p.productCode}`))
  ).length;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="lg" title="นำเข้าจากไฟล์ Sales Order">
      {step === 'upload' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--tgd-muted-text)', marginBottom: 12 }}>
            อัปโหลดไฟล์ใบส่งสินค้าจากระบบของท่าน ระบบจะรวมจำนวนสินค้าตามรหัสลูกหนี้ในไฟล์และแยกเป็นกลุ่มลูกค้า
            ท่านสามารถเลือกได้ว่าจะสร้างใบเบิก (ร่าง) สำหรับกลุ่มใดก่อน — ท่านตรวจสอบและกรอกข้อมูลเพิ่มก่อนส่งใบเบิกแต่ละใบเองอีกครั้ง
          </p>
          <input type="file" accept=".xls,.xlsx" onChange={handleFileChange} data-testid="sales-order-import-file-input" />
          {error ? <div className="banner banner-danger" role="alert" style={{ marginTop: 12 }}>{error}</div> : null}
        </div>
      )}

      {step === 'preview' && (
        <div>
          <p style={{ fontSize: 13, marginBottom: 8 }}>
            ไฟล์: <strong>{fileName}</strong> — พบ {groups.length} กลุ่มลูกค้า, เลือกไว้ {selectedGroupsCount} กลุ่ม
          </p>

          <div className="action-row" style={{ marginBottom: 8 }}>
            <button className="btn btn-secondary btn-sm" type="button" onClick={selectAllEligible}>เลือกทั้งหมด</button>
            <button className="btn btn-secondary btn-sm" type="button" onClick={clearSelection}>ยกเลิกทั้งหมด</button>
          </div>

          {groups.map((group) => {
            const key = groupKey(group);
            const hasUnmatched = group.products.some((p) => !p.matched);
            const hasEligible = group.products.some((p) => p.matched);
            
            return (
              <div key={key} className="table-card" style={{ marginBottom: 12 }}>
                <div className="table-card-header">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={isGroupFullySelected(group)}
                      disabled={!hasEligible}
                      onChange={() => toggleGroup(group)}
                    />
                    {group.debtorName} ({group.debtorCode})
                  </label>
                  <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>
                    {group.soNumbers.length} SO
                    {hasUnmatched ? <span style={{ color: '#dc2626', marginLeft: 8 }}>มีรหัสที่ไม่พบในแคตตาล็อก</span> : null}
                  </span>
                </div>
                <div className="table-responsive">
                  <table className="tgd-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40, textAlign: 'center' }}>เลือก</th>
                        <th>รหัสสินค้า</th>
                        <th>ชื่อสินค้า (แคตตาล็อก)</th>
                        <th>จำนวน</th>
                        <th>สถานะ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.products.map((p) => {
                        const itemKey = `${key}|${p.productCode}`;
                        const isSelected = selectedKeys.has(itemKey);
                        const unit = p.stockMode === 'weight' ? 'กก.' : 'กล่อง';
                        const hasShortage = p.matched && p.stockShortfall > 0;
                        return (
                          <tr key={p.productCode} style={!p.matched ? { background: '#fef2f2' } : (hasShortage ? { background: '#fffbeb' } : undefined)}>
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!p.matched}
                                onChange={() => toggleItem(group, p)}
                              />
                            </td>
                            <td>{p.productCode}</td>
                            <td>{p.matchedProductName ?? '-'}</td>
                            <td>{p.requestedBoxes ?? p.requestedWeight ?? p.qty} {p.requestedWeight != null ? 'กก.' : 'กล่อง'}</td>
                            <td style={{ fontWeight: 600 }}>
                              {!p.matched ? (
                                <span style={{ color: '#dc2626' }}>ไม่พบในแคตตาล็อก</span>
                              ) : p.stockShortfall === 0 ? (
                                <span style={{ color: '#16a34a' }}>พร้อมเบิก</span>
                              ) : p.stockAvailableQty === 0 ? (
                                <span style={{ color: '#dc2626' }}>ของไม่เพียงพอ (คงเหลือ 0 {unit})</span>
                              ) : (
                                <span style={{ color: '#b45309' }}>
                                  เบิกได้บางส่วน (มี {p.stockAvailableQty} จาก {p.requestedBoxes ?? p.requestedWeight} {unit})
                                </span>
                              )}
                              {hasShortage && p.stockClaimedBy?.length > 0 && (
                                <div style={{ fontSize: 11, fontWeight: 400, color: 'var(--tgd-muted-text)', marginTop: 2 }}>
                                  ของถูกจองไว้ในใบเบิกอื่นที่ยังไม่เสร็จสิ้น: {p.stockClaimedBy.join(', ')}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}

          <div className="action-row">
            <button className="btn btn-secondary" type="button" onClick={reset}>เลือกไฟล์ใหม่</button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={selectedKeys.size === 0}
              onClick={handleSubmit}
            >
              สร้างใบเบิก {selectedGroupsCount} ใบ
            </button>
          </div>
        </div>
      )}

      {step === 'submitting' && <p>กำลังสร้างใบเบิก...</p>}

      {step === 'done' && (
        <div>
          <div className="alert-success-panel" role="status" style={{ marginBottom: 12 }}>
            สร้างใบเบิกร่าง (draft) แล้ว {results.filter((r) => !r.error).length} จาก {results.length} รายการ —
            กรุณาตรวจสอบและกรอกข้อมูลผู้ติดต่อ/รถขนส่งให้ครบก่อนส่งใบเบิกแต่ละใบ
          </div>
          <ul style={{ paddingLeft: 20 }}>
            {results.map((r) => (
              <li key={r.debtorName}>
                {r.debtorName}: {r.error ? `ล้มเหลว — ${r.error}` : (
                  <>
                    สร้างใบเบิก {r.requestNo ?? ''} สำเร็จ{' '}
                    {r.requestId && (
                      <Link to={`/customer/withdrawal-request/new?editId=${r.requestId}`}>ตรวจสอบและส่ง</Link>
                    )}
                  </>
                )}
                {r.lineErrors?.length > 0 && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: '#dc2626', fontSize: 12 }}>
                    {r.lineErrors.map((msg, i) => <li key={i}>{msg}</li>)}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <div className="action-row">
            <button className="btn btn-primary" type="button" onClick={handleFinish}>ปิด</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
