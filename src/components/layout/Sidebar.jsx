import React from 'react';
import { NavLink } from 'react-router-dom';
import { getTranslation } from '../../i18n/translationCatalog.js';
import { useLanguage } from '../../i18n/languageProvider.jsx';
import { brandConfig } from '../../config/brandConfig.js';

const navSections = [
  {
    key: 'dashboard',
    fallback: 'หน้าหลัก / Dashboard',
    items: [{ key: 'dashboard', fallback: 'หน้าหลัก', path: '/dashboard' }],
  },
  {
    key: 'warehouse_operations',
    fallback: 'งานคลังสินค้า / Warehouse',
    items: [
      { key: 'master_data', fallback: 'ข้อมูลหลัก', path: '/master/customers' },
      { key: 'receiving', fallback: 'รับสินค้าเข้า', path: '/operations/receiving' },
      { key: 'putaway', fallback: 'นำสินค้าเข้าที่จัดเก็บ', path: '/operations/putaway' },
      { key: 'transfer', fallback: 'โอนย้ายภายในคลัง', path: '/operations/transfer' },
      { key: 'adjustment', fallback: 'ปรับปรุงสินค้าคงคลัง', path: '/operations/adjustment' },
      { key: 'stock_count', fallback: 'ตรวจนับสินค้า', path: '/stock-count' },
      { key: 'customer_withdrawal', fallback: 'เบิกสินค้าโดยลูกค้า', path: '/operations/withdrawal-requests' },
      { key: 'allocation', fallback: 'จัดสรรสินค้า', path: '/operations/allocations' },
      { key: 'picking', fallback: 'หยิบสินค้า', path: '/operations/picking' },
      { key: 'dispatch_goods_issue', fallback: 'จ่ายสินค้าออก', path: '/operations/dispatch' },
      { key: 'outbound_documents', fallback: 'รายการจ่ายสินค้าออก', path: '/operations/outbound' },
      { key: 'outbound_draft', fallback: 'ทดลองสร้างเอกสารจ่ายออก', path: '/operations/outbound-draft' },
    ],
  },
  {
    key: 'reports',
    fallback: 'รายงาน / Reports',
    items: [{ key: 'reports', fallback: 'รายงาน', path: '/reports' }],
  },
  {
    key: 'administration',
    fallback: 'ผู้ดูแลระบบ / Admin',
    items: [
      { key: 'document_branding', fallback: 'แบรนด์เอกสาร', path: '/admin/document-branding' },
      { key: 'auth_readiness', fallback: 'ความพร้อมยืนยันตัวตน', path: '/admin/auth-readiness' },
      { key: 'system_status', fallback: 'สถานะระบบ', path: '/settings' },
    ],
  },
];

function labelFor(item, language) {
  return getTranslation(item.key, language) || item.fallback;
}

export function Sidebar() {
  const { language } = useLanguage();

  return (
    <aside
      className="sidebar modern-sidebar tgm-sidebar"
      aria-label="Primary navigation"
      style={{
        background: brandConfig.colors.black,
        borderRight: '1px solid rgba(214, 161, 31, 0.35)',
        color: brandConfig.colors.white,
        paddingTop: 12,
        paddingBottom: 18,
        paddingLeft: 18,
        paddingRight: 18,
      }}
    >
        <img alt="TGM logo" src={brandConfig.logoPath} className="sr-only" />

      <nav className="nav-list" aria-label="TGM WMS sections" style={{ display: 'grid', gap: 18 }}>
        {navSections.map((group) => (
          <section key={group.key}>
            <p className="eyebrow" style={{ color: 'rgba(255, 255, 255, 0.62)', margin: '0 0 8px' }}>
              {labelFor(group, language)}
            </p>
            <div style={{ display: 'grid', gap: 4 }}>
              {group.items.map((item) => (
                <NavLink
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  key={item.path}
                  style={({ isActive }) => ({
                    background: isActive ? 'rgba(214, 161, 31, 0.18)' : 'transparent',
                    border: `1px solid ${isActive ? brandConfig.colors.gold : 'transparent'}`,
                    borderRadius: 8,
                    color: isActive ? brandConfig.colors.goldSoft : 'rgba(255, 255, 255, 0.82)',
                    display: 'block',
                    fontSize: 14,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    minHeight: 40,
                    padding: '10px 12px',
                  })}
                  to={item.path}
                >
                  {labelFor(item, language)}
                </NavLink>
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
