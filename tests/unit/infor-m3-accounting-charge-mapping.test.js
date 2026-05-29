const {
  createInforM3AccountingChargeMappingDraft,
  mapCanonicalRowToInforM3Draft,
  validateInforM3MappingDraft,
} = require('../../integrations/accounting-charge/mapping/inforM3AccountingChargeMapping');
const {
  validateInforM3AccountingChargeRow,
  classifyInforM3MappingReadiness,
} = require('../../integrations/accounting-charge/validation/inforM3AccountingChargeValidator');
const {
  getInforM3SupportedHandoffModes,
  validateInforM3AdapterConfiguration,
} = require('../../integrations/accounting-charge/adapters/inforM3Adapter.placeholder');

test('mapping draft creation returns empty array', () => {
  const draft = createInforM3AccountingChargeMappingDraft();
  expect(Array.isArray(draft)).toBe(true);
  expect(draft.length).toBe(0);
});

test('map canonical row produces required fields', () => {
  const canonical = {
    customer_code: 'CUST01',
    billing_period: '2024-08',
    service_code: 'STORAGE',
    quantity: 10,
    weight: 100,
  };
  const draft = mapCanonicalRowToInforM3Draft(canonical);
  expect(draft.m3_customer_code).toBe('CUST01');
  expect(draft.m3_billing_period).toBe('2024-08');
  expect(draft.m3_service_code).toBe('STORAGE');
  expect(draft.m3_quantity).toBe(10);
  expect(draft.m3_weight).toBe(100);
});

test('validate mapping draft detects missing required fields', () => {
  const rows = [
    { m3_customer_code: '', m3_billing_period: '', m3_service_code: '', m3_quantity: 0, m3_weight: 0 },
  ];
  const errors = validateInforM3MappingDraft(rows);
  expect(errors.length).toBeGreaterThan(0);
});

test('validator classifies readiness as READY_FOR_ACCOUNTING_REVIEW when complete', () => {
  const rows = [
    { m3_customer_code: 'C1', m3_billing_period: '2024-08', m3_service_code: 'STORAGE', m3_quantity: 5, m3_weight: 50 },
  ];
  const status = classifyInforM3MappingReadiness(rows);
  expect(status).toBe('READY_FOR_ACCOUNTING_REVIEW');
});
test('adapter exposes supported handoff modes and config validator', () => {
  expect(Array.isArray(getInforM3SupportedHandoffModes())).toBe(true);
  const validation = validateInforM3AdapterConfiguration({});
  expect(validation.valid).toBe(true);
  expect(validation.errors.length).toBe(0);
});
