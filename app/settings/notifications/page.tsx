import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationPreferencesShell } from "@/components/notifications/notification-preferences-shell";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from "@/components/notifications/types";
import { hasEnvVars } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type RawPreferenceRow = {
  announcements?: boolean | null;
  email_enabled?: boolean | null;
  in_app_enabled?: boolean | null;
  leaderboard_publication?: boolean | null;
  organizer_decisions?: boolean | null;
  registration_reminders?: boolean | null;
  score_recalculation?: boolean | null;
  team_invites?: boolean | null;
};

type PreferenceSnapshot = {
  error: string | null;
  preferences: NotificationPreferences;
};

function readChecked(formData: FormData, name: keyof NotificationPreferences) {
  return formData.get(name) === "on";
}

function normalizePreferences(row?: RawPreferenceRow | null): NotificationPreferences {
  return {
    announcements: row?.announcements ?? DEFAULT_NOTIFICATION_PREFERENCES.announcements,
    emailEnabled: row?.email_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled,
    inAppEnabled: row?.in_app_enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.inAppEnabled,
    leaderboardPublication:
      row?.leaderboard_publication ?? DEFAULT_NOTIFICATION_PREFERENCES.leaderboardPublication,
    organizerDecisions:
      row?.organizer_decisions ?? DEFAULT_NOTIFICATION_PREFERENCES.organizerDecisions,
    registrationReminders:
      row?.registration_reminders ?? DEFAULT_NOTIFICATION_PREFERENCES.registrationReminders,
    scoreRecalculation:
      row?.score_recalculation ?? DEFAULT_NOTIFICATION_PREFERENCES.scoreRecalculation,
    teamInvites: row?.team_invites ?? DEFAULT_NOTIFICATION_PREFERENCES.teamInvites,
  };
}

async function getUserId() {
  if (!hasEnvVars) {
    return null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return user.id;
}

async function fetchPreferenceSnapshot(): Promise<PreferenceSnapshot> {
  if (!hasEnvVars) {
    return {
      error: "Notification preferences require Supabase environment variables.",
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const result = await supabase
    .from("notification_preferences")
    .select(
      "in_app_enabled,email_enabled,team_invites,registration_reminders,announcements,leaderboard_publication,score_recalculation,organizer_decisions",
    )
    .eq("profile_id", user.id)
    .maybeSingle<RawPreferenceRow>();

  if (result.error) {
    return {
      error: "Stored notification preferences are temporarily unavailable. Default preferences are shown.",
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    };
  }

  return {
    error: null,
    preferences: normalizePreferences(result.data),
  };
}

async function saveNotificationPreferences(formData: FormData) {
  "use server";

  const userId = await getUserId();
  if (!userId) {
    redirect("/settings/notifications?status=unavailable");
  }

  const preferences: NotificationPreferences = {
    announcements: readChecked(formData, "announcements"),
    emailEnabled: readChecked(formData, "emailEnabled"),
    inAppEnabled: readChecked(formData, "inAppEnabled"),
    leaderboardPublication: readChecked(formData, "leaderboardPublication"),
    organizerDecisions: readChecked(formData, "organizerDecisions"),
    registrationReminders: readChecked(formData, "registrationReminders"),
    scoreRecalculation: readChecked(formData, "scoreRecalculation"),
    teamInvites: readChecked(formData, "teamInvites"),
  };

  const supabase = await createClient();
  const rpcResult = await supabase.rpc("update_notification_preferences", {
    p_announcements: preferences.announcements,
    p_email_enabled: preferences.emailEnabled,
    p_in_app_enabled: preferences.inAppEnabled,
    p_leaderboard_publication: preferences.leaderboardPublication,
    p_organizer_decisions: preferences.organizerDecisions,
    p_registration_reminders: preferences.registrationReminders,
    p_score_recalculation: preferences.scoreRecalculation,
    p_team_invites: preferences.teamInvites,
  });

  if (rpcResult.error) {
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        announcements: preferences.announcements,
        email_enabled: preferences.emailEnabled,
        in_app_enabled: preferences.inAppEnabled,
        leaderboard_publication: preferences.leaderboardPublication,
        organizer_decisions: preferences.organizerDecisions,
        registration_reminders: preferences.registrationReminders,
        score_recalculation: preferences.scoreRecalculation,
        team_invites: preferences.teamInvites,
        updated_at: new Date().toISOString(),
        profile_id: userId,
      },
      { onConflict: "profile_id" },
    );

    if (error) {
      redirect("/settings/notifications?status=unavailable");
    }
  }

  revalidatePath("/settings/notifications");
  redirect("/settings/notifications?status=saved");
}

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string | string[] }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const status = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0]
    : resolvedSearchParams.status;
  const snapshot = await fetchPreferenceSnapshot();

  return (
    <NotificationPreferencesShell
      action={saveNotificationPreferences}
      error={
        status === "unavailable"
          ? "Notification preferences could not be saved with the current backend schema."
          : snapshot.error
      }
      preferences={snapshot.preferences}
      saved={status === "saved"}
    />
  );
}
