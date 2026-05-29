import { ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES } from '../accountingChargePluginInterface.js';

export const INFOR_M3_ADAPTER_NAME = 'INFOR_M3_ACCOUNTING_CHARGE_PLACEHOLDER';

export function createInforM3AdapterPlaceholder() {
  return {
    name: INFOR_M3_ADAPTER_NAME,
    targetSystem: 'Infor ERP M3',
    placeholderOnly: true,
    capabilities: [
      ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES.PREVIEW_PAYLOAD,
      ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES.DESCRIBE_MAPPING,
    ],
  };
}

export function describeInforM3AccountingChargeMapping() {
  return {
    adapterName: INFOR_M3_ADAPTER_NAME,
    targetSystem: 'Infor ERP M3',
    purpose: 'Future mapping for reviewed monthly storage charge summary handoff.',
    placeholderOnly: true,
  };
}

// Placeholder supported handoff modes – none for future target
export function getInforM3SupportedHandoffModes() {
  return [];
}

// Placeholder configuration validator – always valid
export function validateInforM3AdapterConfiguration(config = {}) {
  return { valid: true, errors: [] };
}
