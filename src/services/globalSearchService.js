import { supabase } from './supabaseClient.js';

// Read-only lookups behind the Ctrl K search box. Row-level security still
// decides what each user can read; `sources` only skips the queries whose
// page the user couldn't open anyway.
const PER_SOURCE_LIMIT = 6;
export const MIN_SEARCH_LENGTH = 2;

export const SEARCH_SOURCES = Object.freeze({
  deposit: { path: (id) => `/customer/admin/deposit-review/${id}` },
  withdrawal: { path: (id) => `/customer/admin/withdrawal-review?open=${id}` },
  invoice: { path: (id) => `/billing/invoice-drafts/${id}` },
  customer: { path: () => '/master/customers' },
});

// % and _ are wildcards in ILIKE; a typed "100%" must mean the literal text.
export function buildContainsPattern(text) {
  const escaped = String(text ?? '').trim().replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

function customerLabel(customer) {
  return customer?.customer_name ?? customer?.customer_code ?? '';
}

function searchDeposits(pattern) {
  return supabase
    .from('tgd_customer_deposit_requests')
    .select('id, request_no, customer:tgd_customers(customer_name, customer_code)')
    .ilike('request_no', pattern)
    .order('created_at', { ascending: false })
    .limit(PER_SOURCE_LIMIT)
    .then(({ data, error }) => ({
      error,
      rows: (data ?? []).map((row) => ({
        type: 'deposit',
        id: row.id,
        title: row.request_no,
        subtitle: customerLabel(row.customer),
        path: SEARCH_SOURCES.deposit.path(row.id),
      })),
    }));
}

function searchWithdrawals(pattern) {
  return supabase
    .from('tgd_customer_withdrawal_requests')
    .select('id, withdrawal_no, customer:tgd_customers(customer_name, customer_code)')
    .ilike('withdrawal_no', pattern)
    .neq('status', 'WITHDRAWAL_DRAFT')
    .neq('status', 'DRAFT')
    .order('created_at', { ascending: false })
    .limit(PER_SOURCE_LIMIT)
    .then(({ data, error }) => ({
      error,
      rows: (data ?? []).map((row) => ({
        type: 'withdrawal',
        id: row.id,
        title: row.withdrawal_no,
        subtitle: customerLabel(row.customer),
        path: SEARCH_SOURCES.withdrawal.path(row.id),
      })),
    }));
}

function searchDepositLines(pattern, column) {
  return supabase
    .from('tgd_customer_deposit_request_lines')
    .select('id, deposit_request_id, lot_no, tracking_code, product_name, customer_product_code')
    .ilike(column, pattern)
    .order('id', { ascending: false })
    .limit(PER_SOURCE_LIMIT)
    .then(({ data, error }) => ({
      error,
      rows: (data ?? []).map((row) => ({
        type: 'lot',
        id: row.id,
        title: row[column],
        subtitle: [row.product_name ?? row.customer_product_code, column === 'tracking_code' ? row.lot_no : row.tracking_code]
          .filter(Boolean)
          .join(' · '),
        path: SEARCH_SOURCES.deposit.path(row.deposit_request_id),
      })),
    }));
}

function searchInvoiceDrafts(pattern, table) {
  return supabase
    .from(table)
    .select('id, draft_no, status')
    .ilike('draft_no', pattern)
    .order('created_at', { ascending: false })
    .limit(PER_SOURCE_LIMIT)
    .then(({ data, error }) => ({
      error,
      rows: (data ?? []).map((row) => ({
        type: 'invoice',
        id: row.id,
        title: row.draft_no,
        subtitle: row.status ?? '',
        path: SEARCH_SOURCES.invoice.path(row.id),
      })),
    }));
}

function searchCustomers(pattern, column) {
  return supabase
    .from('tgd_customers')
    .select('id, customer_code, customer_name')
    .ilike(column, pattern)
    .limit(PER_SOURCE_LIMIT)
    .then(({ data, error }) => ({
      error,
      rows: (data ?? []).map((row) => ({
        type: 'customer',
        id: row.id,
        title: row.customer_name ?? row.customer_code,
        subtitle: row.customer_code ?? '',
        path: SEARCH_SOURCES.customer.path(row.id),
      })),
    }));
}

/**
 * sources: which of deposit / withdrawal / invoice / customer to query.
 * Returns whatever succeeded plus `failed: true` if any source errored, so
 * one bad query doesn't blank out the rest.
 */
export async function searchRecords(text, { sources = [], invoiceTable = 'tgd_billing_invoice_drafts' } = {}) {
  const trimmed = String(text ?? '').trim();
  if (!supabase || trimmed.length < MIN_SEARCH_LENGTH || sources.length === 0) {
    return { data: [], failed: false };
  }

  const pattern = buildContainsPattern(trimmed);
  const queries = [];
  if (sources.includes('deposit')) {
    queries.push(searchDeposits(pattern), searchDepositLines(pattern, 'tracking_code'), searchDepositLines(pattern, 'lot_no'));
  }
  if (sources.includes('withdrawal')) queries.push(searchWithdrawals(pattern));
  if (sources.includes('invoice')) queries.push(searchInvoiceDrafts(pattern, invoiceTable));
  if (sources.includes('customer')) queries.push(searchCustomers(pattern, 'customer_name'), searchCustomers(pattern, 'customer_code'));

  const settled = await Promise.allSettled(queries);
  const seen = new Set();
  const data = [];
  let failed = false;
  for (const result of settled) {
    if (result.status !== 'fulfilled' || result.value.error) failed = true;
    if (result.status !== 'fulfilled') continue;
    for (const row of result.value.rows) {
      const key = `${row.type}:${row.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      data.push(row);
    }
  }
  return { data, failed };
}
