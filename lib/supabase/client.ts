import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

export function createClient() {
  const { supabaseUrl, supabasePublicKey } = getSupabaseEnv();

  return createBrowserClient(
    supabaseUrl,
    supabasePublicKey,
  );
}
