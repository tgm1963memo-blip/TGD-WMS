import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVE_INVOICE_DRAFT_STATUSES,
  APPROVABLE_INVOICE_DRAFT_STATUSES,
  INVOICE_DRAFT_STATUS,
  buildInvoiceDraftCreatePayload,
  buildInvoiceDraftLineFromMovement,
  calculateInvoiceDraftTotals,
  applyActiveDuplicateDraftGuards,
  canApproveBillingInvoiceDraft,
  canCancelBillingInvoiceDraft,
  findDuplicateDraftLines,
  validateInvoiceDraftSourceRows,
} from '../../src/utils/billingInvoiceDraftUtils.js';

const { fromMock, rpcMock, getBillingMovementWeightRowsMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  getBillingMovementWeightRowsMock: vi.fn(),
}));

vi.mock('../../src/services/supabaseClient.js', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
  },
}));

vi.mock('../../src/services/billingMovementWeightService.js', () => ({
  getBillingMovementWeightRows: getBillingMovementWeightRowsMock,
  shapeBillingMovementWeightRow: (row) => row,
}));

const servicePath = path.join(process.cwd(), 'src/services/billingInvoiceDraftService.js');
const migrationPath = path.join(process.cwd(), 'database/migrations/037_tgd_wms_billing_invoice_draft_foundation.sql');
const utilsPath = path.join(process.cwd(), 'src/utils/billingInvoiceDraftUtils.js');

const {
  approveBillingInvoiceDraft,
  cancelBillingInvoiceDraft,
  createBillingInvoiceDraftFromMovements,
  deleteBillingInvoiceDraft,
  findActiveDuplicateDraftLines,
  getBillingInvoiceDraftById,
  getBillingInvoiceDraftBplusExportReadiness,
  listBillingInvoiceDrafts,
} = await import('../../src/services/billingInvoiceDraftService.js');

const validMovement = {
  movement_id: 'mv-1',
  customer_id: 'cust-1',
  customer_name: 'Alpha Cold',
  product_id: 'prod-1',
  product_code: 'FSHR-001',
  product_name: 'Frozen Shrimp',
  movement_type: 'RECEIVE_CONFIRM',
  movement_date: '2026-06-01T10:00:00.000Z',
  qty: 10,
  uom: 'KG',
  net_weight: 100,
  gross_weight: 100,
  chargeable_weight: 100,
  is_billable: true,
  billing_status: 'READY_FOR_PREVIEW',
  source_document_no: 'RCV-001',
  source_document_type: 'RECEIVING',
};

const validMovementTwo = {
  ...validMovement,
  movement_id: 'mv-2',
  qty: 5,
  net_weight: 50,
  gross_weight: 50,
  chargeable_weight: 50,
};

function readService() {
  return readFileSync(servicePath, 'utf8');
}

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

function createSelectResult(state, handlers) {
  const result = {
    single: vi.fn(async () => handlers.single?.(state)
      ?? handlers.afterWrite?.(state)
      ?? { data: Array.isArray(state.payload) ? state.payload[0] : state.payload, error: null }),
    then: (resolve, reject) => Promise
      .resolve(handlers.afterWrite?.(state) ?? { data: state.payload, error: null })
      .then(resolve, reject),
  };
  return result;
}

function createTableChain(tableName, handlers = {}) {
  const state = {
    filters: {},
    payload: null,
    tableName,
    operation: null,
  };

  const chain = {
    select: vi.fn(() => {
      if (state.operation === 'insert' || state.operation === 'update') {
        return createSelectResult(state, handlers);
      }
      return chain;
    }),
    eq: vi.fn((column, value) => {
      state.filters[column] = value;
      if (state.operation === 'delete') {
        return Promise.resolve(handlers.afterDelete?.(state) ?? { data: null, error: null });
      }
      return chain;
    }),
    delete: vi.fn(() => {
      state.operation = 'delete';
      return chain;
    }),
    in: vi.fn((column, values) => {
      state.filters[column] = values;
      if (handlers.inResult) {
        return Promise.resolve(handlers.inResult(state));
      }
      return chain;
    }),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    order: vi.fn(() => {
      if (handlers.orderResult) {
        return Promise.resolve(handlers.orderResult(state));
      }
      return Promise.resolve(handlers.order?.(state) ?? { data: [], error: null });
    }),
    insert: vi.fn((payload) => {
      state.payload = payload;
      state.operation = 'insert';
      return chain;
    }),
    update: vi.fn((payload) => {
      state.payload = payload;
      state.operation = 'update';
      return chain;
    }),
    maybeSingle: vi.fn(async () => handlers.maybeSingle?.(state) ?? { data: null, error: null }),
    single: vi.fn(async () => handlers.single?.(state) ?? { data: null, error: null }),
  };

  return chain;
}

