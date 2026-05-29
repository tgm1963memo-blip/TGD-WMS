// src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "../config/supabaseConfig.js";

/**
 * Create a Supabase client if configuration is valid.
 * If not configured, return a dummy proxy that throws a clear error when used.
 */
function createSupabaseClient() {
  try {
    const cfg = getSupabaseConfig();
    if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey) {
      return createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  } catch (e) {
    // fall through to dummy client
  }
  const handler = {
    get(_, prop) {
      // Any accessed property returns a function that throws the not‑configured error
      return (...args) => {
        throw new Error(
          "Supabase is not configured – environment variables are missing or unsafe."
        );
      };
    },
  };
  return new Proxy({}, handler);
}

export const supabase = createSupabaseClient();
