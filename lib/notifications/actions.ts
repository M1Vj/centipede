"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasEnvVars } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedUserId() {
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

function revalidateNotificationSurfaces() {
  revalidatePath("/notifications");
  revalidatePath("/mathlete");
  revalidatePath("/organizer");
}

export async function markNotificationRead(formData: FormData) {
  const notificationId = String(formData.get("notification_id") ?? "");
  if (!notificationId) {
    return;
  }

  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return;
  }

  const supabase = await createClient();
  const rpcResult = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });

  if (rpcResult.error) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", notificationId)
      .eq("recipient_id", userId);
  }

  revalidateNotificationSurfaces();
}

export async function markAllNotificationsRead() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return;
  }

  const supabase = await createClient();
  const rpcResult = await supabase.rpc("mark_all_notifications_read");

  if (rpcResult.error) {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", userId)
      .is("read_at", null);
  }

  revalidateNotificationSurfaces();
}
