import { createAdminClient } from "@/lib/supabase/admin";

export type CompetitionEventNoticeTone = "info" | "warning" | "error";

export type CompetitionEventNotice = {
  id: string;
  title: string;
  message: string;
  tone: CompetitionEventNoticeTone;
  happenedAt: string;
};

type CompetitionEventRow = {
  id: string;
  event_type: string | null;
  control_action: string | null;
  happened_at: string;
  metadata_json: Record<string, unknown> | null;
};

function toMessage(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return fallback;
}

export function mapCompetitionEventNotice(event: CompetitionEventRow): CompetitionEventNotice | null {
  const eventKey = event.event_type ?? event.control_action ?? "";

  if (eventKey === "competition_schedule_changed") {
    return {
      id: event.id,
      title: "Schedule updated",
      message: toMessage(
        event.metadata_json?.summary,
        "The competition schedule changed. Review the latest timing details before you participate.",
      ),
      tone: "info",
      happenedAt: event.happened_at,
    };
  }

  if (eventKey === "competition_cancelled") {
    return {
      id: event.id,
      title: "Competition cancelled",
      message: toMessage(
        event.metadata_json?.reason,
        "This competition was cancelled by the organizer or system.",
      ),
      tone: "error",
      happenedAt: event.happened_at,
    };
  }

  return null;
}

export async function fetchCompetitionEventNotices(competitionId: string): Promise<CompetitionEventNotice[]> {
  const admin = createAdminClient();
  if (!admin) {
    return [];
  }

  const { data, error } = await admin
    .from("competition_events")
    .select("id, event_type, control_action, happened_at, metadata_json")
    .eq("competition_id", competitionId)
    .in("event_type", ["competition_schedule_changed", "competition_cancelled"])
    .order("happened_at", { ascending: false })
    .limit(5);

  if (error) {
    return [];
  }

  return ((data ?? []) as CompetitionEventRow[])
    .map(mapCompetitionEventNotice)
    .filter((notice): notice is CompetitionEventNotice => notice !== null)
    .slice(0, 3);
}