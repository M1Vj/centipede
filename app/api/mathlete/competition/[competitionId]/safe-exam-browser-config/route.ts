import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import { buildSafeExamBrowserConfig } from "@/lib/safe-exam-browser";

const VISIBLE_STATUSES = new Set(["published", "live", "paused"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function filenameSafe(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "mathwiz-competition";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ competitionId: string }> },
) {
  const { competitionId } = await context.params;
  if (!UUID_PATTERN.test(competitionId)) {
    return Response.json({ code: "not_found", message: "SEB config is not available." }, { status: 404 });
  }

  const supabase = await createClient();

  const primary = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .maybeSingle();

  let rawCompetition: unknown = primary.data;
  if (primary.error) {
    if (!isLegacyCompetitionSelectError(primary.error)) {
      throw primary.error;
    }

    const fallback = await supabase
      .from("competitions")
      .select(LEGACY_COMPETITION_SELECT_COLUMNS)
      .eq("id", competitionId)
      .maybeSingle();

    if (fallback.error) {
      throw fallback.error;
    }

    rawCompetition = fallback.data;
  }

  const competition = normalizeCompetitionRecord(rawCompetition);
  if (
    !competition ||
    competition.isDeleted ||
    !VISIBLE_STATUSES.has(competition.status) ||
    competition.safeExamBrowserMode !== "required"
  ) {
    return Response.json({ code: "not_found", message: "SEB config is not available." }, { status: 404 });
  }

  const origin = new URL(request.url).origin;
  const startUrl = `${origin}/mathlete/competition/${competition.id}`;
  const config = buildSafeExamBrowserConfig({
    startUrl,
    quitUrl: `${origin}/mathlete/competition`,
    allowedUrlOrigin: origin,
  });

  return new Response(config, {
    headers: {
      "content-type": "application/seb",
      "content-disposition": `attachment; filename="${filenameSafe(competition.name)}.seb"`,
      "cache-control": "private, no-store",
    },
  });
}
