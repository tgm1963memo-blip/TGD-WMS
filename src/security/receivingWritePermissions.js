const RECEIVING_WRITE_ROLES = Object.freeze(['admin', 'warehouse_manager', 'warehouse_admin']);

export function canPerformReceivingWrite(userRole) {
  const normalized = String(userRole || '').trim().toLowerCase();
  return RECEIVING_WRITE_ROLES.includes(normalized);
}
