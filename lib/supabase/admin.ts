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
export async function deleteProblemBank(id: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("problem_banks")
    .update({ is_deleted: true })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Admin action to soft-delete a competition.
 */
export async function deleteCompetition(id: string) {
  const admin = createAdminClient();
  if (!admin) return;

  // Deletion might fail if there are active participants (enforced by trigger/DB)
  const { error } = await admin
    .from("competitions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

/**
 * Admin action to force-pause or resume a competition.
 */
export async function toggleCompetitionPause(id: string, isPaused: boolean) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("competitions")
    .update({ is_paused: isPaused })
    .eq("id", id);

  if (error) throw error;
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
export async function approveOrganizerApplication(applicationId: string, userId: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error: appError } = await admin
    .from("organizer_applications")
    .update({ status: "approved" })
    .eq("id", applicationId);

  if (appError) throw appError;

  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "organizer" })
    .eq("id", userId);

  if (roleError) throw roleError;
}

/**
 * Reject an organizer application.
 */
export async function rejectOrganizerApplication(applicationId: string, reason: string) {
  const admin = createAdminClient();
  if (!admin) return;

  const { error } = await admin
    .from("organizer_applications")
    .update({ 
      status: "rejected",
      admin_notes: reason 
    })
    .eq("id", applicationId);

  if (error) throw error;
}
