import { redirect } from "next/navigation";
import { NotificationInboxShell } from "@/components/notifications/notification-inbox-shell";
import type { NotificationItem } from "@/components/notifications/types";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/actions";
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
  role: string | null;
  unreadCount: number;
  warning: string | null;
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

async function fetchInboxSnapshot(): Promise<InboxSnapshot> {
  if (!hasEnvVars) {
    return {
      error: "Notifications require Supabase environment variables.",
      notifications: [],
      role: null,
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
      role: null,
      unreadCount: 0,
      warning: null,
    };
  }

  const [unreadResult, profileResult] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", user.id)
      .is("read_at", null),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle<{ role?: string | null }>(),
  ]);

  const notifications = (notificationsResult.data ?? [])
    .map(normalizeNotification)
    .filter((notification): notification is NotificationItem => Boolean(notification));

  return {
    error: null,
    notifications,
    role: profileResult.data?.role ?? null,
    unreadCount: unreadResult.count ?? notifications.filter((notification) => !notification.readAt).length,
    warning: unreadResult.error ? "Unread count is temporarily unavailable." : null,
  };
}

export default async function NotificationsPage() {
  const snapshot = await fetchInboxSnapshot();

  return (
    <NotificationInboxShell
      error={snapshot.error}
      markAllAction={markAllNotificationsRead}
      markReadAction={markNotificationRead}
      notifications={snapshot.notifications}
      role={snapshot.role}
      unreadCount={snapshot.unreadCount}
      warning={snapshot.warning}
    />
  );
}
