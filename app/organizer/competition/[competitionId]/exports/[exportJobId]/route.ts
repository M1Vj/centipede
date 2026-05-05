import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCompetitionExportJob } from "@/lib/exports/api";

type ActorProfile = {
  id: string;
  role: string;
  is_active: boolean | null;
};

type CompetitionOwnerRow = {
  id: string;
  organizer_id: string;
  is_deleted: boolean;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ code, message }, { status });
}

async function resolveActorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonError("unauthorized", "Authentication is required.", 401),
    } as const;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ActorProfile>();

  if (error) {
    return {
      response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500),
    } as const;
  }

  if (!profile || profile.is_active === false || (profile.role !== "organizer" && profile.role !== "admin")) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    } as const;
  }

  return { actor: profile } as const;
}

async function authorizeCompetition(input: {
  competitionId: string;
  actor: ActorProfile;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, organizer_id, is_deleted")
    .eq("id", input.competitionId)
    .maybeSingle<CompetitionOwnerRow>();

  if (error) {
    return {
      response: jsonError("competition_lookup_failed", "Unable to fetch competition.", 500),
    } as const;
  }

  if (!data || data.is_deleted) {
    return {
      response: jsonError("not_found", "Competition was not found.", 404),
    } as const;
  }

  if (input.actor.role !== "admin" && data.organizer_id !== input.actor.id) {
    return {
      response: jsonError("forbidden", "You do not have permission for this competition.", 403),
    } as const;
  }

  return { competition: data } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competitionId: string; exportJobId: string }> },
) {
  const actorContext = await resolveActorContext();
  if ("response" in actorContext) {
    return actorContext.response;
  }

  const { competitionId, exportJobId } = await params;
  const authorization = await authorizeCompetition({
    competitionId,
    actor: actorContext.actor,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return jsonError("service_unavailable", "Export status is temporarily unavailable.", 503);
  }

  const job = await getCompetitionExportJob({
    supabase: adminClient,
    competitionId,
    exportJobId,
  });

  if (!job) {
    return jsonError("not_found", "Export job was not found.", 404);
  }

  let downloadUrl: string | null = null;
  if (job.status === "completed" && job.storagePath) {
    const signedUrlResult = await adminClient.storage
      .from("competition-exports")
      .createSignedUrl(job.storagePath, 300);

    if (signedUrlResult.error) {
      return jsonError("download_unavailable", "Export download is temporarily unavailable.", 503);
    }

    downloadUrl = signedUrlResult.data.signedUrl;
  }

  return NextResponse.json({
    code: "ok",
    job: {
      id: job.id,
      competitionId: job.competitionId,
      requestedBy: job.requestedBy,
      format: job.format,
      scope: job.scope,
      status: job.status,
      downloadUrl,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      completedAt: job.completedAt,
    },
  });
}
