export function createAccountingChargeAdapterRegistry() {
  return {
    adapters: new Map(),
  };
}

export function registerAccountingChargeAdapter(registry, adapter) {
  const validation = validateAccountingChargeAdapter(adapter);

  if (!validation.valid) {
    return { registry, validation };
  }

  registry.adapters.set(adapter.name, adapter);
  return { registry, validation };
}

export function getAccountingChargeAdapter(registry, adapterName) {
  return registry.adapters.get(adapterName) ?? null;
}

export function listAccountingChargeAdapters(registry) {
  return Array.from(registry.adapters.values());
}

export function validateAccountingChargeAdapter(adapter = {}) {
  const errors = [];

  if (!adapter.name) errors.push('Adapter name is required.');
  if (!adapter.targetSystem) errors.push('Target system is required.');
  if (!Array.isArray(adapter.capabilities)) errors.push('Adapter capabilities must be an array.');
  if (adapter.placeholderOnly !== true) errors.push('Sprint 7A adapters must be placeholders only.');

  return {
    valid: errors.length === 0,
    errors,
  };
}
