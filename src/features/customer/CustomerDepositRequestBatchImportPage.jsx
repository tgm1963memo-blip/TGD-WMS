import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { CustomerPortalLiveBanner } from '../../components/customer/CustomerPortalLiveBanner.jsx';
import { CustomerRequestCustomerPicker } from '../../components/customer/CustomerRequestCustomerPicker.jsx';
import { getCustomerRequestStatusClass } from '../../components/customer/customerRequestStatus.js';
import { createCustomerDepositDraftWithLines } from '../../services/customerDepositRequestService.js';
import { listCustomerProducts } from '../../services/customerProductCatalogService.js';
import { getCustomerCode } from '../../services/masterDataService.js';
import { hasRoleFunctionWriteAccess } from '../../security/roleFunctionPermissions.js';
import {
  downloadCustomerDepositBatchTemplate,
  groupDepositBatchRows,
  MAX_ARRIVAL_DATE_DAYS_AHEAD,
  maxArrivalDateIso,
  parseCustomerDepositBatchFile,
} from '../../utils/customerDepositBatchExcelUtils.js';
import { groupTgmPoFilesByShipDate, isTgmCustomerCode, parseTgmPoFile } from '../../utils/tgmPoImportUtils.js';
import { DEPOSIT_TEMPERATURE_LABELS } from '../../utils/customerDepositLineExcelUtils.js';
import { getDepositStatusLabel } from '../../utils/customerDepositStatusLabels.js';
import { useCustomerPortalProfile } from './useCustomerPortalProfile.js';
import { useTranslation } from '../../i18n/languageProvider.jsx';

const INITIAL_SHARED_HEADER = {
  contact_name: '',
  contact_phone: '',
  note: '',
  requires_r3_document: false,
};

