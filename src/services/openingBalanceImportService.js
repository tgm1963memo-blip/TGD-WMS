import { supabase } from './supabaseClient.js';

export async function importOpeningBalance(customerId, rows, actorId) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase client not configured') };
  }

  const { data, error } = await supabase.rpc('tgd_import_opening_balance', {
    p_customer_id: customerId,
    p_rows: rows,
    p_actor_id: actorId,
  });

  return { data, error };
}
