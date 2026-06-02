import { supabase } from './supabaseClient.js';

export const CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_NO = 'DRYRUN-13J-M-RECEIVING-FRONTEND-001';
export const CONTROLLED_RECEIVING_DRY_RUN_QUANTITY = 5;
export const CONTROLLED_RECEIVING_DRY_RUN_WEIGHT = 0;
export const RECEIVING_STOCK_POSTING_DISABLED_MESSAGE =
  'Receiving stock posting is not enabled until stock movement RPC accepts product_id, lot_id, and location_id';

export const RECEIVING_DRY_RUN_RPCS = {
  createDraft: 'tgd_rpc_create_receiving_draft',
  addLine: 'tgd_rpc_add_receiving_line',
  confirmDocument: 'tgd_rpc_confirm_receiving_document',
};

const emptyBaseline = {
  receivingDocuments: 0,
  receivingLines: 0,
  stockMovements: 0,
  stockBalances: 0,
  totalStockQuantity: 0,
};

function missingClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

async function getRowCount(tableName) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getTotalStockQuantity() {
  const { data, error } = await supabase
    .from('tgd_stock_balances')
    .select('quantity');

  if (error) {
    throw error;
  }

  return (data ?? []).reduce((total, row) => total + Number(row.quantity ?? 0), 0);
}

async function getReceivingDryRunBaseline() {
  const [
    receivingDocuments,
    receivingLines,
    stockMovements,
    stockBalances,
    totalStockQuantity,
  ] = await Promise.all([
    getRowCount('tgd_receiving_documents'),
    getRowCount('tgd_receiving_lines'),
    getRowCount('tgd_stock_movements'),
    getRowCount('tgd_stock_balances'),
    getTotalStockQuantity(),
  ]);

  return {
    receivingDocuments,
    receivingLines,
    stockMovements,
    stockBalances,
    totalStockQuantity,
  };
}

async function getReceivingDryRunSample() {
  const { data, error } = await supabase
    .from('tgd_stock_balances')
    .select('customer_id, product_id, lot_id, location_id')
    .not('customer_id', 'is', null)
    .not('product_id', 'is', null)
    .not('lot_id', 'is', null)
    .not('location_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.customer_id || !data?.product_id || !data?.lot_id || !data?.location_id) {
    throw new Error('No stock balance sample is available for the controlled Receiving RPC dry run.');
  }

  return data;
}

function isExpectedConfirmBlock(error) {
  return Boolean(error?.message?.includes(RECEIVING_STOCK_POSTING_DISABLED_MESSAGE));
}

function createValidation(before, after) {
  return {
    receivingDocumentsIncreasedByOne: after.receivingDocuments === before.receivingDocuments + 1,
    receivingLinesIncreasedByOne: after.receivingLines === before.receivingLines + 1,
    stockMovementsUnchanged: after.stockMovements === before.stockMovements,
    stockBalancesUnchanged: after.stockBalances === before.stockBalances,
    totalStockQuantityUnchanged: after.totalStockQuantity === before.totalStockQuantity,
  };
}

function summarizeValidation(validation) {
  return Object.values(validation).every(Boolean) ? 'PASS' : 'FAIL';
}

export async function runControlledReceivingRpcDryRun() {
  if (!supabase) {
    return missingClientResult();
  }

  try {
    const before = await getReceivingDryRunBaseline();
    const selectedSample = await getReceivingDryRunSample();

    const draftResult = await supabase.rpc(RECEIVING_DRY_RUN_RPCS.createDraft, {
      p_customer_id: selectedSample.customer_id,
      p_document_no: CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_NO,
    });

    if (draftResult.error) {
      return { data: null, error: draftResult.error };
    }

    const documentId = draftResult.data;
    const lineResult = await supabase.rpc(RECEIVING_DRY_RUN_RPCS.addLine, {
      p_document_id: documentId,
      p_product_id: selectedSample.product_id,
      p_lot_id: selectedSample.lot_id,
      p_quantity: CONTROLLED_RECEIVING_DRY_RUN_QUANTITY,
      p_weight: CONTROLLED_RECEIVING_DRY_RUN_WEIGHT,
    });

    if (lineResult.error) {
      return { data: null, error: lineResult.error };
    }

    const lineId = lineResult.data;
    const confirmResult = await supabase.rpc(RECEIVING_DRY_RUN_RPCS.confirmDocument, {
      p_document_id: documentId,
    });

    if (!isExpectedConfirmBlock(confirmResult.error)) {
      return {
        data: null,
        error: confirmResult.error ?? new Error('Receiving confirm RPC did not return the expected stock posting block.'),
      };
    }

    const after = await getReceivingDryRunBaseline();
    const validation = createValidation(before, after);

    return {
      data: {
        before,
        selectedSample,
        documentId,
        lineId,
        confirmExpectedError: confirmResult.error.message,
        after,
        validation,
        validationStatus: summarizeValidation(validation),
      },
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error,
    };
  }
}

export function getEmptyReceivingDryRunBaseline() {
  return { ...emptyBaseline };
}
