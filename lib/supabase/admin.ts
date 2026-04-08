import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

/**
 * Server-only admin client using the service role key.
 * Used for administrative tasks that bypass RLS or require elevated permissions.
 */
export function createAdminClient() {
  const { supabaseUrl, supabaseServiceKey } = getSupabaseEnv();

  if (!supabaseServiceKey) {
    // In build/prerender phase, we return null to allow dynamic pages to build without keys
    if (process.env.NEXT_PHASE === "phase-production-build") {
      return null;
    }

    // During development or runtime, log a warning and return null instead of throwing
    // This prevents the entire dashboard from crashing if the key is not yet configured
    console.warn(
      "Warning: SUPABASE_SERVICE_ROLE_KEY is missing. Admin actions will be disabled."
    );
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Admin action to soft-delete a problem bank.
 */
export async function deleteProblemBank(id: string, actorId?: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { data, error } = await admin
    .from("problem_banks")
    .update({ is_deleted: true })
    .eq("id", id)
    .eq("is_deleted", false)
    .select("id, is_default_bank")
    .maybeSingle<{ id: string; is_default_bank: boolean }>();

  if (error) throw error;

  const alreadyDeleted = !data;

  await logAdminAction({
    actorId,
    actionType: "problem_bank_deleted",
    targetTable: "problem_banks",
    targetId: id,
    description: "Soft-deleted problem bank",
    metadata: {
      softDelete: true,
      idempotentReplay: alreadyDeleted,
      isDefaultBank: data?.is_default_bank ?? null,
    },
  });
}

/**
 * Admin action to soft-delete a competition.
 */
export async function deleteCompetition(id: string, actorId?: string) {
  const admin = createAdminClient();
  if (!admin) return;

  // Deletion might fail if there are active participants (enforced by trigger/DB)
  const { error } = await admin
    .from("competitions")
    .delete()
    .eq("id", id);

  if (error) throw error;

  if (actorId) {
    await admin
      .from("competition_events")
      .insert({
        competition_id: id,
        event_type: "deleted",
        actor_user_id: actorId,
      });
  }
}

/**
 * Admin action to force-pause or resume a competition.
 */
export async function toggleCompetitionPause(
  id: string,
  isPaused: boolean,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("competitions")
    .update({ is_paused: isPaused })
    .eq("id", id);

  if (error) throw error;

  if (actorId) {
    await admin
      .from("competition_events")
      .insert({
        competition_id: id,
        event_type: isPaused ? "paused" : "resumed",
        actor_user_id: actorId,
      });
  }
}

type AdminAuditInput = {
  actorId?: string;
  actionType: string;
  targetTable?: string;
  targetId?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
};

async function logAdminAction({
  actorId,
  actionType,
  targetTable,
  targetId,
  description,
  metadata,
}: AdminAuditInput) {
  const admin = createAdminClient();
  if (!admin || !actorId) return;

  await admin.from("admin_audit_logs").insert({
    actor_user_id: actorId,
    action_type: actionType,
    target_table: targetTable,
    target_id: targetId ?? null,
    description: description ?? null,
    metadata: metadata ?? null,
  });
}

/**
 * Fetch aggregate statistics for the admin dashboard.
 */
export async function getAdminStats() {
  const admin = createAdminClient();
  
  if (!admin) {
    return {
      users: 0,
      pendingApplications: 0,
      activeCompetitions: 0,
      problemBanks: 0,
    };
  }

  const [
    { count: usersCount },
    { count: applicationsCount },
    { count: competitionCount },
    { count: bankCount }
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }).not("email", "like", "%@anon.invalid"),
    admin.from("organizer_applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("competitions").select("*", { count: "exact", head: true }),
    admin.from("problem_banks").select("*", { count: "exact", head: true }).eq("is_deleted", false)
  ]);

  return {
    users: usersCount || 0,
    pendingApplications: applicationsCount || 0,
    activeCompetitions: competitionCount || 0,
    problemBanks: bankCount || 0,
  };
}

type ApproveAndProvisionMachineCode =
  | "ok"
  | "not_found"
  | "not_pending"
  | "profile_required"
  | "profile_not_found"
  | "profile_email_mismatch";

type ApproveAndProvisionRpcRow = {
  machine_code: ApproveAndProvisionMachineCode;
  application_id: string;
  profile_id?: string | null;
  resolved_profile_id?: string | null;
  activated: boolean;
};

type OrganizerApplicationStatus = "pending" | "approved" | "rejected";

type OrganizerApplicationStatusRow = {
  id: string;
  status: OrganizerApplicationStatus;
};

function getApproveProvisionError(machineCode: Exclude<ApproveAndProvisionMachineCode, "ok">) {
  switch (machineCode) {
    case "not_found":
      return "Application not found.";
    case "not_pending":
      return "Only pending applications can be approved.";
    case "profile_required":
      return "A linked profile is required before approval can continue.";
    case "profile_not_found":
      return "Linked profile could not be found. Retry after syncing identity.";
    case "profile_email_mismatch":
      return "Profile email does not match the application contact email.";
  }
}

/**
 * Approve an organizer application.
 * Records an approval decision and audit trail for the application.
 */
