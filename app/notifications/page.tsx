import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NotificationInboxShell } from "@/components/notifications/notification-inbox-shell";
import type { NotificationItem } from "@/components/notifications/types";
import { hasEnvVars } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

type RawNotificationRow = {
  body?: string | null;
  created_at?: string | null;
  id?: string | null;
  link_path?: string | null;
  read_at?: string | null;
  title?: string | null;
  type?: string | null;
};

type InboxSnapshot = {
  error: string | null;
  notifications: NotificationItem[];
  unreadCount: number;
  warning: string | null;
};

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

function normalizeNotification(row: RawNotificationRow): NotificationItem | null {
  if (!row.id || !row.title) {
    return null;
  }

  return {
    body: row.body ?? null,
    createdAt: row.created_at ?? null,
    id: row.id,
    linkPath: row.link_path ?? null,
    readAt: row.read_at ?? null,
    title: row.title,
    type: row.type ?? null,
  };
}

async function fetchInboxSnapshot(): Promise<InboxSnapshot> {
  if (!hasEnvVars) {
    return {
      error: "Notifications require Supabase environment variables.",
      notifications: [],
      unreadCount: 0,
      warning: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const notificationsResult = await supabase
    .from("notifications")
    .select("id,type,title,body,link_path,read_at,created_at")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<RawNotificationRow[]>();

  if (notificationsResult.error) {
    return {
      error: "Notifications are temporarily unavailable.",
      notifications: [],
      unreadCount: 0,
      warning: null,
    };
  }

  const unreadResult = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", user.id)
    .is("read_at", null);

  const notifications = (notificationsResult.data ?? [])
    .map(normalizeNotification)
    .filter((notification): notification is NotificationItem => Boolean(notification));

  return {
    error: null,
    notifications,
    unreadCount: unreadResult.count ?? notifications.filter((notification) => !notification.readAt).length,
    warning: unreadResult.error ? "Unread count is temporarily unavailable." : null,
  };
}

async function markNotificationRead(formData: FormData) {
  "use server";

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

  revalidatePath("/notifications");
  revalidatePath("/mathlete");
  revalidatePath("/organizer");
}

async function markAllNotificationsRead() {
  "use server";

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

  revalidatePath("/notifications");
  revalidatePath("/mathlete");
  revalidatePath("/organizer");
}

export default async function NotificationsPage() {
  const snapshot = await fetchInboxSnapshot();

  return (
    <NotificationInboxShell
      error={snapshot.error}
      markAllAction={markAllNotificationsRead}
      markReadAction={markNotificationRead}
      notifications={snapshot.notifications}
      unreadCount={snapshot.unreadCount}
      warning={snapshot.warning}
    />
  );
}
