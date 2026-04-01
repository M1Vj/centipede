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

  const { error } = await admin
    .from("problem_banks")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw error;

  await logAdminAction({
    actorId,
    actionType: "problem_bank_deleted",
    targetTable: "problem_banks",
    targetId: id,
    description: "Soft-deleted problem bank",
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
    admin.from("profiles").select("*", { count: "exact", head: true }),
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

/**
 * Approve an organizer application.
 * Promotes the user to 'organizer' and updates application status.
 */
export async function approveOrganizerApplication(
  applicationId: string,
  profileId: string,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error: appError } = await admin
    .from("organizer_applications")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (appError) throw appError;

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "organizer", approved_at: new Date().toISOString() })
    .eq("id", profileId);

  if (roleError) throw roleError;

  await logAdminAction({
    actorId,
    actionType: "organizer_application_approved",
    targetTable: "organizer_applications",
    targetId: applicationId,
    description: "Approved organizer application",
    metadata: { profileId },
  });
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
  if (!admin) return;

  const { error } = await admin
    .from("organizer_applications")
    .update({
      status: "rejected",
      rejection_reason: reason,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) throw error;

  await logAdminAction({
    actorId,
    actionType: "organizer_application_rejected",
    targetTable: "organizer_applications",
    targetId: applicationId,
    description: "Rejected organizer application",
    metadata: { reason },
  });
}

export async function setUserActiveStatus(
  userId: string,
  isActive: boolean,
  actorId?: string,
) {
  const admin = createAdminClient();
  if (!admin) return;

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
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;

  await logAdminAction({
    actorId,
    actionType: "user_purged",
    targetTable: "auth.users",
    targetId: userId,
    description: "Permanently deleted user",
  });
}

type UpdateUserInput = {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  actorId?: string;
};

export async function updateUserProfile({
  userId,
  fullName,
  email,
  role,
  actorId,
}: UpdateUserInput) {
  const admin = createAdminClient();
  if (!admin) return;

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = fullName.trim();
  const { error } = await admin
    .from("profiles")
    .update({
      full_name: normalizedName,
      email: normalizedEmail,
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