export async function approveOrganizerApplication(
  applicationId: string,
  profileId?: string,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Admin service is unavailable.");
  }

  const { data, error } = await admin.rpc("approve_and_provision_organizer_application", {
    p_application_id: applicationId,
    p_profile_id: profileId ?? null,
  });

  if (error) {
    throw error;
  }

  const result = (data as ApproveAndProvisionRpcRow[] | null)?.[0];
  if (!result) {
    throw new Error("Unable to approve organizer application.");
  }

  if (result.machine_code !== "ok") {
    throw new Error(getApproveProvisionError(result.machine_code));
  }

  const resolvedProfileId = result.profile_id ?? result.resolved_profile_id ?? null;

  await logAdminAction({
    actorId,
    actionType: "organizer_application_approved",
    targetTable: "organizer_applications",
    targetId: applicationId,
    description: "Approved organizer application",
    metadata: {
      profileId: resolvedProfileId,
      activated: result.activated,
      machineCode: result.machine_code,
    },
  });

  return {
    applicationId: result.application_id,
    profileId: resolvedProfileId,
    activated: result.activated,
    machineCode: result.machine_code,
  };
}

/**
 * Reject an organizer application.
 */
export async function rejectOrganizerApplication(
  applicationId: string,
  reason: string,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Admin service is unavailable.");
  }

  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new Error("Rejection reason is required.");
  }

  const { data, error } = await admin
    .from("organizer_applications")
    .update({
      status: "rejected",
      rejection_reason: normalizedReason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
    .eq("status", "pending")
    .select("id,status")
    .maybeSingle<OrganizerApplicationStatusRow>();

  if (error) {
    throw error;
  }

  if (!data) {
    const { data: existingApplication, error: loadError } = await admin
      .from("organizer_applications")
      .select("id,status")
      .eq("id", applicationId)
      .maybeSingle<OrganizerApplicationStatusRow>();

    if (loadError) {
      throw loadError;
    }

    if (!existingApplication) {
      throw new Error("Application not found.");
    }

    if (existingApplication.status === "rejected") {
      await logAdminAction({
        actorId,
        actionType: "organizer_application_rejected",
        targetTable: "organizer_applications",
        targetId: applicationId,
        description: "Rejected organizer application",
        metadata: {
          reason: normalizedReason,
          idempotentReplay: true,
        },
      });

      return;
    }

    throw new Error("Only pending applications can be rejected.");
  }

  await logAdminAction({
    actorId,
    actionType: "organizer_application_rejected",
    targetTable: "organizer_applications",
    targetId: applicationId,
    description: "Rejected organizer application",
    metadata: { reason: normalizedReason },
  });
}

export async function rotateSessionVersion(profileId: string) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("rotate_session_version", {
    profile_id: profileId,
  });

  if (error) throw error;

  return data as number | null;
}

export async function updateMathleteProfileSettings(
  profileId: string,
  school: string,
  gradeLevel: string,
) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("update_mathlete_profile_settings", {
    profile_id: profileId,
    next_school: school,
    next_grade_level: gradeLevel,
  });

  if (error) throw error;

  return data;
}

export async function anonymizeUserAccount(
  targetProfileId: string,
  reason: string,
  requestIdempotencyToken: string,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) return null;

  const trimmedReason = reason.trim();
  const trimmedToken = requestIdempotencyToken.trim();

  if (!trimmedReason) {
    throw new Error("Anonymization reason is required.");
  }

  if (!trimmedToken) {
    throw new Error("Anonymization idempotency token is required.");
  }

  const { data, error } = await admin.rpc("anonymize_user_account", {
    target_profile_id: targetProfileId,
    reason: trimmedReason,
    request_idempotency_token: trimmedToken,
  });

  if (error) throw error;

  const anonymizedProfile =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { email?: string | null })
      : null;

  if (anonymizedProfile?.email) {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      targetProfileId,
      {
        email: anonymizedProfile.email,
        email_confirm: true,
        user_metadata: {
          full_name: "Deleted User",
        },
      },
    );

    if (authUpdateError) {
      throw authUpdateError;
    }
  }

  await logAdminAction({
    actorId,
    actionType: "user_anonymized",
    targetTable: "profiles",
    targetId: targetProfileId,
    description: "Anonymized user account",
    metadata: {
      reason: trimmedReason,
      requestIdempotencyToken: trimmedToken,
    },
  });

  return data;
}

export async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;
  if (profile.email?.endsWith("@anon.invalid")) {
    throw new Error("Cannot explicitly change activation status of an anonymized account.");
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) throw error;

  await logAdminAction({
    actorId,
    actionType: isActive ? "user_reactivated" : "user_suspended",
    targetTable: "profiles",
    targetId: userId,
    description: isActive ? "Reactivated user account" : "Suspended user account",
  });
}

export async function purgeUser(
  userId: string,
  actorId?: string,
) {
  return anonymizeUserAccount(
    userId,
    "Administrative non-spam account removal",
    `purge-user:${userId}`,
    actorId,
  );
}

type UpdateUserInput = {
  userId: string;
  fullName: string;
  role: string;
  actorId?: string;
};

export async function updateUserProfile({
  userId,
  fullName,
  role,
  actorId,
}: UpdateUserInput) {
  const admin = createAdminClient();
  if (!admin) return;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .single();

  if (profileError) throw profileError;
  if (profile.email?.endsWith("@anon.invalid")) {
    throw new Error("Cannot update an anonymized account.");
  }

  const normalizedName = fullName.trim();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: normalizedName,
      role,
    })
    .eq("id", userId);

  if (error) throw error;

  await logAdminAction({
    actorId,
    actionType: "user_profile_updated",
    targetTable: "profiles",
    targetId: userId,
    description: "Updated user profile fields",
    metadata: { role },
  });
}
