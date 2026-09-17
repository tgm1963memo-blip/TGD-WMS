import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { useUserRole } from '../auth/UserRoleProvider.jsx';
import { getActiveLocations } from '../../services/warehouseLayoutService.js';
import {
  canManageInventoryLocation, getInventoryLocationEditor, getInventoryLocationSlots,
  moveInventoryPallet, addInventoryPallet,
} from '../../services/inventoryLocationService.js';
import { buildPalletCode } from '../../utils/locationCodeUtils.js';
import { formatFixed2 } from '../../utils/numberFormat.js';

export function InventoryLocationModal({ line, onClose, onSaved }) {
  const { role } = useUserRole();
  const allowed = canManageInventoryLocation(role);
  const [editor, setEditor] = useState(null);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('');
  const [selected, setSelected] = useState(null);
  const [locationId, setLocationId] = useState('');
  const [palletNo, setPalletNo] = useState('');
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [boxes, setBoxes] = useState('');
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getInventoryLocationEditor(line.id), getActiveLocations()]).then(([result, locationResult]) => {
      if (!active) return;
      const failure = result.error ?? locationResult.error;
      setError(failure?.message ?? '');
      setEditor(failure ? null : result.data);
      setLocations(locationResult.data ?? []);
      setLoading(false);
    }).catch(err => { if (active) { setError(err.message); setLoading(false); } });
    return () => { active = false; };
  }, [line.id, revision]);

  useEffect(() => {
    let active = true;
    setPalletNo('');
    setSlots([]);
    setSlotsError('');
    if (!locationId) { setSlotsLoading(false); return undefined; }
    setSlotsLoading(true);
    getInventoryLocationSlots(locationId).then(({ data, error: failure }) => {
      if (!active) return;
      setSlots(data ?? []);
      setSlotsError(failure?.message ?? '');
      setSlotsLoading(false);
    });
    return () => { active = false; };
  }, [locationId, mode, selected?.id, revision]);

  const destination = locations.find(location => location.id === locationId);
  const occupied = new Set(slots.map(row => row.palletNo));
  const available = Array.from({ length: destination?.capacity ?? 0 }, (_, index) => index + 1)
    .filter(number => !occupied.has(number));
  const canAdd = editor && (editor.unallocatedBoxes == null
    ? (editor.unallocatedWeight ?? 0) > 0 : editor.unallocatedBoxes > 0);

  function begin(modeValue, allocation = null) {
    setMode(modeValue);
    setSelected(allocation);
    setLocationId('');
    setPalletNo('');
    setError('');
    setNotice('');
    setBoxes(editor.unallocatedBoxes == null ? '' : String(editor.unallocatedBoxes));
    setWeight(editor.unallocatedWeight == null ? '' : String(editor.unallocatedWeight));
  }

  async function save(event) {
    event.preventDefault();
    if (!allowed || saving || !locationId || !available.includes(Number(palletNo)) || slotsLoading || slotsError) return;
    const parsedBoxes = boxes === '' ? null : Number(boxes);
    const parsedWeight = weight === '' ? null : Number(weight);
    if (mode === 'add' && (
      (editor.unallocatedBoxes != null && (parsedBoxes == null || parsedBoxes <= 0 || parsedBoxes > editor.unallocatedBoxes)) ||
      (editor.unallocatedWeight != null && (parsedWeight == null || parsedWeight < 0 || parsedWeight > editor.unallocatedWeight)) ||
      (parsedBoxes != null && (!Number.isFinite(parsedBoxes) || parsedBoxes < 0)) ||
      (parsedWeight != null && (!Number.isFinite(parsedWeight) || parsedWeight < 0)) ||
      (!(parsedBoxes > 0) && !(parsedWeight > 0))
    )) { setError('กรุณาระบุกล่องและน้ำหนักไม่เกินยอดที่ยังไม่ได้จัดเก็บ'); return; }
    setSaving(true);
    setError('');
    try {
      const result = mode === 'move'
        ? await moveInventoryPallet(selected, locationId, palletNo)
        : await addInventoryPallet(line.id, locationId, palletNo, parsedBoxes, parsedWeight);
      if (result.error) { setError(result.error.message); return; }
      setMode('');
      setLocationId('');
      setNotice('บันทึก Location สำเร็จ');
      setRevision(value => value + 1);
      await onSaved();
    } catch (err) { setError(err.message ?? 'บันทึกไม่สำเร็จ'); }
    finally { setSaving(false); }
  }

  return (
    <Modal isOpen title="จัดการ Location" onClose={() => { if (!saving) onClose(); }} size="lg">
      <div style={{ padding: 16 }}>
        <p><strong>{line.tracking_code ?? '-'}</strong> · {line.customer_product_code} · {line.product_name}</p>
        {loading && <p role="status">กำลังโหลด Location...</p>}
        {error && <div className="banner banner-danger" role="alert">{error}</div>}
        {notice && <div className="banner banner-success" role="status">{notice}</div>}
        {!loading && !editor && <button className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>ลองโหลดใหม่</button>}
        {editor && !loading && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead><tr><th>Location / พาเลท</th><th>กล่องที่ยังไม่หยิบ</th><th>น้ำหนักที่ยังไม่หยิบ (กก.)</th><th>จัดการ</th></tr></thead>
                <tbody>
                  {editor.allocations.filter(row => row.active).map(row => (
                    <tr key={row.id}>
                      <td>{row.palletCode}</td><td>{row.remainingBoxes ?? '-'}</td><td>{row.remainingWeight == null ? '-' : formatFixed2(row.remainingWeight)}</td>
                      <td>{allowed && <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => begin('move', row)}>ย้ายพาเลท</button>}</td>
                    </tr>
                  ))}
                  {!editor.allocations.some(row => row.active) && <tr><td colSpan={4}>ยังไม่กำหนด Location หรือพาเลทเดิมถูกหยิบหมดแล้ว</td></tr>}
                </tbody>
              </table>
            </div>
            <p>ยอดที่ยังไม่ได้จัดเก็บ: {editor.unallocatedBoxes ?? '-'} กล่อง · {editor.unallocatedWeight == null ? '-' : formatFixed2(editor.unallocatedWeight)} กก.</p>
            <p style={{ color: 'var(--tgd-muted-text)', fontSize: 12 }}>คำนวณจากยอดรับจริงลบรายการจัดเก็บทั้งหมด ส่วนยอดบนพาเลทหักเฉพาะการหยิบแล้ว จึงอาจต่างจากยอดพร้อมเบิกในตาราง</p>
            {allowed && canAdd && <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => begin('add')}>เพิ่ม Location</button>}
            {allowed && mode && (
              <form onSubmit={save} style={{ marginTop: 16 }}>
                <h3>{mode === 'move' ? `ย้ายจาก ${selected.palletCode}` : 'เพิ่มการจัดเก็บ'}</h3>
                <fieldset disabled={saving} style={{ border: 0, padding: 0, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <label className="form-field">Location ปลายทาง
                    <select aria-label="Location ปลายทาง" className="form-control" value={locationId} onChange={event => setLocationId(event.target.value)} required>
                      <option value="">เลือก Location</option>
                      {locations.map(location => <option key={location.id} value={location.id}>{location.code}</option>)}
                    </select>
                  </label>
                  <label className="form-field">ช่องพาเลทปลายทาง
                    <select aria-label="ช่องพาเลทปลายทาง" className="form-control" value={palletNo} onChange={event => setPalletNo(event.target.value)} disabled={!locationId || slotsLoading || !!slotsError} required>
                      <option value="">{slotsLoading ? 'กำลังตรวจช่องว่าง...' : 'เลือกช่องพาเลท'}</option>
                      {available.map(number => <option key={number} value={number}>{number}</option>)}
                    </select>
                  </label>
                  {mode === 'add' && <>
                    <label className="form-field">กล่องที่จัดเก็บ<input className="form-control" type="number" min="0" step="any" max={editor.unallocatedBoxes ?? undefined} value={boxes} onChange={event => setBoxes(event.target.value)} required={editor.unallocatedBoxes != null} /></label>
                    <label className="form-field">น้ำหนักที่จัดเก็บ (กก.)<input className="form-control" type="number" min="0" step="any" max={editor.unallocatedWeight ?? undefined} value={weight} onChange={event => setWeight(event.target.value)} required={editor.unallocatedWeight != null} /></label>
                  </>}
                </fieldset>
                {slotsError && <p role="alert">โหลดช่องพาเลทไม่สำเร็จ: {slotsError} <button type="button" onClick={() => setRevision(value => value + 1)}>ลองใหม่</button></p>}
                {locationId && !slotsLoading && !slotsError && !available.length && <p>Location นี้ไม่มีช่องพาเลทว่างในความจุที่กำหนด</p>}
                {destination && palletNo && <p>{mode === 'move' ? `${selected.palletCode} → ` : 'จัดเก็บที่ '}{buildPalletCode(destination.code, palletNo)}</p>}
                <div className="action-row">
                  <button type="submit" className="btn btn-primary" disabled={saving || !palletNo || slotsLoading || !!slotsError}>{saving ? 'กำลังบันทึก...' : 'บันทึก Location'}</button>
                  <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setMode('')}>ยกเลิก</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
