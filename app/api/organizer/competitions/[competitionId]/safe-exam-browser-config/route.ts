import {
  fetchCompetition,
  jsonDatabaseError,
  requireOrganizerCompetitionActor,
} from "@/app/api/organizer/competitions/_shared";
import { buildSafeExamBrowserConfig } from "@/lib/safe-exam-browser";

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
  const actorResult = await requireOrganizerCompetitionActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const { competitionId } = await context.params;
  if (!UUID_PATTERN.test(competitionId)) {
    return Response.json({ code: "not_found", message: "Requested resource was not found." }, { status: 404 });
  }

  const competitionResult = await fetchCompetition(
    actorResult.supabase,
    competitionId,
    actorResult.actor.userId,
  );
  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  try {
    const origin = new URL(request.url).origin;
    const config = buildSafeExamBrowserConfig({
      startUrl: `${origin}/mathlete/competition/${competitionResult.competition.id}`,
      quitUrl: `${origin}/mathlete/competition`,
      allowedUrlOrigin: origin,
    });

    return new Response(config, {
      headers: {
        "content-type": "application/seb",
        "content-disposition": `attachment; filename="${filenameSafe(competitionResult.competition.name)}.seb"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}
