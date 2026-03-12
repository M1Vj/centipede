import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const { supabaseUrl, supabasePublicKey } = getSupabaseEnv();

    supabaseClient = createBrowserClient(supabaseUrl, supabasePublicKey);
  }

  return supabaseClient;
}
