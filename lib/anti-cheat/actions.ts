'use server'

import { createClient } from '@/lib/supabase/server'

export interface AntiCheatMetadata {
  event_source: string;
  visibility_state: string;
  route_path: string;
  user_agent: string;
  client_timestamp: string | null;
}

export async function logTabSwitchOffenseAction(attemptId: string, metadata: AntiCheatMetadata) {
  const supabase = await createClient()

  // Strict truncation to prevent maliciously oversized payloads from blowing up DB memory
  const safeMetadata = {
    event_source: String(metadata.event_source ?? '').slice(0, 50),
    visibility_state: String(metadata.visibility_state ?? '').slice(0, 50),
    route_path: String(metadata.route_path ?? '').slice(0, 300),
    user_agent: String(metadata.user_agent ?? '').slice(0, 600),
    client_timestamp: metadata.client_timestamp ? String(metadata.client_timestamp).slice(0, 50) : new Date().toISOString(),
  }

  const { data, error } = await supabase.rpc('log_tab_switch_offense', {
    p_attempt_id: attemptId,
    p_metadata_json: safeMetadata as unknown as Record<string, unknown>,
  })

  if (error) {
    console.error('Failed to log offense:', error)
    return { error: error.message }
  }

  return { penaltyApplied: data }
}
