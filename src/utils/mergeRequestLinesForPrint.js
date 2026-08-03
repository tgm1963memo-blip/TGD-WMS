// Combines several customer deposit/withdrawal requests (always the same
// customer — e.g. one truck split across several submitted slips) into a
// single printable staff work order. This is print-layer only: it never
// touches the database, RPCs, or the underlying per-request records/status,
// it just produces a merged {header, lines} shape ready to hand straight to
// CustomerDepositStaffWorkOrderPrint / CustomerWithdrawalRequestPrintDocument.

function normKey(v) {
  return String(v ?? '').trim().toUpperCase();
}

function sumNullable(values) {
  const nums = values.filter((v) => v != null).map(Number).filter((n) => Number.isFinite(n));
  return nums.length === 0 ? null : nums.reduce((a, b) => a + b, 0);
}

function firstNonNull(values) {
  for (const v of values) {
    if (v != null && v !== '') return v;
  }
  return null;
}

function distinctNonNull(values) {
  const out = [];
  const seenKeys = new Set();
  for (const v of values) {
    if (v == null || v === '') continue;
    const dedupeKey = typeof v === 'object' ? JSON.stringify(v) : v;
    if (!seenKeys.has(dedupeKey)) {
      seenKeys.add(dedupeKey);
      out.push(v);
    }
  }
  return out;
}

// Groups lines across all source requests by (product code, tracking code),
// summing quantity fields for matching groups. Lines that share a code but
// differ in tracking code are never merged into the same row — grouping by
// LOT instead (the old behavior) could merge two genuinely distinct
// physical batches sharing one LOT label but different tracking codes (and
// different weight_per_box) into a single printed row. See the incident
// this fixes: 20260725090000_recalc_weight_per_box_on_correction.sql
// documents a real LOT spanning batches that must stay distinguishable.
export function mergeLineGroups(entries, fieldConfig) {
  const { codeFields, trackingFields, sumFields, identityFields, concatFields } = fieldConfig;
  const sortedEntries = [...entries].sort(
    (a, b) => new Date(a.header?.created_at ?? 0) - new Date(b.header?.created_at ?? 0)
  );

  const groups = new Map();
  const order = [];

  for (const entry of sortedEntries) {
    const requestNo = entry.header?.request_no ?? entry.header?.withdrawal_no ?? '';
    for (const line of entry.lines ?? []) {
      const code = normKey(firstNonNull(codeFields.map((f) => line[f])));
      const tracking = normKey(firstNonNull(trackingFields.map((f) => line[f])));
      const key = code || tracking ? `${code}::${tracking}` : `__id::${line.id}`;

      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key).push({ line, requestNo });
    }
  }

  return order.map((key) => {
    const contributors = groups.get(key);
    const lines = contributors.map((c) => c.line);
    const merged = { ...lines[0] };

    for (const field of sumFields) {
      merged[field] = sumNullable(lines.map((l) => l[field]));
    }

    for (const field of identityFields) {
      const values = lines.map((l) => l[field]);
      merged[field] = firstNonNull(values);
      const distinct = distinctNonNull(values);
      if (distinct.length > 1) {
        merged._mergeConflicts = merged._mergeConflicts ?? {};
        merged._mergeConflicts[field] = distinct;
      }
    }

    for (const field of concatFields) {
      const parts = contributors
        .map((c) => ({ requestNo: c.requestNo, value: c.line[field] }))
        .filter((p) => p.value != null && p.value !== '');
      const distinctValues = [...new Set(parts.map((p) => p.value))];
      if (distinctValues.length === 0) merged[field] = lines[0][field] ?? null;
      else if (distinctValues.length === 1) merged[field] = distinctValues[0];
      else merged[field] = parts.map((p) => `${p.requestNo}: ${p.value}`).join('; ');
    }

    if (contributors.length > 1) {
      merged._mergeSourceRequestNos = [...new Set(contributors.map((c) => c.requestNo).filter(Boolean))];
    }

    return merged;
  });
}

// Synthesizes one header from several source headers (same customer,
// expected to mostly agree). Signature/audit fields are blanked rather than
// attributed to one source; disagreements on fields that should normally
// match are recorded (not dropped) and surfaced via the note field.
export function mergeHeadersForPrint(headers, fieldConfig) {
  const { requestNoField, identityFields, noteField, blankFields } = fieldConfig;
  const sorted = [...headers].sort((a, b) => new Date(a?.created_at ?? 0) - new Date(b?.created_at ?? 0));

  const merged = { ...sorted[0] };

  for (const field of blankFields) merged[field] = null;

  const headerConflicts = [];
  for (const field of identityFields) {
    const values = sorted.map((h) => h?.[field]);
    merged[field] = firstNonNull(values);
    const distinct = distinctNonNull(values);
    if (distinct.length > 1) headerConflicts.push({ field, values: distinct });
  }

  const noteParts = sorted
    .map((h) => ({ requestNo: h?.[requestNoField], value: h?.[noteField] }))
    .filter((p) => p.value != null && p.value !== '');
  const distinctNotes = [...new Set(noteParts.map((p) => p.value))];
  let combinedNote = distinctNotes.length <= 1
    ? (distinctNotes[0] ?? null)
    : noteParts.map((p) => `${p.requestNo}: ${p.value}`).join('; ');
  if (headerConflicts.length) {
    const conflictSummary = `[รวมเอกสาร] พบข้อมูลไม่ตรงกันระหว่างเอกสารที่รวมในบางฟิลด์: ${headerConflicts.map((c) => c.field).join(', ')}`;
    combinedNote = combinedNote ? `${combinedNote} | ${conflictSummary}` : conflictSummary;
  }
  merged[noteField] = combinedNote;

  const sourceRequestNos = sorted.map((h) => h?.[requestNoField]).filter(Boolean);
  merged[requestNoField] = sourceRequestNos.join(', ');
  merged.source_request_nos = sourceRequestNos;
  merged.source_request_ids = sorted.map((h) => h?.id).filter(Boolean);
  merged._merge = { sourceCount: sorted.length, headerConflicts };

  return merged;
}

