export function missingSupabaseClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export function normalizeCustomerPortalRpcData(data) {
  if (!data) return null;
  if (typeof data === 'object' && !Array.isArray(data)) return data;
  return null;
}

export function toNullableNumber(value) {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toNullableText(value) {
  if (value === null || typeof value === 'undefined') return null;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : null;
}

export const CUSTOMER_PORTAL_WRITE_ROLES = Object.freeze(['customer_admin', 'customer_user']);
export const CUSTOMER_PORTAL_ADMIN_REVIEW_ROLES = Object.freeze(['admin', 'accounting']);
export const CUSTOMER_REQUEST_PROXY_ROLES = Object.freeze([
  'admin',
  'warehouse_admin',
  'warehouse_manager',
  'warehouse_staff',
]);

export function isCustomerRequestProxyRole(role) {
  return CUSTOMER_REQUEST_PROXY_ROLES.includes(String(role ?? '').trim().toLowerCase());
}
