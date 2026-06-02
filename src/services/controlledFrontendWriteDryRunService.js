import { supabase } from './supabaseClient.js';

export const CONTROLLED_RECEIVE_DRY_RUN_REFERENCE = 'FRONTEND-DRY-RUN-13J-H-RECEIVE-002-TRACE-FIX';
export const CONTROLLED_RECEIVE_DRY_RUN_QUANTITY = 10;
export const CONTROLLED_RECEIVE_DRY_RUN_RPC = 'tgd_rpc_create_receive_movement';

function missingClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

function normalizeMovementResult(data) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data ?? null;
}

export async function runControlledReceiveDryRun() {
  if (!supabase) {
    return missingClientResult();
  }

  const balanceResult = await supabase
    .from('tgd_stock_balances')
    .select('id, customer_id, location_id')
    .not('customer_id', 'is', null)
    .not('location_id', 'is', null)
    .limit(1)
    .maybeSingle();

  if (balanceResult.error) {
    return { data: null, error: balanceResult.error };
  }

  if (!balanceResult.data?.customer_id || !balanceResult.data?.location_id) {
    return {
      data: null,
      error: new Error('No demo stock balance row is available for the controlled RECEIVE dry run.'),
    };
  }

  const rpcResult = await supabase.rpc(CONTROLLED_RECEIVE_DRY_RUN_RPC, {
    p_customer_id: balanceResult.data.customer_id,
    p_quantity: CONTROLLED_RECEIVE_DRY_RUN_QUANTITY,
    p_source_location_id: null,
    p_target_location_id: balanceResult.data.location_id,
    p_reference: CONTROLLED_RECEIVE_DRY_RUN_REFERENCE,
  });

  if (rpcResult.error) {
    return { data: null, error: rpcResult.error };
  }

  return {
    data: {
      movement: normalizeMovementResult(rpcResult.data),
      reference: CONTROLLED_RECEIVE_DRY_RUN_REFERENCE,
      quantity: CONTROLLED_RECEIVE_DRY_RUN_QUANTITY,
      stockBalanceId: balanceResult.data.id,
    },
    error: null,
  };
}
