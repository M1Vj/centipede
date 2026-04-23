import { Suspense } from "react";
import { getWorkspaceContext as getProtectedWorkspaceContext } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";


import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrganizerKpiGrid } from "@/components/dashboard/organizer-kpi-grid";
import { ActiveCompetitionsTable } from "@/components/dashboard/active-competitions-table";
import { CalendarWidget } from "@/components/dashboard/calendar-widget";
import { RecentActivityPanel } from "@/components/dashboard/recent-activity-panel";
import type {
  OrganizerActivityItem,
  OrganizerCalendarEvent,
  OrganizerCompetitionRow,
  OrganizerDashboardMetric,
} from "@/components/dashboard/types";

async function getWorkspaceContext() {
  return getProtectedWorkspaceContext({ requireRole: "organizer" });
}

import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";

type DashboardEventRow = {
  id: string;
  event_type: string | null;
  happened_at: string | null;
  competition_id?: { name?: string | null } | null;
};

type RegistrationRow = {
  competition_id: string | null;
  status?: string | null;
};

function isMissingRegistrationSchema(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || error.code === "42703" || message.includes("competition_registrations");
}

function formatCompactDate(dateValue: string | null) {
  if (!dateValue) {
    return "TBD";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildCompetitionSubtitle(competition: CompetitionRecord) {
  if (competition.description.trim()) {
    return competition.description;
  }

  if (competition.type === "scheduled") {
    return competition.format === "team"
      ? "Scheduled team competition"
      : "Scheduled individual competition";
  }

  return "Open competition";
}

function formatRelativeTimestamp(dateValue: string | null) {
  if (!dateValue) {
    return "Recently";
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function mapActivityTone(eventType: string | null): OrganizerActivityItem["tone"] {
  if (eventType === "published" || eventType === "started" || eventType === "resume") {
    return "success";
  }

  if (eventType === "ended" || eventType === "archived") {
    return "info";
  }

  return "default";
}

async function OrganizerPageContent() {
  const { userEmail, profile } = await getWorkspaceContext();
  const supabase = await createClient();

  let problemBankCount = 0;
  let problemCount = 0;
  let competitionCount = 0;
  let activeCompetitionCount = 0;
  let totalRegisteredParticipants = 0;
  let competitions: CompetitionRecord[] = [];
  let competitionRows: OrganizerCompetitionRow[] = [];
  let calendarEvents: OrganizerCalendarEvent[] = [];
  let recentActivity: OrganizerActivityItem[] = [];

  if (profile?.id) {
    const banksResult = await supabase
      .from("problem_banks")
      .select("id", { count: "exact" })
      .eq("organizer_id", profile.id)
      .eq("is_deleted", false);

    if (!banksResult.error) {
      problemBankCount = banksResult.count ?? 0;
      const bankIds = (banksResult.data ?? [])
        .map((bank) => bank.id)
        .filter((bankId): bankId is string => typeof bankId === "string");

      if (bankIds.length > 0) {
        const { count: problemsCount, error: problemsError } = await supabase
          .from("problems")
          .select("id", { count: "exact", head: true })
          .in("bank_id", bankIds)
          .eq("is_deleted", false);

        if (!problemsError) {
          problemCount = problemsCount ?? 0;
        }
      }
    }

    const primaryResult = await supabase
      .from("competitions")
      .select(COMPETITION_SELECT_COLUMNS)
      .eq("organizer_id", profile.id)
      .order("created_at", { ascending: false });

    const fallbackResult =
      primaryResult.error && isLegacyCompetitionSelectError(primaryResult.error)
        ? await supabase
            .from("competitions")
            .select(LEGACY_COMPETITION_SELECT_COLUMNS)
            .eq("organizer_id", profile.id)
            .order("created_at", { ascending: false })
        : null;

    const data = fallbackResult ? fallbackResult.data : primaryResult.data;
    const error = fallbackResult ? fallbackResult.error : primaryResult.error;

    if (!error) {
      competitions = (data ?? [])
        .map((row) => normalizeCompetitionRecord(row))
        .filter((row): row is CompetitionRecord => row !== null);
      competitionCount = competitions.length;
      activeCompetitionCount = competitions.filter((competition) =>
        competition.status !== "archived" && competition.status !== "ended",
      ).length;

      const competitionIds = competitions.map((competition) => competition.id);
      const registrationCounts = new Map<string, number>();

      if (competitionIds.length > 0) {
        const registrationsResult = await supabase
          .from("competition_registrations")
          .select("competition_id, status")
          .in("competition_id", competitionIds);

        if (!registrationsResult.error) {
          ((registrationsResult.data as RegistrationRow[] | null) ?? []).forEach((row) => {
            if (!row.competition_id || row.status === "withdrawn" || row.status === "cancelled") {
              return;
            }

            registrationCounts.set(
              row.competition_id,
              (registrationCounts.get(row.competition_id) ?? 0) + 1,
            );
          });
        } else if (!isMissingRegistrationSchema(registrationsResult.error)) {
          throw registrationsResult.error;
        }

        totalRegisteredParticipants = Array.from(registrationCounts.values()).reduce(
          (sum, count) => sum + count,
          0,
        );

        const lifecycleResult = await supabase
          .from("competition_events")
          .select("id, event_type, happened_at, competition_id(name)")
          .order("happened_at", { ascending: false })
          .limit(4);

        if (!lifecycleResult.error) {
          recentActivity = ((lifecycleResult.data ?? []) as DashboardEventRow[]).map((event) => ({
            id: event.id,
            message: `${event.competition_id?.name ?? "Competition"} ${event.event_type ?? "updated"}.`,
            timestampLabel: formatRelativeTimestamp(event.happened_at),
            tone: mapActivityTone(event.event_type),
          }));
        }

        if (recentActivity.length === 0) {
          recentActivity = competitions.slice(0, 4).map((competition) => ({
            id: competition.id,
            message: `${competition.name || "Competition"} updated in organizer workspace.`,
            timestampLabel: formatRelativeTimestamp(competition.updatedAt),
            tone: "default",
          }));
        }

        competitionRows = competitions
          .slice(0, 5)
          .map((competition) => ({
            id: competition.id,
            name: competition.name || "Untitled competition",
            subtitle: buildCompetitionSubtitle(competition),
            status: competition.status,
            registrationCount: registrationCounts.get(competition.id) ?? 0,
            capacity: competition.format === "team" ? competition.maxTeams : competition.maxParticipants,
            dateLabel: formatCompactDate(competition.startTime),
            href: `/organizer/competition/${competition.id}`,
          }));

        calendarEvents = competitions
          .filter((competition) => competition.type === "scheduled" && competition.startTime)
          .slice(0, 6)
          .map((competition) => ({
            id: competition.id,
            title: competition.name || "Competition",
            date: competition.startTime as string,
          }));
      }
    }
  }

  const metrics: OrganizerDashboardMetric[] = [
    {
      id: "active",
      label: "Total Active Competitions",
      value: activeCompetitionCount.toLocaleString(),
      hint: activeCompetitionCount > 0 ? "Active status" : "Awaiting launch",
      tone: "default",
    },
    {
      id: "participants",
      label: "Registered Participants",
      value: totalRegisteredParticipants.toLocaleString(),
      hint: competitionCount > 0 ? `${competitionCount} competitions` : "No competitions yet",
      tone: totalRegisteredParticipants > 0 ? "success" : "default",
    },
    {
      id: "bank",
      label: "Problems in Bank",
      value: problemCount.toLocaleString(),
      hint: problemBankCount > 0 ? `${problemBankCount} banks` : "No banks yet",
      tone: "default",
    },
  ];

  return (
    <section className="flex flex-col items-center px-4 pb-12">
      <DashboardHeader name={profile?.full_name || userEmail?.split("@")[0]} className="mt-12 mb-6" />

      <div className="w-full max-w-[1024px] flex flex-col gap-5">
        <OrganizerKpiGrid metrics={metrics} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ActiveCompetitionsTable competitions={competitionRows} className="lg:col-span-2" />
          <div className="flex flex-col gap-5">
            <CalendarWidget events={calendarEvents} />
            <RecentActivityPanel items={recentActivity} />
          </div>
        </div>
      </div>
    </section>
  );
}

function OrganizerPageFallback() {
  return (
    <section className="flex flex-col items-center px-4 pb-12">
      <div className="mt-12 mb-6 text-center">
        <div className="h-10 w-64 rounded-lg bg-slate-200/60 animate-pulse mx-auto" />
      </div>
      <div className="w-full max-w-[1024px] flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-[#f1f5f9] p-5 h-32 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-[#f1f5f9] h-64 animate-pulse" />
          <div className="flex flex-col gap-5">
            <div className="bg-white rounded-2xl border border-[#f1f5f9] h-48 animate-pulse" />
            <div className="bg-white rounded-2xl border border-[#f1f5f9] h-40 animate-pulse" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function OrganizerPage() {
  return (
    <Suspense fallback={<OrganizerPageFallback />}>
      <OrganizerPageContent />
    </Suspense>
  );
}
