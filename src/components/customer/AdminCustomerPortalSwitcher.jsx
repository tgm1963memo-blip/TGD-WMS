import { useEffect, useState } from 'react';
import { getCustomers } from '../../services/masterDataService.js';
import { getAdminPortalCustomerId, setAdminPortalCustomerId } from '../../features/customer/useCustomerPortalProfile.js';

export function AdminCustomerPortalSwitcher() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(getAdminPortalCustomerId() || '');

  useEffect(() => {
    let active = true;
    getCustomers({ isActive: true }).then((res) => {
      if (!active) return;
      setCustomers(res.data ?? []);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => setSelectedId(getAdminPortalCustomerId() || '');
    window.addEventListener('adminPortalCustomerChanged', handleStorageChange);
    return () => window.removeEventListener('adminPortalCustomerChanged', handleStorageChange);
  }, []);

  function handleChange(e) {
    const newId = e.target.value;
    setAdminPortalCustomerId(newId);
    setSelectedId(newId);
  }

  if (loading) {
    return <span style={{ fontSize: 12, color: 'var(--tgd-muted-text)' }}>Loading customers...</span>;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '4px 8px', borderRadius: 8, border: '1px solid var(--tgd-border)' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tgd-text-sec)', whiteSpace: 'nowrap' }}>[Admin View] ลูกค้า:</span>
      <select
        value={selectedId}
        onChange={handleChange}
        style={{
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--tgd-text)',
          cursor: 'pointer',
          maxWidth: 200,
        }}
      >
        <option value="">-- ไม่ระบุ (ดูทั้งหมด/ผิดพลาด) --</option>
        {customers.map((c) => (
          <option key={c.id} value={c.id}>
            {c.customer_name}
          </option>
        ))}
      </select>
    </div>
  );
}
