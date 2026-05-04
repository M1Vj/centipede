export interface AntiCheatMetadata {
  event_source: string;
  visibility_state: string;
  route_path: string;
  user_agent: string;
  client_timestamp: string | null;
}

export type AntiCheatPenalty = "warning" | "deduction" | "auto_submit" | "disqualified" | "none";

type AntiCheatRpcClient = {
  rpc: (
    fn: "log_tab_switch_offense",
    args: {
      p_attempt_id: string;
      p_metadata_json: Record<string, unknown>;
      p_actor_user_id?: string;
    },
  ) => PromiseLike<{
    data: unknown;
    error: { message?: string } | null;
  }>;
};

export function sanitizeAntiCheatMetadata(metadata: Partial<AntiCheatMetadata> | null | undefined) {
  return {
    event_source: String(metadata?.event_source ?? "").slice(0, 50),
    visibility_state: String(metadata?.visibility_state ?? "").slice(0, 50),
    route_path: String(metadata?.route_path ?? "").slice(0, 300),
    user_agent: String(metadata?.user_agent ?? "").slice(0, 600),
    client_timestamp: metadata?.client_timestamp
      ? String(metadata.client_timestamp).slice(0, 50)
      : new Date().toISOString(),
  };
}

export async function logTabSwitchOffense(
  supabase: AntiCheatRpcClient,
  attemptId: string,
  metadata: Partial<AntiCheatMetadata> | null | undefined,
  actorUserId?: string,
) {
  const { data, error } = await supabase.rpc("log_tab_switch_offense", {
    p_attempt_id: attemptId,
    p_metadata_json: sanitizeAntiCheatMetadata(metadata),
    ...(actorUserId ? { p_actor_user_id: actorUserId } : {}),
  });

  if (error) {
    return { error: error.message ?? "Failed to log offense." };
  }

  return { penaltyApplied: data as AntiCheatPenalty };
}