describe('Gate 3B-1 billing invoice draft foundation', () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    getBillingMovementWeightRowsMock.mockReset();
    rpcMock.mockResolvedValue({ data: 'BID-20260608-0001', error: null });
    getBillingMovementWeightRowsMock.mockResolvedValue({
      data: [validMovement, validMovementTwo],
      error: null,
      source: 'billing_database_view',
    });
  });

  it('creates migration draft with additive tables and duplicate guard index', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readMigration();
    expect(sql).toContain('tgd_billing_invoice_drafts');
    expect(sql).toContain('tgd_billing_invoice_draft_lines');
    expect(sql).toContain('duplicate_guard_active');
    expect(sql).toContain('tgd_billing_invoice_draft_lines_active_movement_uidx');
    expect(sql).toContain('READY_TO_REVIEW');
    expect(sql).toContain('EXPORTED_TO_BPLUS');
    expect(sql).not.toMatch(/drop\s+table/i);
    expect(sql).not.toMatch(/truncate/i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });

  it('exports service functions without stock or receiving mutation', () => {
    const source = readService();
    expect(source).toContain('listBillingInvoiceDrafts');
    expect(source).toContain('getBillingInvoiceDraftById');
    expect(source).toContain('createBillingInvoiceDraftFromMovements');
    expect(source).toContain('cancelBillingInvoiceDraft');
    expect(source).toContain('approveBillingInvoiceDraft');
    expect(source).not.toContain('receivingService');
    expect(source).not.toContain('dispatchService');
    expect(source).not.toMatch(/tgd_stock_movements|tgd_receiving_documents/);
    expect(source).not.toMatch(/\.rpc\('tgd_rpc_post|\.rpc\('tgd_rpc_confirm/);
  });

  it('creates draft payload from valid movement rows', () => {
    const payload = buildInvoiceDraftCreatePayload({
      draftNo: 'BID-20260608-0001',
      movements: [validMovement, validMovementTwo],
      billingPeriodStart: '2026-06-01',
      billingPeriodEnd: '2026-06-30',
      note: 'June billing',
    });

    expect(payload.valid).toBe(true);
    expect(payload.header.customer_id).toBe('cust-1');
    expect(payload.header.total_qty).toBe(15);
    expect(payload.header.total_chargeable_weight).toBe(150);
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0].source_movement_id).toBe('mv-1');
  });

  it('rejects empty movement selection', () => {
    const validation = validateInvoiceDraftSourceRows([]);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatch(/at least one/i);
  });

  it('rejects mixed customers', () => {
    const validation = validateInvoiceDraftSourceRows([
      validMovement,
      { ...validMovementTwo, customer_id: 'cust-2' },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/same customer/i);
  });

  it('rejects non-billable rows', () => {
    const validation = validateInvoiceDraftSourceRows([
      { ...validMovement, is_billable: false, billing_status: 'EXCLUDED' },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/not billable/i);
  });

  it('rejects NEEDS_WEIGHT_REVIEW rows', () => {
    const validation = validateInvoiceDraftSourceRows([
      {
        ...validMovement,
        billing_status: 'NEEDS_WEIGHT_REVIEW',
        chargeable_weight: 0,
        gross_weight: 0,
        net_weight: 0,
      },
    ]);

    expect(validation.valid).toBe(false);
    expect(validation.errors.join(' ')).toMatch(/needs weight review/i);
  });

  it('rejects duplicate movement in active draft', () => {
    const duplicates = findDuplicateDraftLines(['mv-1'], [
      { id: 'line-1', invoice_draft_id: 'draft-1', source_movement_id: 'mv-1', duplicate_guard_active: true },
    ]);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0].source_movement_id).toBe('mv-1');
  });

  it('allows cancelled draft source to be reused', () => {
    const duplicates = findDuplicateDraftLines(['mv-1'], [
      { id: 'line-1', invoice_draft_id: 'draft-1', source_movement_id: 'mv-1', duplicate_guard_active: false },
    ]);

    expect(duplicates).toHaveLength(0);
  });

  it('enriches movement rows with active duplicate guard state', () => {
    const rows = applyActiveDuplicateDraftGuards(
      [{ movement_id: 'mv-1' }, { movement_id: 'mv-2' }],
      [
        { source_movement_id: 'mv-1', duplicate_guard_active: true },
        { source_movement_id: 'mv-2', duplicate_guard_active: false },
      ],
    );

    expect(rows).toEqual([
      { movement_id: 'mv-1', active_duplicate_guard: true },
      { movement_id: 'mv-2', active_duplicate_guard: false },
    ]);
  });

  it('calculates totals correctly', () => {
    const lines = [
      buildInvoiceDraftLineFromMovement(validMovement),
      buildInvoiceDraftLineFromMovement(validMovementTwo),
    ];

    expect(calculateInvoiceDraftTotals(lines)).toEqual({
      total_qty: 15,
      total_net_weight: 150,
      total_gross_weight: 150,
      total_chargeable_weight: 150,
      total_amount: null,
    });
  });

  it('allows cancel only for DRAFT or READY_TO_REVIEW', () => {
    expect(canCancelBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.DRAFT })).toBe(true);
    expect(canCancelBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.READY_TO_REVIEW })).toBe(true);
    expect(canCancelBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.APPROVED })).toBe(false);
    expect(canCancelBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.BILLED })).toBe(false);
  });

  it('allows approve only for DRAFT or READY_TO_REVIEW', () => {
    expect(APPROVABLE_INVOICE_DRAFT_STATUSES).toEqual([
      INVOICE_DRAFT_STATUS.DRAFT,
      INVOICE_DRAFT_STATUS.READY_TO_REVIEW,
    ]);
    expect(canApproveBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.DRAFT })).toBe(true);
    expect(canApproveBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.READY_TO_REVIEW })).toBe(true);
    expect(canApproveBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.APPROVED })).toBe(false);
    expect(canApproveBillingInvoiceDraft({ status: INVOICE_DRAFT_STATUS.CANCELLED })).toBe(false);
  });

  it('creates invoice draft from movements through service layer', async () => {
    const headerRow = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      customer_id: 'cust-1',
      customer_name: 'Alpha Cold',
      status: 'DRAFT',
      total_qty: 15,
      total_net_weight: 150,
      total_gross_weight: 150,
      total_chargeable_weight: 150,
      currency: 'THB',
    };

    let lineTableCalls = 0;
    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_draft_lines') {
        lineTableCalls += 1;
        if (lineTableCalls === 1) {
          return createTableChain(tableName, {
            inResult: () => ({ data: [], error: null }),
          });
        }

        return createTableChain(tableName, {
          afterWrite: (state) => ({
            data: (Array.isArray(state.payload) ? state.payload : []).map((line, index) => ({
              id: `line-${index + 1}`,
              ...line,
            })),
            error: null,
          }),
        });
      }

      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          afterWrite: () => ({ data: headerRow, error: null }),
          single: async () => ({ data: headerRow, error: null }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await createBillingInvoiceDraftFromMovements({
      movementIds: ['mv-1', 'mv-2'],
      billingPeriodStart: '2026-06-01',
      billingPeriodEnd: '2026-06-30',
      note: 'UAT draft',
    });

    expect(result.error).toBeNull();
    expect(result.data.draft.draft_no).toBe('BID-20260608-0001');
    expect(result.data.lines).toHaveLength(2);
    expect(fromMock).toHaveBeenCalledWith('tgd_billing_invoice_drafts');
    expect(fromMock).toHaveBeenCalledWith('tgd_billing_invoice_draft_lines');
    expect(rpcMock).toHaveBeenCalledWith('tgd_next_billing_invoice_draft_no');
  });

  it('cancel draft updates status through service layer', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      status: 'DRAFT',
      customer_id: 'cust-1',
    };

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
          afterWrite: () => ({ data: { ...draft, status: 'CANCELLED' }, error: null }),
          single: async () => ({ data: { ...draft, status: 'CANCELLED' }, error: null }),
        });
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({ data: [], error: null }),
          afterWrite: () => ({ data: [], error: null }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await cancelBillingInvoiceDraft({
      draftId: 'draft-1',
      reason: 'Created by mistake',
    });

    expect(result.error).toBeNull();
    expect(result.data.status).toBe('CANCELLED');
  });

  it('delete draft removes lines then the header for a DRAFT-status draft', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      status: 'DRAFT',
      customer_id: 'cust-1',
    };

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
          afterDelete: () => ({ data: null, error: null }),
        });
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({ data: [], error: null }),
          afterDelete: () => ({ data: null, error: null }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await deleteBillingInvoiceDraft({ draftId: 'draft-1' });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ draftId: 'draft-1' });
  });

  it('delete draft is rejected once the draft is past plain DRAFT status', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      status: 'READY_TO_REVIEW',
      customer_id: 'cust-1',
    };

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
        });
      }
      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, { order: async () => ({ data: [], error: null }) });
      }
      return createTableChain(tableName);
    });

    const result = await deleteBillingInvoiceDraft({ draftId: 'draft-1' });

    expect(result.data).toBeNull();
    expect(result.error.code).toBe('INVOICE_DRAFT_VALIDATION');
  });

  it('approve draft updates only the header status and keeps duplicate guards untouched', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      status: 'DRAFT',
      customer_id: 'cust-1',
    };
    const headerOperations = [];
    const lineOperations = [];

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        const chain = createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
          afterWrite: (state) => {
            headerOperations.push({ operation: state.operation, payload: state.payload, filters: { ...state.filters } });
            return { data: { ...draft, ...state.payload }, error: null };
          },
        });
        return chain;
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        const chain = createTableChain(tableName, {
          order: async (state) => {
            lineOperations.push({ operation: state.operation, payload: state.payload });
            return {
              data: [{
                id: 'line-1',
                invoice_draft_id: 'draft-1',
                source_movement_id: 'mv-1',
                duplicate_guard_active: true,
              }],
              error: null,
            };
          },
        });
        return chain;
      }

      return createTableChain(tableName);
    });

    const result = await approveBillingInvoiceDraft({ draftId: 'draft-1' });

    expect(result.error).toBeNull();
    expect(result.data.status).toBe('APPROVED');
    expect(headerOperations).toHaveLength(1);
    expect(headerOperations[0].payload).toEqual({
      status: 'APPROVED',
      updated_at: expect.any(String),
    });
    expect(headerOperations[0].filters.id).toBe('draft-1');
    expect(headerOperations[0].filters.status).toEqual(['DRAFT', 'READY_TO_REVIEW']);
    expect(lineOperations).toEqual([{ operation: null, payload: null }]);
  });

  it('rejects approval from a non-approvable status without updating tables', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260608-0001',
      status: 'APPROVED',
      customer_id: 'cust-1',
    };
    const updateMock = vi.fn();

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        const chain = createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
        });
        chain.update = updateMock;
        return chain;
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({ data: [], error: null }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await approveBillingInvoiceDraft({ draftId: 'draft-1' });

    expect(result.data).toBeNull();
    expect(result.error.message).toMatch(/only DRAFT or READY_TO_REVIEW/i);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('lists and reads invoice drafts without touching stock tables', async () => {
    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          order: async () => ({
            data: [{ id: 'draft-1', draft_no: 'BID-20260608-0001', status: 'DRAFT', customer_id: 'cust-1' }],
            error: null,
          }),
          maybeSingle: async () => ({
            data: { id: 'draft-1', draft_no: 'BID-20260608-0001', status: 'DRAFT', customer_id: 'cust-1' },
            error: null,
          }),
        });
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({ data: [], error: null }),
        });
      }

      return createTableChain(tableName);
    });

    const listResult = await listBillingInvoiceDrafts();
    const detailResult = await getBillingInvoiceDraftById('draft-1');

    expect(listResult.data).toHaveLength(1);
    expect(detailResult.data.draft.id).toBe('draft-1');
    expect(fromMock.mock.calls.every(([table]) => !table.includes('stock'))).toBe(true);
    expect(fromMock.mock.calls.every(([table]) => !table.includes('receiving'))).toBe(true);
  });

  it('findActiveDuplicateDraftLines uses duplicate guard only', async () => {
    fromMock.mockImplementation(() => createTableChain('tgd_billing_invoice_draft_lines', {
      inResult: () => ({
        data: [{ id: 'line-1', invoice_draft_id: 'draft-9', source_movement_id: 'mv-1', duplicate_guard_active: true }],
        error: null,
      }),
    }));

    const result = await findActiveDuplicateDraftLines(['mv-1']);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].source_movement_id).toBe('mv-1');
  });

  it('documents approved active statuses for future gates', () => {
    const utilsSource = readFileSync(utilsPath, 'utf8');
    expect(utilsSource).toContain('APPROVED');
    expect(utilsSource).toContain('EXPORTED_TO_BPLUS');
    expect(utilsSource).toContain('BILLED');
    expect(ACTIVE_INVOICE_DRAFT_STATUSES).toContain('APPROVED');
    expect(ACTIVE_INVOICE_DRAFT_STATUSES).not.toContain('CANCELLED');
  });

  it('returns Bplus export readiness preview without mutating draft status', async () => {
    const draft = {
      id: 'draft-1',
      draft_no: 'BID-20260611-0002',
      customer_id: 'cust-1',
      customer_name: 'Alpha',
      status: 'APPROVED',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      total_chargeable_weight: 250,
      total_amount: 5000,
      currency: 'THB',
      updated_at: '2026-06-11T10:00:00.000Z',
    };
    const updateMock = vi.fn();

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        const chain = createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
        });
        chain.update = updateMock;
        return chain;
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({
            data: [{
              product_code: 'FSHR-001',
              product_name: 'Frozen Shrimp',
              movement_type: 'RECEIVE_CONFIRM',
              chargeable_weight: 250,
              rate: 20,
              amount: 5000,
              qty: 50,
              uom: 'kg',
            }],
            error: null,
          }),
        });
      }

      if (tableName === 'tgd_customers') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({
            data: { id: 'cust-1', customer_code: 'ALPHA-001', customer_name: 'Alpha' },
            error: null,
          }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await getBillingInvoiceDraftBplusExportReadiness('draft-1');

    expect(result.error).toBeNull();
    expect(result.data.readiness_status).toBe('READY');
    expect(result.data.header_preview.customer_code).toBe('ALPHA-001');
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns BLOCKED readiness when UAT customer master has no customer_code column', async () => {
    const draft = {
      id: 'draft-1',
      customer_id: 'cust-1',
      customer_name: 'Demo Customer Alpha',
      status: 'APPROVED',
      billing_period_start: '2026-06-01',
      billing_period_end: '2026-06-30',
      total_chargeable_weight: 250,
      total_amount: 5000,
      currency: 'THB',
      updated_at: '2026-06-11T10:00:00.000Z',
    };
    let customerSelectArg = null;

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
        });
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({
            data: [{
              product_code: 'FSHR-001',
              product_name: 'Frozen Shrimp',
              movement_type: 'RECEIVE_CONFIRM',
              chargeable_weight: 250,
              rate: 20,
              amount: 5000,
              qty: 50,
              uom: 'kg',
            }],
            error: null,
          }),
        });
      }

      if (tableName === 'tgd_customers') {
        const chain = createTableChain(tableName, {
          maybeSingle: async () => ({
            data: {
              id: 'cust-1',
              name: 'Demo Customer Alpha',
              contact_email: 'alpha.demo@tgd-wms.local',
            },
            error: null,
          }),
        });
        chain.select = (columns) => {
          customerSelectArg = columns;
          return chain;
        };
        return chain;
      }

      return createTableChain(tableName);
    });

    const result = await getBillingInvoiceDraftBplusExportReadiness('draft-1');

    expect(result.error).toBeNull();
    expect(customerSelectArg).toBe('*');
    expect(result.data.readiness_status).toBe('BLOCKED');
    expect(result.data.ready).toBe(false);
    expect(result.data.blockers).toContain('Missing Bplus customer code.');
    expect(result.data.warnings.some((item) => /Customer code mapping is not configured/i.test(item))).toBe(true);
    expect(result.data.line_previews).toHaveLength(1);
    expect(result.data.header_preview.customer_code).toBeNull();
  });

  it('maps billing invoice draft RLS errors to a user-friendly permission message', async () => {
    fromMock.mockImplementation(() => createTableChain('tgd_billing_invoice_drafts', {
      order: async () => ({
        data: null,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      }),
    }));

    const result = await listBillingInvoiceDrafts();

    expect(result.data).toBeNull();
    expect(result.error?.code).toBe('INVOICE_DRAFT_PERMISSION_DENIED');
    expect(result.error?.message).toBe('You do not have permission to access billing invoice drafts.');
  });

  it('surfaces unexpected Supabase customer lookup errors', async () => {
    const draft = {
      id: 'draft-1',
      customer_id: 'cust-1',
      status: 'APPROVED',
      total_chargeable_weight: 250,
    };
    const lookupError = { message: 'connection timeout while reading tgd_customers', code: 'PGRST000' };

    fromMock.mockImplementation((tableName) => {
      if (tableName === 'tgd_billing_invoice_drafts') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: draft, error: null }),
        });
      }

      if (tableName === 'tgd_billing_invoice_draft_lines') {
        return createTableChain(tableName, {
          order: async () => ({ data: [], error: null }),
        });
      }

      if (tableName === 'tgd_customers') {
        return createTableChain(tableName, {
          maybeSingle: async () => ({ data: null, error: lookupError }),
        });
      }

      return createTableChain(tableName);
    });

    const result = await getBillingInvoiceDraftBplusExportReadiness('draft-1');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(lookupError);
  });
});
