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

  const { data, error } = await supabase.rpc('log_tab_switch_offense', {
    p_attempt_id: attemptId,
    p_metadata_json: metadata as unknown as Record<string, unknown>,
  })

  if (error) {
    console.error('Failed to log offense:', error)
    return { error: error.message }
  }

  return { penaltyApplied: data }
}