function formatSlipDate(iso) {
  const match = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return '-';
  const weekday = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    .toLocaleDateString('th-TH', { weekday: 'short', timeZone: 'UTC' });
  return `${weekday} ${match[3]}/${match[2]}/${match[1]}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

function sumLines(lines, key) {
  return lines.reduce((total, line) => total + (Number(line[key]) || 0), 0);
}

// Opens the catalog's "add product" form pre-filled with what the file says
// about the code. Staff acting for a customer use the admin catalog.
function createProductHref(product, { isRequestProxy, customerId }) {
  const params = new URLSearchParams({ newCode: product.code });
  if (product.productName) params.set('name', product.productName);
  if (Number(product.weightPerBox) > 0) params.set('weight', product.weightPerBox);
  params.set('temp', product.temperatureType);
  if (isRequestProxy) {
    params.set('customerId', customerId);
    return `/admin/customer-products?${params}`;
  }
  return `/customer/product-catalog?${params}`;
}

// One Excel file with a delivery date on every row -> one DRAFT deposit
// request per date. See customerDepositBatchExcelUtils.js.
export function CustomerDepositRequestBatchImportPage() {
  const t = useTranslation();
  const { customerId, canWriteCustomerRequests, isRequestProxy, profile, role } = useCustomerPortalProfile();
  // Customer users can't edit the catalog; their customer admin can.
  const canCreateProduct = isRequestProxy
    ? hasRoleFunctionWriteAccess(role, 'customer_product_catalog_admin')
    : role === 'customer_admin';
  // Same rule as the single-request form: only admin may key a past date.
  const canBackdate = profile?.role === 'admin';
  const [proxyCustomerId, setProxyCustomerId] = useState('');
  const effectiveCustomerId = isRequestProxy ? proxyCustomerId : customerId;
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [fileRows, setFileRows] = useState(null);
  // TGM only: B-Plus PO files ([{ name, rows }]) instead of our template.
  const [poFiles, setPoFiles] = useState(null);
  const [supplierChoices, setSupplierChoices] = useState({});
  const [customerCode, setCustomerCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [sharedHeader, setSharedHeader] = useState(INITIAL_SHARED_HEADER);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState([]);
  const [createFailure, setCreateFailure] = useState('');

  useEffect(() => {
    let active = true;
    setCatalogLoaded(false);
    if (!effectiveCustomerId) {
      setCatalogProducts([]);
      return undefined;
    }
    listCustomerProducts({ customerId: effectiveCustomerId, activeOnly: true }).then((result) => {
      if (!active) return;
      setCatalogProducts(result.data ?? []);
      setCatalogLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [effectiveCustomerId, catalogVersion]);

  // Only used to decide whether to offer TGM's PO upload.
  useEffect(() => {
    let active = true;
    setCustomerCode('');
    if (!effectiveCustomerId) return undefined;
    getCustomerCode(effectiveCustomerId).then((codeResult) => {
      if (active) setCustomerCode(codeResult.data ?? '');
    });
    return () => {
      active = false;
    };
  }, [effectiveCustomerId]);
  const isTgm = isTgmCustomerCode(customerCode);

  useEffect(() => {
    if (!profile) return;
    const name = profile.display_name
      || [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      || profile.email
      || '';
    if (name) setSharedHeader((h) => (h.contact_name ? h : { ...h, contact_name: name }));
  }, [profile]);

  // Recomputed from the raw rows so picking another customer (proxy) or the
  // catalog finishing loading re-checks the same file. Until the catalog is
  // in, every code would look unknown, so wait for it.
  const result = useMemo(() => {
    if (!catalogLoaded || (!fileRows && !poFiles)) return null;
    const bounds = {
      minDate: canBackdate ? '' : new Date().toISOString().split('T')[0],
      maxDate: maxArrivalDateIso(),
    };
    return poFiles
      ? groupTgmPoFilesByShipDate(poFiles, catalogProducts, { ...bounds, maxDaysAhead: MAX_ARRIVAL_DATE_DAYS_AHEAD, supplierChoices })
      : groupDepositBatchRows(fileRows, catalogProducts, bounds);
  }, [fileRows, poFiles, supplierChoices, catalogLoaded, catalogProducts, canBackdate]);

  const slips = result?.slips ?? [];
  const skipped = result?.skipped ?? [];
  const missingProducts = result?.missingProducts ?? [];
  const supplierPicks = result?.supplierPicksNeeded ?? [];
  // A B-Plus supplier code shared by several plants would put the wrong sup
  // code (or none) in every lot, so the plant must be picked first.
  const pickPending = supplierPicks.some((pick) => !pick.chosen);
  const hasFile = Boolean(fileRows || poFiles);
  const lineCount = slips.reduce((total, slip) => total + slip.lines.length, 0);
  const allLines = slips.flatMap((slip) => slip.lines);
  const missingCustomer = isRequestProxy && !proxyCustomerId;
  const missingContact = !sharedHeader.contact_name.trim() || !sharedHeader.contact_phone.trim();

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setReading(true);
    setError('');
    setCreated([]);
    setCreateFailure('');
    try {
      const { rows, errors } = await parseCustomerDepositBatchFile(file);
      if (errors.length) {
        setError(errors.join(' '));
        setFileRows(null);
        return;
      }
      setFileName(file.name);
      setPoFiles(null);
      setFileRows(rows);
    } catch (err) {
      setError(err?.message ?? t('excel_import_error'));
    } finally {
      setReading(false);
    }
  }

  async function handlePoFiles(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;
    setReading(true);
    setError('');
    setCreated([]);
    setCreateFailure('');
    try {
      const parsed = [];
      for (const file of files) {
        const { rows, errors } = await parseTgmPoFile(file);
        if (errors.length) {
          setError(`${file.name}: ${errors.join(' ')}`);
          return;
        }
        parsed.push({ name: file.name, rows });
      }
      setFileName(files.map((file) => file.name).join(', '));
      setFileRows(null);
      setSupplierChoices({});
      setPoFiles(parsed);
    } catch (err) {
      setError(err?.message ?? 'อ่านไฟล์ PO ไม่สำเร็จ');
    } finally {
      setReading(false);
    }
  }

  function clearFile() {
    setFileRows(null);
    setPoFiles(null);
  }

  function updateShared(field, value) {
    setSharedHeader((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleCreate() {
    if (missingCustomer) {
      setError(t('customer_request_proxy_customer_required'));
      return;
    }
    if (missingContact) {
      setError('กรุณากรอกชื่อผู้ติดต่อและเบอร์โทรผู้ติดต่อ');
      return;
    }
    setCreating(true);
    setError('');
    setCreateFailure('');
    const done = [];
    for (const slip of slips) {
      // One request at a time, so a failure stops the rest.
      const { data, error: createError } = await createCustomerDepositDraftWithLines({
        header: {
          expectedArrivalDate: slip.date,
          contactName: sharedHeader.contact_name,
          contactPhone: sharedHeader.contact_phone,
          note: sharedHeader.note,
          vehicleRegistration: slip.vehicleRegistration,
          arrivalTime: slip.arrivalTime,
          requiresR3Document: sharedHeader.requires_r3_document,
        },
        lines: slip.lines,
        customerId: isRequestProxy ? proxyCustomerId : null,
      });
      if (data) done.push({ id: data.id, requestNo: data.request_no, date: slip.date, lineCount: slip.lines.length });
      if (createError) {
        const notCreated = slips.slice(slips.indexOf(slip) + (data ? 1 : 0)).map((s) => formatSlipDate(s.date));
        setCreateFailure(
          `สร้างใบวันที่ ${formatSlipDate(slip.date)} ไม่สำเร็จ: ${createError.message ?? t('customer_portal_load_error')}`
          + (data ? ' (ใบนี้ถูกสร้างเป็นร่างแล้วแต่รายการไม่ครบ กรุณาเปิดแก้)' : '')
          + (notCreated.length ? ` · ยังไม่ได้สร้าง: ${notCreated.join(', ')}` : ''),
        );
        break;
      }
    }
    setCreated(done);
    setCreating(false);
    if (done.length) clearFile();
  }

  return (
    <section className="page-shell customer-portal-page" data-testid="customer-deposit-batch-import-page">
      <PageHeader
        title={t('customer_deposit_batch_import_title')}
        description={t('customer_deposit_batch_import_description')}
        actions={(
          <Link className="btn btn-secondary" to="/customer/deposit-request">{t('customer_deposit_back_to_list')}</Link>
        )}
      />
      <CustomerPortalLiveBanner />

      {!canWriteCustomerRequests ? (
        <div className="banner banner-warning" role="status">{t('customer_portal_no_customer_scope')}</div>
      ) : null}
      {error ? <div className="banner banner-danger" role="alert">{error}</div> : null}
      {createFailure ? <div className="banner banner-danger" role="alert">{createFailure}</div> : null}

      {created.length ? (
        <div className="form-card deposit-batch-result" data-testid="customer-deposit-batch-result">
          <div className="banner banner-success" role="status" style={{ margin: 0 }}>
            สร้างร่างใบแจ้งฝากแล้ว {created.length} ใบ ({created.reduce((n, c) => n + c.lineCount, 0)} รายการ) เปิดตรวจแล้วกดส่งทีละใบ
          </div>
          {created.map((item) => (
            <div className="deposit-batch-result-item" key={item.id}>
              <span><b>{item.requestNo}</b> · {formatSlipDate(item.date)} · {item.lineCount} รายการ</span>
              <span className="action-row">
                <span className={`status-badge status-badge--${getCustomerRequestStatusClass('DRAFT')}`}>{getDepositStatusLabel('DRAFT', t)}</span>
                <Link className="btn btn-secondary btn-sm" to={`/customer/deposit-request/new?editId=${item.id}`}>เปิดแก้ร่าง</Link>
              </span>
            </div>
          ))}
          <div className="action-row" style={{ justifyContent: 'flex-end' }}>
            <Link className="btn btn-primary" to="/customer/deposit-request">ไปหน้ารายการใบแจ้งฝาก</Link>
          </div>
        </div>
      ) : null}

      <div className="form-card customer-portal-form">
        {isRequestProxy ? (
          <CustomerRequestCustomerPicker
            onChange={setProxyCustomerId}
            testId="customer-deposit-batch-proxy-customer-select"
            value={proxyCustomerId}
          />
        ) : null}

        <div className="deposit-batch-upload">
          <div>
            <b>1) ดาวน์โหลดเทมเพลต</b> มีสินค้าในแคตตาล็อกให้แล้ว กรอกวันที่จัดส่งกับจำนวนในแถวที่จะฝาก
            <p className="form-helper" style={{ margin: '4px 0 0' }}>แถวที่วันที่จัดส่งเดียวกันจะรวมเป็น 1 ใบ สินค้าที่เข้าหลายวันให้คัดลอกแถว</p>
          </div>
          <div className="action-row">
            <button
              className="btn btn-secondary"
              data-testid="customer-deposit-batch-template-button"
              disabled={missingCustomer}
              onClick={() => downloadCustomerDepositBatchTemplate(catalogProducts)}
              type="button"
            >
              ดาวน์โหลดเทมเพลต
            </button>
            {isTgm ? (
              <label className={`btn btn-secondary csv-import-button${!canWriteCustomerRequests || reading || creating ? ' is-disabled' : ''}`}>
                อัปโหลด PO (TGM)
                <input
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  data-testid="customer-deposit-batch-tgm-po-input"
                  disabled={!canWriteCustomerRequests || reading || creating}
                  hidden
                  multiple
                  onChange={handlePoFiles}
                  type="file"
                />
              </label>
            ) : null}
            <label className={`btn btn-primary csv-import-button${!canWriteCustomerRequests || missingCustomer || reading || creating ? ' is-disabled' : ''}`}>
              {reading ? 'กำลังอ่านไฟล์…' : '2) อัปโหลด Excel'}
              <input
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                data-testid="customer-deposit-batch-import-input"
                disabled={!canWriteCustomerRequests || missingCustomer || reading || creating}
                hidden
                onChange={handleFile}
                type="file"
              />
            </label>
          </div>
        </div>
        {missingCustomer ? <p className="form-helper">เลือกลูกค้าก่อน เพื่อใช้แคตตาล็อกสินค้าของลูกค้ารายนั้น</p> : null}
        {isTgm ? (
          <p className="form-helper">TGM: เลือกไฟล์ PO จาก B-Plus ได้หลายไฟล์พร้อมกัน ระบบแยกใบตามวันที่ส่ง (TRH_SHIP_DATE) และตั้ง Lot = Lot วันในปี + Sup ของผู้ขาย</p>
        ) : null}
        {hasFile && !catalogLoaded && !missingCustomer ? <p className="form-helper">กำลังโหลดแคตตาล็อกสินค้า…</p> : null}

        {result ? (
          <>
            <div className="deposit-batch-summary" data-testid="customer-deposit-batch-summary">
              <span>ไฟล์ <b>{fileName}</b></span>
              <span>ใบที่จะสร้าง <b>{slips.length} ใบ</b></span>
              <span>รายการ <b>{lineCount}</b></span>
              <span>รวม <b>{formatNumber(sumLines(allLines, 'expected_boxes'))} กล่อง · {formatNumber(sumLines(allLines, 'expected_weight'))} กก.</b></span>
              <span>ข้าม <b>{skipped.length} แถว</b></span>
              {missingProducts.length ? <span>สินค้าใหม่ <b>{missingProducts.length} รหัส</b></span> : null}
            </div>

            {supplierPicks.map((pick) => (
              <label className="form-field" key={pick.apCode} style={{ maxWidth: 420 }}>
                <span>ผู้ขาย {pick.apCode} มีหลายโรงงาน — เลือกโรงงานของ PO นี้ <span className="field-required">*</span></span>
                <select
                  className="form-control"
                  data-testid="customer-deposit-batch-supplier-pick"
                  onChange={(event) => setSupplierChoices((current) => ({ ...current, [pick.apCode]: event.target.value }))}
                  value={pick.chosen}
                >
                  <option value="">— เลือกโรงงาน —</option>
                  {pick.options.map((option) => (
                    <option key={option.code} value={option.code}>{option.label} (Sup {option.code})</option>
                  ))}
                </select>
              </label>
            ))}

            {missingProducts.length ? (
              <article className="deposit-batch-slip" data-testid="customer-deposit-batch-missing-products">
                <div className="deposit-batch-slip-head">
                  <b>รหัสสินค้าที่ยังไม่มีในแคตตาล็อก</b>
                  <span>
                    {canCreateProduct
                      ? 'สร้างสินค้าก่อน (เปิดแท็บใหม่) แล้วกด "โหลดแคตตาล็อกใหม่" แถวเหล่านี้จะเข้าใบให้เอง'
                      : 'แจ้งผู้ดูแลบัญชีของบริษัทให้เพิ่มสินค้าในแคตตาล็อกก่อน แล้วกด "โหลดแคตตาล็อกใหม่"'}
                  </span>
                  <button
                    className="btn btn-secondary btn-sm"
                    data-testid="customer-deposit-batch-reload-catalog"
                    onClick={() => setCatalogVersion((v) => v + 1)}
                    type="button"
                  >
                    โหลดแคตตาล็อกใหม่
                  </button>
                </div>
                {missingProducts.map((product) => (
                  <div className="deposit-batch-result-item" key={product.code}>
                    <span>
                      <b>{product.code}</b>
                      {product.productName ? ` · ${product.productName}` : ''}
                      {/* PO uploads of several files label rows "<file> แถว N" already. */}
                      {typeof product.rows[0] === 'number' ? ` · แถว ${product.rows.join(', ')}` : ` · ${product.rows.join(', ')}`}
                    </span>
                    {canCreateProduct ? (
                      <a
                        className="btn btn-primary btn-sm"
                        data-testid="customer-deposit-batch-create-product"
                        href={createProductHref(product, { isRequestProxy, customerId: effectiveCustomerId })}
                        rel="noreferrer"
                        target="_blank"
                      >
                        สร้างสินค้า
                      </a>
                    ) : null}
                  </div>
                ))}
              </article>
            ) : null}

            {!slips.length ? (
              <div className="banner banner-warning" role="status">ไม่พบรายการที่สร้างใบได้ ตรวจวันที่จัดส่งและจำนวนในไฟล์ แล้วอัปโหลดใหม่</div>
            ) : null}

            {slips.map((slip) => (
              <article className="deposit-batch-slip" data-testid="customer-deposit-batch-slip" key={slip.date}>
                <div className="deposit-batch-slip-head">
                  <b>{formatSlipDate(slip.date)}</b>
                  <span>{slip.arrivalTime ? `เวลาถึง ${slip.arrivalTime}` : 'ไม่ระบุเวลา'}</span>
                  <span>{slip.vehicleRegistration ? `ทะเบียน ${slip.vehicleRegistration}` : 'ไม่ระบุทะเบียน'}</span>
                  <span>
                    {slip.lines.length} รายการ · {formatNumber(sumLines(slip.lines, 'expected_boxes'))} กล่อง · {formatNumber(sumLines(slip.lines, 'expected_weight'))} กก.
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>รหัสสินค้า</th>
                        <th>ชื่อสินค้า</th>
                        <th style={{ textAlign: 'right' }}>กก./กล่อง</th>
                        <th style={{ textAlign: 'right' }}>กล่อง</th>
                        <th style={{ textAlign: 'right' }}>น้ำหนัก (กก.)</th>
                        <th>LOT</th>
                        <th>การจัดเก็บ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {slip.lines.map((line) => (
                        <tr key={line.key}>
                          <td>{line.customer_product_code}</td>
                          <td>{line.product_name || '-'}</td>
                          <td style={{ textAlign: 'right' }}>{line.weight_per_box}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(line.expected_boxes)}</td>
                          <td style={{ textAlign: 'right' }}>{formatNumber(line.expected_weight)}</td>
                          <td>{line.lot_no || '-'}</td>
                          <td>{DEPOSIT_TEMPERATURE_LABELS[line.temperature_type] ?? line.temperature_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {slip.warnings.map((warning) => (
                  <p className="deposit-batch-note deposit-batch-note--warn" key={warning}>{warning}</p>
                ))}
              </article>
            ))}

            {skipped.length ? (
              <article className="deposit-batch-slip" data-testid="customer-deposit-batch-skipped">
                <div className="deposit-batch-slip-head"><b>แถวที่ข้าม</b><span>ไม่ถูกสร้างเป็นใบ</span></div>
                {skipped.map((message) => (
                  <p className="deposit-batch-note deposit-batch-note--skip" key={message}>{message}</p>
                ))}
              </article>
            ) : null}

            <div className="form-grid">
              <label className="form-field">
                <span>{t('customer_field_contact_name')} <span className="field-required">*</span></span>
                <input className="form-control" data-testid="customer-deposit-batch-contact-name" onChange={(e) => updateShared('contact_name', e.target.value)} required value={sharedHeader.contact_name} />
              </label>
              <label className="form-field">
                <span>{t('customer_field_contact_phone')} <span className="field-required">*</span></span>
                <input className="form-control" data-testid="customer-deposit-batch-contact-phone" onChange={(e) => updateShared('contact_phone', e.target.value)} required value={sharedHeader.contact_phone} />
              </label>
              <label className="form-field form-field-span-2">
                <span>{t('customer_field_note')} (ใช้กับทุกใบ)</span>
                <textarea className="form-control" onChange={(e) => updateShared('note', e.target.value)} rows={2} value={sharedHeader.note} />
              </label>
              <label className="form-field-span-2 form-checkbox-field">
                <input
                  checked={sharedHeader.requires_r3_document}
                  data-testid="customer-deposit-batch-r3-document"
                  onChange={(e) => updateShared('requires_r3_document', e.target.checked)}
                  type="checkbox"
                />
                <span className="form-checkbox-text">
                  <span className="form-checkbox-title">{t('customer_field_r3_document')}</span>
                  <span className="form-helper">ติ๊กแล้วใช้กับทุกใบที่สร้างครั้งนี้ แก้ทีละใบได้ภายหลัง</span>
                </span>
              </label>
            </div>

            <div className="action-row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span className="form-helper">ใบที่สร้างจะเป็น <b>ร่าง</b> ทั้งหมด เปิดตรวจแล้วกดส่งทีละใบ</span>
              <div className="action-row">
                <button className="btn btn-secondary" disabled={creating} onClick={clearFile} type="button">ยกเลิก</button>
                <button
                  className="btn btn-primary"
                  data-testid="customer-deposit-batch-create-button"
                  disabled={!slips.length || creating || !canWriteCustomerRequests || pickPending}
                  onClick={handleCreate}
                  type="button"
                >
                  {creating ? 'กำลังสร้าง…' : pickPending ? 'เลือกโรงงานของผู้ขายก่อน' : `สร้างร่าง ${slips.length} ใบ`}
                </button>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
