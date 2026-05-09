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

type NotificationPreviewSnapshot = {
  notifications: NotificationItem[];
  unreadCount: number;
  userId: string | null;
};

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

export async function fetchNotificationPreviewSnapshot(
  limit = 3,
): Promise<NotificationPreviewSnapshot> {
  if (!hasEnvVars) {
    return {
      notifications: [],
      unreadCount: 0,
      userId: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      notifications: [],
      unreadCount: 0,
      userId: null,
    };
  }

  const [notificationsResult, unreadResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id,type,title,body,link_path,read_at,created_at")
      .eq("recipient_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<RawNotificationRow[]>(),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
  ]);

  const notifications = notificationsResult.error
    ? []
    : (notificationsResult.data ?? [])
        .map(normalizeNotification)
        .filter((notification): notification is NotificationItem => Boolean(notification));

  return {
    notifications,
    unreadCount: unreadResult.count ?? notifications.filter((notification) => !notification.readAt).length,
    userId: user.id,
  };
}
