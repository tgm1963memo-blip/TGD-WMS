export const PRODUCTION_ROLES = Object.freeze([
  'viewer',
  'warehouse_staff',
  'warehouse_manager',
  'accounting',
  'admin',
]);

export const PRODUCTION_ROLE_HIERARCHY = Object.freeze({
  viewer: 10,
  warehouse_staff: 20,
  warehouse_manager: 30,
  accounting: 40,
  admin: 50,
});

export const PRODUCTION_ROLE_DESCRIPTIONS = Object.freeze({
  admin: 'System administration and full controlled review access.',
  warehouse_manager: 'Warehouse supervision for Cold Storage operations and operational reports.',
  warehouse_staff: 'Warehouse execution access for assigned Receiving, Putaway, Customer Withdrawal, Picking, and Dispatch / Goods Issue work.',
  accounting: 'Read-only Monthly Storage Billing Summary and Accounting Charge Review access.',
  viewer: 'General read-only reporting access.',
});

export function normalizeProductionRole(role) {
  if (typeof role !== 'string') return '';
  return role.trim().toLowerCase();
}

export function isValidProductionRole(role) {
  return PRODUCTION_ROLES.includes(normalizeProductionRole(role));
}

export function getProductionRoleRank(role) {
  const normalizedRole = normalizeProductionRole(role);
  return PRODUCTION_ROLE_HIERARCHY[normalizedRole] || 0;
}

export function canProductionRoleAccess(requiredRole, userRole) {
  if (!isValidProductionRole(requiredRole) || !isValidProductionRole(userRole)) {
    return false;
  }

  return getProductionRoleRank(userRole) >= getProductionRoleRank(requiredRole);
}

export function summarizeProductionRole(role) {
  const normalizedRole = normalizeProductionRole(role);
  const valid = isValidProductionRole(normalizedRole);

  return {
    role: valid ? normalizedRole : 'viewer',
    inputRole: role,
    valid,
    rank: valid ? getProductionRoleRank(normalizedRole) : getProductionRoleRank('viewer'),
    description: valid ? PRODUCTION_ROLE_DESCRIPTIONS[normalizedRole] : PRODUCTION_ROLE_DESCRIPTIONS.viewer,
  };
}
