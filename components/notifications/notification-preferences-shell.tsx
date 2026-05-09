import { BellRing, Mail, MonitorCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { NotificationPreferences } from "@/components/notifications/types";

type NotificationPreferencesShellProps = {
  action: (formData: FormData) => Promise<void> | void;
  error?: string | null;
  preferences: NotificationPreferences;
  saved?: boolean;
};

type PreferenceToggle = {
  description: string;
  label: string;
  name: keyof NotificationPreferences;
};

const channelToggles: PreferenceToggle[] = [
  {
    description: "Inbox delivery for events eligible for user channel preferences.",
    label: "In-app notifications",
    name: "inAppEnabled",
  },
  {
    description: "Email delivery for eligible events only when category also stays enabled.",
    label: "Email notifications",
    name: "emailEnabled",
  },
];

const categoryToggles: PreferenceToggle[] = [
  {
    description: "Invitations, acceptances, declines, and roster invalidation notices.",
    label: "Team invites",
    name: "teamInvites",
  },
  {
    description: "Registration confirmations, withdrawals, and reminder-style updates.",
    label: "Registration reminders",
    name: "registrationReminders",
  },
  {
    description: "Organizer announcements for competitions where you are a resolved recipient.",
    label: "Announcements",
    name: "announcements",
  },
  {
    description: "Leaderboard publication and dispute-resolution updates.",
    label: "Leaderboard publication",
    name: "leaderboardPublication",
  },
  {
    description: "Score recalculation messages. These stay inbox-first and never require email.",
    label: "Score recalculation",
    name: "scoreRecalculation",
  },
  {
    description: "Account-linked organizer application decisions and status events.",
    label: "Organizer decisions",
    name: "organizerDecisions",
  },
];

function ToggleRow({
  description,
  label,
  name,
  preferences,
}: PreferenceToggle & { preferences: NotificationPreferences }) {
  const id = `notification_${name}`;

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={preferences[name]}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 accent-[#f49700] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]/70"
      />
      <div className="grid gap-1">
        <Label htmlFor={id} className="font-bold text-slate-900">
          {label}
        </Label>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export function NotificationPreferencesShell({
  action,
  error,
  preferences,
  saved,
}: NotificationPreferencesShellProps) {
  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.55)] md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#f49700]">
                Settings
              </p>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Notification preferences
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                Choose channels and categories for preference-governed notifications. Mandatory inbox events still appear when required by product rules.
              </p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a1e2e] text-[#f49700]">
              <BellRing className="size-5" />
            </div>
          </div>
        </div>

        {error ? (
          <Alert role="alert" aria-live="assertive">
            <BellRing className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {saved ? (
          <Alert role="status" aria-live="polite">
            <MonitorCheck className="size-4" />
            <AlertDescription>Notification preferences saved.</AlertDescription>
          </Alert>
        ) : null}

        <form action={action} className="space-y-6">
          <section className="space-y-3" aria-labelledby="notification-channels">
            <div className="flex items-center gap-2">
              <MonitorCheck className="size-4 text-[#f49700]" />
              <h2 id="notification-channels" className="text-lg font-bold text-slate-950">
                Channels
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {channelToggles.map((toggle) => (
                <ToggleRow key={toggle.name} {...toggle} preferences={preferences} />
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="notification-categories">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-[#f49700]" />
              <h2 id="notification-categories" className="text-lg font-bold text-slate-950">
                Event categories
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {categoryToggles.map((toggle) => (
                <ToggleRow key={toggle.name} {...toggle} preferences={preferences} />
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <Button type="submit" className="rounded-full">
              Save preferences
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
}
