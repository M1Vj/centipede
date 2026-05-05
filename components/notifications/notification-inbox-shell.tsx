import { AlertCircle, Check, ChevronRight, MailOpen } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import type { NotificationItem } from "@/components/notifications/types";
import { cn } from "@/lib/utils";

type NotificationInboxShellProps = {
  error?: string | null;
  markAllAction: () => Promise<void> | void;
  markReadAction: (formData: FormData) => Promise<void> | void;
  notifications: NotificationItem[];
  unreadCount: number;
  warning?: string | null;
};

function formatNotificationDate(value: string | null) {
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

export function NotificationInboxShell({
  error,
  markAllAction,
  markReadAction,
  notifications,
  unreadCount,
  warning,
}: NotificationInboxShellProps) {
  const safeUnreadCount = Math.max(0, unreadCount);

  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] md:flex-row md:items-end md:justify-between md:p-7">
          <div className="space-y-2">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f49700]">
              Inbox
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
              Notifications
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-600">
              Competition, team, registration, leaderboard, and organizer updates land here first.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <span
              className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
              aria-live="polite"
            >
              {safeUnreadCount} unread
            </span>
            <form action={markAllAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full rounded-full border-slate-300 sm:w-auto"
                disabled={safeUnreadCount === 0}
                aria-label="Mark all notifications as read"
              >
                <Check className="size-4" />
                Mark all read
              </Button>
            </form>
          </div>
        </div>

        {warning ? (
          <Alert
            className="border-amber-200 bg-amber-50 text-amber-900"
            role="status"
            aria-live="polite"
          >
            <AlertCircle className="size-4" />
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <ErrorState
            title="Notifications unavailable"
            description={error}
            className="rounded-[24px] shadow-none"
          />
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={MailOpen}
            title="Inbox clear"
            description="No notifications yet. New competition and account updates will appear here."
            className="rounded-[24px] shadow-none"
          />
        ) : (
          <ol className="grid gap-3" aria-label="Notification list">
            {notifications.map((notification) => {
              const unread = !notification.readAt;
              const content = (
                <article
                  className={cn(
                    "grid gap-4 rounded-[22px] border bg-white p-4 shadow-sm transition sm:grid-cols-[1fr_auto] sm:items-center md:p-5",
                    unread ? "border-[#f49700]/40" : "border-slate-200",
                  )}
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {unread ? (
                        <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#f49700]" aria-label="Unread" />
                      ) : null}
                      <h2 className="text-base font-bold text-slate-950">
                        {notification.title}
                      </h2>
                    </div>
                    {notification.body ? (
                      <p className="text-sm leading-6 text-slate-600">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {formatNotificationDate(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    {notification.linkPath ? (
                      <ProgressLink
                        href={notification.linkPath}
                        className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/70"
                        aria-label={`Open ${notification.title} from ${formatNotificationDate(notification.createdAt)}`}
                      >
                        Open
                        <ChevronRight className="size-4" />
                      </ProgressLink>
                    ) : null}
                    {unread ? (
                      <form action={markReadAction}>
                        <input type="hidden" name="notification_id" value={notification.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          className="rounded-full"
                          aria-label={`Mark ${notification.title} as read`}
                        >
                          Mark read
                        </Button>
                      </form>
                    ) : (
                      <span className="inline-flex h-9 items-center rounded-full bg-slate-50 px-3 text-sm font-semibold text-slate-500">
                        Read
                      </span>
                    )}
                  </div>
                </article>
              );

              return <li key={notification.id}>{content}</li>;
            })}
          </ol>
        )}

        <ProgressLink
          href="/settings/notifications"
          className="inline-flex w-fit items-center gap-2 rounded-full text-sm font-semibold text-slate-700 underline-offset-4 hover:text-slate-950 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/70"
        >
          Notification preferences
          <ChevronRight className="size-4" />
        </ProgressLink>
      </div>
    </section>
  );
}
