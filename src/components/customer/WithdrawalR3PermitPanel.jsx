import { AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { R3CarcassTypeSelect } from './R3CarcassTypeSelect.jsx';
import { R3_STATUS, compareR3Permit } from '../../utils/r3PermitComparisonUtils.js';

function fmtKg(v) {
  if (v == null) return '-';
  return Number(v).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_LABEL = {
  [R3_STATUS.OK]: 'ไม่เกินยอด',
  [R3_STATUS.OVER]: 'เกินยอด ร.3',
  [R3_STATUS.NOT_ON_PERMIT]: 'ไม่มีใน ร.3',
  [R3_STATUS.UNCATEGORIZED]: 'สินค้ายังไม่ระบุประเภท ร.3',
};

export function emptyR3PermitItem() {
  return { r3_no: '', r3_carcass_type_code: null, permitted_kg: '' };
}

// Permitted kg per carcass type (as written on the ร.3) vs the withdrawal's
// net weight per type. Warn-only: nothing here blocks submit or dispatch.
// Pass onItemsChange to make the permit rows editable; omit for read-only.
export function WithdrawalR3PermitPanel({
  items = [],
  onItemsChange,
  lines = [],
  carcassTypes = [],
  catalogR3Map = null,
  usePicked = false,
  saving = false,
  onSave,
  dirty = false,
}) {
  const editable = typeof onItemsChange === 'function';
  const comparison = compareR3Permit({ lines, permitItems: items, carcassTypes, catalogR3Map, usePicked });

  function updateItem(index, field, value) {
    onItemsChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  return (
    <div className="customer-attachment-panel" data-testid="withdrawal-r3-permit-panel" style={{ display: 'grid', gap: 12 }}>
      <div>
        <strong style={{ fontSize: 14 }}>ยอดตามใบ ร.3</strong>
        <p className="form-helper" style={{ margin: '2px 0 0' }}>
          กรอกน้ำหนักที่ ร.3 อนุญาตแยกตามประเภทซาก ระบบจะเทียบกับน้ำหนักเบิก
          {usePicked ? ' (ใช้น้ำหนักที่หยิบจริงถ้ามี)' : ''} ตามประเภท ร.3 ที่ตั้งไว้ในแคตตาล็อกสินค้า
        </p>
      </div>

      {editable || items.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>เลขที่ ร.3</th>
                <th style={{ minWidth: 200 }}>ประเภทซาก</th>
                <th style={{ minWidth: 110, textAlign: 'right' }}>อนุญาต (กก.)</th>
                {editable && <th style={{ width: 44 }} />}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 4 : 3} style={{ textAlign: 'center', color: 'var(--tgd-muted-text)' }}>
                    ยังไม่ได้กรอกยอด ร.3
                  </td>
                </tr>
              ) : items.map((item, index) => (
                // eslint-disable-next-line react/no-array-index-key
                <tr key={index}>
                  <td>
                    {editable ? (
                      <input
                        className="form-control"
                        value={item.r3_no ?? ''}
                        onChange={(e) => updateItem(index, 'r3_no', e.target.value)}
                        placeholder="เช่น 03692020400001771"
                        data-testid="withdrawal-r3-permit-no"
                      />
                    ) : (item.r3_no || '-')}
                  </td>
                  <td>
                    {editable ? (
                      <R3CarcassTypeSelect
                        carcassTypes={carcassTypes}
                        value={item.r3_carcass_type_code}
                        onChange={(code) => updateItem(index, 'r3_carcass_type_code', code)}
                        placeholder="— เลือกประเภท —"
                        data-testid="withdrawal-r3-permit-type"
                      />
                    ) : (carcassTypes.find((t) => t.code === item.r3_carcass_type_code)?.label_th ?? item.r3_carcass_type_code)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {editable ? (
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        step="0.01"
                        style={{ textAlign: 'right' }}
                        value={item.permitted_kg ?? ''}
                        onChange={(e) => updateItem(index, 'permitted_kg', e.target.value)}
                        data-testid="withdrawal-r3-permit-kg"
                      />
                    ) : fmtKg(item.permitted_kg)}
                  </td>
                  {editable && (
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label="ลบแถว"
                        onClick={() => onItemsChange(items.filter((_, i) => i !== index))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="form-helper" style={{ margin: 0 }}>ยังไม่ได้กรอกยอด ร.3</p>
      )}

      {editable && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onItemsChange([...items, { ...emptyR3PermitItem(), r3_no: items.at(-1)?.r3_no ?? '' }])}
            data-testid="withdrawal-r3-permit-add"
          >
            <Plus size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />
            เพิ่มประเภท
          </button>
          {onSave && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onSave}
              disabled={saving || !dirty}
              data-testid="withdrawal-r3-permit-save"
            >
              {saving ? 'กำลังบันทึก...' : 'บันทึกยอด ร.3'}
            </button>
          )}
        </div>
      )}

      {comparison.rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: 12 }} data-testid="withdrawal-r3-comparison">
            <thead>
              <tr>
                <th>ประเภทซาก</th>
                <th>สินค้า</th>
                <th style={{ textAlign: 'right' }}>อนุญาต (กก.)</th>
                <th style={{ textAlign: 'right' }}>เบิก (กก.)</th>
                <th style={{ textAlign: 'right' }}>คงเหลือตาม ร.3</th>
                <th>ผล</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => {
                const ok = row.status === R3_STATUS.OK;
                const color = ok ? 'var(--color-success)' : 'var(--tgd-danger)';
                return (
                  <tr key={row.code ?? '__uncategorized__'} data-status={row.status}>
                    <td style={{ fontWeight: 600 }}>
                      {row.code ? `${row.animalType ?? ''}${row.animalType ? ' / ' : ''}${row.label}` : '-'}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--tgd-muted-text)' }}>{row.productCodes.join(', ') || '-'}</td>
                    <td style={{ textAlign: 'right' }}>{fmtKg(row.permittedKg)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmtKg(row.actualKg)}</td>
                    <td style={{ textAlign: 'right', color: row.diffKg != null && row.diffKg < 0 ? 'var(--tgd-danger)' : undefined }}>
                      {fmtKg(row.diffKg)}
                    </td>
                    <td style={{ color, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {ok
                        ? <CheckCircle2 size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />
                        : <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />}
                      {STATUS_LABEL[row.status]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {comparison.hasIssue && (
        <div className="banner banner-warning" role="status" data-testid="withdrawal-r3-warning">
          {comparison.hasOver && <div>มีประเภทที่น้ำหนักเบิกเกินยอดที่ ร.3 อนุญาต</div>}
          {comparison.hasNotOnPermit && <div>มีสินค้าประเภทที่ไม่ได้ระบุไว้ในใบ ร.3</div>}
          {comparison.hasUncategorized && (
            <div>มีสินค้าที่ยังไม่ได้ตั้งประเภท ร.3 ในแคตตาล็อก — ตั้งค่าที่หน้าแคตตาล็อกสินค้าเพื่อให้เทียบยอดได้</div>
          )}
        </div>
      )}
    </div>
  );
}
