'use server'

import { createClient } from '@/lib/supabase/server'
import { logTabSwitchOffense, type AntiCheatMetadata } from '@/lib/anti-cheat/offense'

export type { AntiCheatMetadata } from '@/lib/anti-cheat/offense'

export async function logTabSwitchOffenseAction(attemptId: string, metadata: AntiCheatMetadata) {
  const supabase = await createClient()
  const result = await logTabSwitchOffense(supabase, attemptId, metadata)
  if ("error" in result) {
    console.error("Failed to log offense:", result.error)
  }
  return result
}
