import { supabase } from './supabaseClient.js';

export const CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID =
  '0ffcec05-c1d9-4e56-bf05-a7434e679603';
export const CONTROLLED_RECEIVING_DRY_RUN_RPC = 'tgd_rpc_post_receiving_document_dry';

function missingClientResult() {
  return {
    data: null,
    error: new Error('Supabase client is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'),
  };
}

export async function runControlledReceivingRpcDryRun() {
  if (!supabase) {
    return missingClientResult();
  }

  try {
    const dryRunResult = await supabase.rpc(CONTROLLED_RECEIVING_DRY_RUN_RPC, {
      p_document_id: CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID,
    });

    if (dryRunResult.error) {
      return { data: null, error: dryRunResult.error };
    }

    return {
      data: {
        dryRunResult: dryRunResult.data,
        documentId: CONTROLLED_RECEIVING_DRY_RUN_DOCUMENT_ID,
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
