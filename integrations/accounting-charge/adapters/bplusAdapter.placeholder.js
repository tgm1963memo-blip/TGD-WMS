import { ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES } from '../accountingChargePluginInterface.js';

export const BPLUS_ADAPTER_NAME = 'BPLUS_ACCOUNTING_CHARGE_PLACEHOLDER';

export function createBplusAdapterPlaceholder() {
  return {
    name: BPLUS_ADAPTER_NAME,
    targetSystem: 'Bplus',
    placeholderOnly: true,
    capabilities: [
      ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES.PREVIEW_PAYLOAD,
      ACCOUNTING_CHARGE_PLUGIN_CAPABILITIES.DESCRIBE_MAPPING,
    ],
  };
}

export function describeBplusAccountingChargeMapping() {
  return {
    adapterName: BPLUS_ADAPTER_NAME,
    targetSystem: 'Bplus',
    purpose: 'Future mapping for reviewed monthly storage charge summary handoff.',
    placeholderOnly: true,
  };
}

export function getBplusSupportedHandoffModes() {
  return ['MANUAL_REVIEW_SUMMARY', 'PREVIEW_ONLY_BATCH'];
}

export function validateBplusAdapterConfiguration(config = {}) {
  const errors = [];

  if (config.environment && !['sandbox', 'development'].includes(config.environment)) {
    errors.push('Environment must be sandbox or development for the placeholder adapter.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
