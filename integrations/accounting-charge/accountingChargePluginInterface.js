export const ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES = Object.freeze({
  PREVIEW_PAYLOAD: 'PREVIEW_PAYLOAD',
  VALIDATE_PAYLOAD: 'VALIDATE_PAYLOAD',
  DESCRIBE_MAPPING: 'DESCRIBE_MAPPING',
});

export const ACCOUNTING_CHARGE_HANDOFF_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  READY_FOR_REVIEW: 'READY_FOR_REVIEW',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REJECTED: 'REJECTED',
});

export function createAccountingChargePluginContract() {
  return {
    name: '',
    targetSystem: '',
    capabilities: Object.values(ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES),
    describeMapping: null,
    validatePayload: null,
    createPreviewPayload: null,
  };
}

export function createAccountingChargeHandoffPayload(summaryRows = [], options = {}) {
  return normalizeAccountingChargePayload({
    billing_period: options.billing_period,
    target_system: options.target_system,
    status: options.status ?? ACCOUNTING_CHARGE_HANDOFF_STATUS.DRAFT,
    rows: summaryRows,
    accounting_note: options.accounting_note ?? 'Accounting review required before billing.',
  });
}

export function normalizeAccountingChargePayload(payload = {}) {
  return {
    billing_period: payload.billing_period ?? '',
    target_system: payload.target_system ?? '',
    status: payload.status ?? ACCOUNTING_CHARGE_HANDOFF_STATUS.DRAFT,
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    accounting_note: payload.accounting_note ?? '',
  };
}

export function validateAccountingChargePlugin(plugin = {}) {
  const errors = [];

  if (!plugin.name) errors.push('Plugin name is required.');
  if (!plugin.targetSystem) errors.push('Target system is required.');
  if (!Array.isArray(plugin.capabilities)) errors.push('Capabilities must be an array.');
  if (plugin.describeMapping !== null && typeof plugin.describeMapping !== 'function') {
    errors.push('describeMapping must be a function when provided.');
  }
  if (plugin.validatePayload !== null && typeof plugin.validatePayload !== 'function') {
    errors.push('validatePayload must be a function when provided.');
  }
  if (plugin.createPreviewPayload !== null && typeof plugin.createPreviewPayload !== 'function') {
    errors.push('createPreviewPayload must be a function when provided.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
