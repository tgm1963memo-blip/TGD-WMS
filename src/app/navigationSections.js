import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileClock,
  FileSpreadsheet,
  Hourglass,
  KeyRound,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  PackagePlus,
  PackageMinus,
  Receipt,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Store,
  Tags,
  Upload,
  UserCog,
  Users,
  Warehouse,
} from 'lucide-react';

/**
 * Sidebar presentation layer: how the permission-level navigation groups
 * in navigation.js are shown. Group keys stay unchanged (role permissions,
 * the role-permissions admin page and legacy visibility rules all key off
 * them); this file only folds them into fewer sidebar sections and gives
 * each item an icon.
 */
export const SIDEBAR_SECTIONS = [
  {
    key: 'my_work',
    label: { th: 'งานของฉัน', en: 'My Work' },
    groups: ['main_operation'],
  },
  {
    key: 'warehouse',
    label: { th: 'งานคลัง', en: 'Warehouse' },
    groups: ['inbound_management', 'inventory_control', 'outbound_management', 'barcode_handheld'],
  },
  {
    key: 'customer',
    label: { th: 'พอร์ทัลลูกค้า', en: 'Customer Portal' },
    groups: ['customer_portal'],
  },
  {
    key: 'finance',
    label: { th: 'การเงินและรายงาน', en: 'Billing & Reports' },
    groups: ['billing', 'reports'],
  },
  {
    key: 'settings',
    label: { th: 'ตั้งค่าระบบ', en: 'System Settings' },
    groups: ['system_administration'],
    collapsible: true,
  },
];

const ITEM_ICONS = {
  dashboard: LayoutDashboard,
  receiving: ArrowDownToLine,
  stock_balance: Boxes,
  stock_count_review: ClipboardCheck,
  withdrawal_request: ArrowUpFromLine,
  scan_center: ScanLine,
  customer_portal_home: Store,
  customer_deposit_request: PackagePlus,
  customer_stock_balance: Package,
  customer_withdrawal_request: PackageMinus,
  customer_request_history: FileClock,
  customer_facility_usage: Warehouse,
  customer_product_catalog: Tags,
  customer_movement_ledger: ScrollText,
  customer_team_roles: Users,
  billing_invoice_drafts: Receipt,
  movement_ledger: ScrollText,
  stock_aging: Hourglass,
  operation_summary: BarChart3,
  master_data: Building2,
  warehouse_location_setup: MapPin,
  user_management: UserCog,
  customer_product_catalog_admin: Tags,
  customer_request_policy_admin: ShieldCheck,
  product_service_rates_admin: FileSpreadsheet,
  role_permissions_admin: KeyRound,
  opening_balance_import: Upload,
  users_and_roles: Users,
  email_settings: Mail,
};

export function getNavigationItemIcon(itemKey) {
  return ITEM_ICONS[itemKey] ?? ClipboardList;
}

function pickLabel(label, language) {
  return label?.[language] ?? label?.th ?? '';
}

/**
 * Folds already permission-filtered groups into sidebar sections. A group
 * not listed in any section keeps its own label as an extra section, so a
 * newly added group is never silently dropped from the sidebar.
 */
export function buildSidebarSections(visibleGroups, language = 'th') {
  const byKey = new Map(visibleGroups.map((group) => [group.key, group]));
  const used = new Set();
  const sections = [];

  for (const section of SIDEBAR_SECTIONS) {
    const items = [];
    for (const groupKey of section.groups) {
      const group = byKey.get(groupKey);
      if (!group) continue;
      used.add(groupKey);
      items.push(...group.items);
    }
    if (items.length) {
      sections.push({
        key: section.key,
        label: pickLabel(section.label, language),
        collapsible: Boolean(section.collapsible),
        items,
      });
    }
  }

  for (const group of visibleGroups) {
    if (used.has(group.key) || !group.items.length) continue;
    sections.push({ key: group.key, label: group.label, collapsible: false, items: group.items });
  }

  return sections;
}

/**
 * Finds the sidebar section + item for a pathname. Longest matching path
 * wins, so detail routes (e.g. /customer/admin/deposit-review/123) resolve
 * to their parent menu entry instead of falling back to Dashboard.
 */
export function findNavigationContext(groups, pathname, language = 'th') {
  let best = null;
  for (const group of groups) {
    for (const item of group.items) {
      if (!item.path) continue;
      const exact = pathname === item.path;
      const prefix = item.path !== '/' && pathname.startsWith(`${item.path}/`);
      if (!exact && !prefix) continue;
      const score = exact ? Number.MAX_SAFE_INTEGER : item.path.length;
      if (!best || score > best.score) best = { score, group, item };
    }
  }
  if (!best) return null;
  const section = SIDEBAR_SECTIONS.find((s) => s.groups.includes(best.group.key));
  return {
    item: best.item,
    groupKey: best.group.key,
    sectionLabel: section ? pickLabel(section.label, language) : best.group.label,
  };
}
