import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    const { supabaseUrl, supabasePublicKey } = getSupabaseEnv();

    if (!supabaseUrl || !supabasePublicKey) {
      throw new Error("Supabase environment variables are missing.");
    }

    supabaseClient = createBrowserClient(supabaseUrl, supabasePublicKey);
  }

  return supabaseClient;
}