const DEPOSIT_LINE_FIELDS = {
  codeFields: ['customer_product_code', 'internal_product_code'],
  trackingFields: ['tracking_code'],
  sumFields: ['expected_boxes', 'expected_weight', 'actual_boxes', 'actual_weight'],
  identityFields: [
    'lot_no', 'customer_product_code', 'internal_product_code', 'tracking_code',
    'mfg_date', 'exp_date', 'argent_type', 'temperature_type', 'product_name', 'location', 'location_id',
  ],
  concatFields: ['note', 'actual_note'],
};

const DEPOSIT_HEADER_FIELDS = {
  requestNoField: 'request_no',
  identityFields: [
    'customer_id', 'customer_name', 'customer_address', 'contact_name', 'contact_phone', 'contact_fax',
    'expected_arrival_date', 'arrival_time', 'goods_temp', 'truck_temp', 'vehicle_registration',
    'seal_no', 'receive_from', 'status',
  ],
  noteField: 'note',
  blankFields: [
    'reviewed_by_email', 'reviewed_at', 'handheld_received_by_email', 'web_approved_by_email',
    'last_action_at', 'last_action_by_email', 'submitted_at',
  ],
};

const WITHDRAWAL_LINE_FIELDS = {
  codeFields: ['customer_product_code', 'internal_product_code'],
  trackingFields: ['tracking_code'],
  sumFields: ['requested_qty', 'requested_boxes', 'requested_weight', 'picked_boxes', 'picked_weight'],
  identityFields: [
    'lot_no', 'source_lot_no', 'customer_product_code', 'internal_product_code', 'tracking_code',
    'mfg_date', 'exp_date', 'product_name', 'location', 'batch_no', 'uom', 'picking_rule',
    'lot_remaining_boxes', 'lot_remaining_weight', 'resolved_weight_per_box', 'picked_at', 'picked_by_email',
  ],
  concatFields: ['note', 'admin_note'],
};

const WITHDRAWAL_HEADER_FIELDS = {
  requestNoField: 'withdrawal_no',
  identityFields: [
    'customer_id', 'customer_name', 'customer_address', 'contact_phone', 'contact_fax',
    'requested_dispatch_date', 'delivery_type', 'pickup_contact', 'destination',
    'vehicle_registration', 'truck_temp', 'room_temp', 'status',
  ],
  noteField: 'note',
  blankFields: ['reviewed_at', 'last_action_by_email', 'last_action_at', 'web_approved_by_email', 'submitted_at'],
};

export function mergeDepositRequestsForPrint(entries) {
  return {
    header: mergeHeadersForPrint(entries.map((e) => e.header), DEPOSIT_HEADER_FIELDS),
    lines: mergeLineGroups(entries, DEPOSIT_LINE_FIELDS),
  };
}

// Tracking codes are minted as {2-letter temperature prefix}{YYMMDD}{3-digit
// sequence} (see tgd_generate_deposit_line_tracking_code) — the date the lot
// was received into the warehouse is embedded directly in the code. Parsing
// it out (rather than sorting the code as a plain string) means lines with
// different temperature prefixes still interleave correctly by actual date,
// e.g. a CHILLED lot received before a FROZEN lot still prints first even
// though 'CH' > 'FR' alphabetically.
function trackingCodeReceivedDate(trackingCode) {
  const m = /^[A-Z]{2}(\d{2})(\d{2})(\d{2})\d{3}$/.exec(String(trackingCode ?? '').trim().toUpperCase());
  if (!m) return null;
  const [, yy, mm, dd] = m;
  return `20${yy}-${mm}-${dd}`;
}

// Combined work-order rows for a pickup should list oldest-received stock
// first (FEFO picking order), not whichever source request happened to be
// created first. Lines whose tracking code doesn't match the dated format
// (legacy/manual codes, or no tracking code at all — e.g. a bare FEFO line
// with no specific batch chosen yet) sort after every dated line, keeping
// their original relative order rather than being scattered arbitrarily.
function sortLinesByTrackingCodeReceivedDate(lines) {
  return lines
    .map((line, index) => ({ line, index, date: trackingCodeReceivedDate(line.tracking_code) }))
    .sort((a, b) => {
      if (a.date && b.date) {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return String(a.line.tracking_code).localeCompare(String(b.line.tracking_code));
      }
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return a.index - b.index;
    })
    .map((entry) => entry.line);
}

export function mergeWithdrawalRequestsForPrint(entries) {
  const lines = sortLinesByTrackingCodeReceivedDate(
    mergeLineGroups(entries, WITHDRAWAL_LINE_FIELDS).map((line) => ({
      ...line,
      lot_no: line.lot_no ?? line.source_lot_no ?? null,
    }))
  );
  return {
    header: mergeHeadersForPrint(entries.map((e) => e.header), WITHDRAWAL_HEADER_FIELDS),
    lines,
  };
}
