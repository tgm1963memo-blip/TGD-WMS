import { navigationGroups } from '../app/navigation.js';
import { getRoutePermission } from './routePermissionCatalog.js';
import { resolveNavigationItemPath } from './navigationPaths.js';

const FUNCTION_BY_KEY = new Map();
const FUNCTIONS_BY_PATH = new Map();

// Action-level permissions that gate specific buttons/RPCs rather than an
// entire page. These have no navigation path — their defaults come from
// defaultAllowedRoles instead of route minimum_role — but they are enforced
// server-side (see tgd_role_function_allowed calls in the RPCs) and can be
// overridden per role from the Roles & Permissions settings page.
const ACTION_PERMISSION_GROUP_KEY = 'customer_request_actions';
const ACTION_PERMISSION_GROUP_LABEL = 'การอนุมัติ/ดำเนินการคำขอลูกค้า';

const ACTION_PERMISSIONS = [
  {
    functionKey: 'customer_request_approve',
    label: 'อนุมัติคำขอฝาก/เบิกสินค้า (อนุมัติ/ปฏิเสธ)',
    defaultAllowedRoles: ['admin', 'accounting'],
  },
  {
    functionKey: 'customer_withdrawal_send_to_picking',
    label: 'เบิกใบงาน (ส่งหยิบสินค้า / ยืนยันจ่ายสินค้า)',
    defaultAllowedRoles: ['admin', 'accounting', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'],
  },
  {
    functionKey: 'customer_deposit_confirm_receipt',
    label: 'ยืนยันการรับเข้าคลัง',
    defaultAllowedRoles: ['admin', 'accounting', 'warehouse_manager', 'warehouse_admin'],
  },
  {
    functionKey: 'customer_request_proxy',
    label: 'สร้าง/แจ้งเบิกแทนลูกค้า (Proxy)',
    defaultAllowedRoles: ['admin', 'warehouse_admin', 'warehouse_manager', 'warehouse_staff'],
  },
];

function registerFunction(entry) {
  FUNCTION_BY_KEY.set(entry.functionKey, entry);
  const path = entry.path;
  if (!path) return;
  if (!FUNCTIONS_BY_PATH.has(path)) {
    FUNCTIONS_BY_PATH.set(path, []);
  }
  FUNCTIONS_BY_PATH.get(path).push(entry.functionKey);
}

function buildCatalog() {
  if (FUNCTION_BY_KEY.size > 0) {
    return;
  }

  for (const group of navigationGroups) {
    for (const item of group.items) {
      const path = resolveNavigationItemPath(item);
      if (!path) continue;
      const routeEntry = getRoutePermission(path);
      registerFunction({
        functionKey: item.key,
        label: item.label,
        groupKey: group.key,
        groupLabel: group.label,
        path,
        minimumRole: routeEntry?.minimum_role ?? null,
      });
    }
  }

  for (const action of ACTION_PERMISSIONS) {
    registerFunction({
      functionKey: action.functionKey,
      label: action.label,
      groupKey: ACTION_PERMISSION_GROUP_KEY,
      groupLabel: ACTION_PERMISSION_GROUP_LABEL,
      path: null,
      minimumRole: null,
      defaultAllowedRoles: action.defaultAllowedRoles,
    });
  }
}

export function listNavigationPermissionFunctions() {
  buildCatalog();
  return [...FUNCTION_BY_KEY.values()];
}

export function getNavigationPermissionFunction(functionKey) {
  buildCatalog();
  return FUNCTION_BY_KEY.get(String(functionKey ?? '')) ?? null;
}

export function getFunctionKeysForPath(routePath) {
  buildCatalog();
  const path = String(routePath ?? '');
  const exact = FUNCTIONS_BY_PATH.get(path) ?? [];
  if (exact.length) return exact;

  const matches = [];
  for (const [catalogPath, keys] of FUNCTIONS_BY_PATH.entries()) {
    if (catalogPath.includes(':')) continue;
    if (path === catalogPath || path.startsWith(`${catalogPath}/`)) {
      matches.push(...keys);
    }
  }
  return [...new Set(matches)];
}

// Function keys whose page has data-entry forms/actions (save, confirm,
// edit, submit) — for these, the Roles & Permissions settings page offers a
// three-way control (no access / read-only / read-write) instead of a plain
// on-off checkbox. Pages that are purely informational (dashboards, reports,
// read-only lists) are intentionally left out — "read-only" wouldn't mean
// anything different from "allowed" there.
const WRITE_CAPABLE_FUNCTION_KEYS = new Set([
  'receiving',
  'withdrawal_request',
  'scan_center',
  'customer_deposit_request',
  'customer_withdrawal_request',
  'customer_product_catalog_admin',
  'customer_request_policy_admin',
  'product_service_rates_admin',
  'opening_balance_import',
  'master_data',
  'warehouse_location_setup',
  'user_management',
  'email_settings',
  'billing_invoice_drafts',
]);

export function isWriteCapableFunctionKey(functionKey) {
  return WRITE_CAPABLE_FUNCTION_KEYS.has(String(functionKey ?? ''));
}

export function listNavigationPermissionFunctionsByGroup() {
  const grouped = new Map();
  for (const fn of listNavigationPermissionFunctions()) {
    if (!grouped.has(fn.groupKey)) {
      grouped.set(fn.groupKey, {
        groupKey: fn.groupKey,
        groupLabel: fn.groupLabel,
        items: [],
      });
    }
    grouped.get(fn.groupKey).items.push(fn);
  }
  return [...grouped.values()];
}
