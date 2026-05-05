"use client";

import { Bell, Inbox, Settings } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NotificationBellDropdownProps = {
  label?: string;
  unreadCount?: number | null;
};

export function NotificationBellDropdown({
  label = "Notifications",
  unreadCount,
}: NotificationBellDropdownProps) {
  const safeUnreadCount = Math.max(0, unreadCount ?? 0);
  const hasUnread = safeUnreadCount > 0;
  const accessibleLabel = hasUnread
    ? `${label}, ${safeUnreadCount} unread`
    : label;

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
      <DropdownMenuContent align="end" className="w-72 rounded-2xl border-slate-200 p-2.5">
        <DropdownMenuLabel className="px-3 py-2 text-sm font-semibold text-slate-900">
          Notifications
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5">
          <ProgressLink
            href="/notifications"
            className="flex w-full items-center gap-3 text-sm font-semibold text-slate-700"
          >
            <Inbox className="size-4" />
            <span>View inbox</span>
          </ProgressLink>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-xl px-3 py-2.5">
          <ProgressLink
            href="/settings/notifications"
            className="flex w-full items-center gap-3 text-sm font-semibold text-slate-700"
          >
            <Settings className="size-4" />
            <span>Notification settings</span>
          </ProgressLink>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-3 py-2 text-xs leading-5 text-slate-500">
          {hasUnread
            ? `${safeUnreadCount} unread update${safeUnreadCount === 1 ? "" : "s"} waiting.`
            : "No unread notifications."}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
