"use client";

import { Bell, CheckCircle2, Settings } from "lucide-react";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationItem } from "@/components/notifications/types";
import { cn } from "@/lib/utils";

type NotificationBellDropdownProps = {
  label?: string;
  markAllAction?: () => Promise<void> | void;
  notifications?: NotificationItem[] | null;
  unreadCount?: number | null;
};

function formatPreviewDate(value: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function NotificationBellDropdown({
  label = "Notifications",
  markAllAction,
  notifications,
  unreadCount,
}: NotificationBellDropdownProps) {
  const safeUnreadCount = Math.max(0, unreadCount ?? 0);
  const hasUnread = safeUnreadCount > 0;
  const accessibleLabel = hasUnread
    ? `${label}, ${safeUnreadCount} unread`
    : label;
  const previewNotifications = (notifications ?? []).slice(0, 3);
  const hasPreviewNotifications = previewNotifications.length > 0;
  const allPreviewNotificationsRead =
    hasPreviewNotifications &&
    !hasUnread &&
    previewNotifications.every((notification) => Boolean(notification.readAt));

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-[#f49700] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f121a]"
          aria-label={accessibleLabel}
        >
          <Bell className="h-5 w-5" />
          {hasUnread ? (
            <span
              className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white"
              aria-hidden="true"
            >
              {safeUnreadCount > 99 ? "99+" : safeUnreadCount}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="!max-h-none !overflow-visible w-[21rem] rounded-[24px] border border-slate-200 bg-white p-3 shadow-xl shadow-slate-900/10"
      >
        <DropdownMenuLabel className="px-2 pb-2 pt-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-950">Notifications</p>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {hasUnread
                  ? `${safeUnreadCount} unread update${safeUnreadCount === 1 ? "" : "s"}`
                  : hasPreviewNotifications
                    ? "All notifications read"
                    : "No unread notifications"}
              </p>
            </div>
            <ProgressLink
              href="/notifications"
              className="shrink-0 text-xs font-bold text-[#f49700] underline-offset-4 hover:text-[#e08900] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/70"
            >
              View inbox
            </ProgressLink>
          </div>
        </DropdownMenuLabel>
        {markAllAction ? (
          <>
            <form action={markAllAction} className="px-2 pb-2">
              <MarkAllReadButton
                allRead={allPreviewNotificationsRead}
                size="sm"
                className="w-full rounded-xl border-slate-200 text-slate-700"
                disabled={!hasUnread}
              />
            </form>
            <DropdownMenuSeparator className="my-1 bg-slate-100" />
          </>
        ) : (
          <DropdownMenuSeparator className="my-1 bg-slate-100" />
        )}
        {hasPreviewNotifications ? (
          <div
            className="space-y-1 py-1"
            aria-label="Recent notifications"
          >
            {previewNotifications.map((notification) => {
              const unread = !notification.readAt;

              return (
                <article
                  key={notification.id}
                  className={cn(
                    "rounded-2xl border px-3 py-2.5 text-left transition-all duration-300 hover:shadow-sm",
                    unread
                      ? "border-[#f49700]/40 bg-white hover:border-[#f49700]/60 hover:bg-slate-50/70"
                      : "border-emerald-100 bg-emerald-50/35 hover:border-emerald-200 hover:bg-emerald-50/60",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-2 h-2 w-2 flex-none">
                      {unread ? (
                        <span
                          className="block h-2 w-2 rounded-full bg-[#f49700]"
                          aria-label="Unread"
                        />
                      ) : null}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <h2 className="line-clamp-1 flex-1 text-sm font-bold leading-5 text-slate-950">
                          {notification.title}
                        </h2>
                        <span
                          className={cn(
                            "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-bold",
                            unread
                              ? "bg-[#f49700]/10 text-[#9a5b00]"
                              : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
                          )}
                        >
                          {unread ? null : <CheckCircle2 className="size-3" />}
                          {unread ? "Unread" : "Read"}
                        </span>
                      </div>
                      {notification.body ? (
                        <p className="line-clamp-1 text-xs leading-4 text-slate-600">
                          {notification.body}
                        </p>
                      ) : null}
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        {formatPreviewDate(notification.createdAt)}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="px-3 py-3 text-sm leading-5 text-slate-500">
            No recent notifications.
          </p>
        )}
        <DropdownMenuSeparator className="my-1 bg-slate-100" />
        <DropdownMenuItem asChild className="rounded-xl px-2 py-2">
          <ProgressLink
            href="/settings/notifications"
            className="flex w-full items-center gap-2 text-xs font-semibold text-slate-600 transition hover:text-slate-950"
          >
            <Settings className="size-3.5" />
            <span>Notification settings</span>
          </ProgressLink>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
