import { getWorkspaceContext as getProtectedWorkspaceContext } from "@/lib/auth/workspace";
import { MathleteDashboardOverview } from "@/components/mathlete/dashboard-overview";
import { UpcomingCompetitionRefresh } from "@/components/mathlete/upcoming-competition-refresh";
import type {
  MathleteActivityItem,
  MathleteLiveCard,
  MathleteRegistrationCard,
  MathleteUpcomingCard,
} from "@/components/mathlete/dashboard-overview";
import { listMyRegistrationDetails } from "@/lib/registrations/api";
import type { RegistrationCompetitionSummary, RegistrationDetail } from "@/lib/registrations/types";
import { runDueScheduledCompetitionLifecycleSafely } from "@/lib/competition/scheduled-start";

async function getWorkspaceContext() {
  return getProtectedWorkspaceContext({ requireRole: "mathlete" });
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

function buildCountdown(targetValue: string | null, now = Date.now()): MathleteUpcomingCard["countdown"] {
  const target = targetValue ? new Date(targetValue).getTime() : Number.NaN;
  if (Number.isNaN(target)) {
    return { days: "00", hours: "00", minutes: "00" };
  }

  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return { days: "00", hours: "00", minutes: "00" };
  }

  const totalMinutes = Math.max(0, Math.ceil(remainingMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
  };
}

function formatMode(competition: RegistrationCompetitionSummary) {
  if (competition.format === "team") {
    return "Team";
  }

  return "Individual";
}

function hasEndedByClock(competition: RegistrationCompetitionSummary, now = Date.now()) {
  if (!competition.endTime) {
    return false;
  }

  const end = new Date(competition.endTime).getTime();
  return !Number.isNaN(end) && end <= now;
}

function isUpcomingByClock(competition: RegistrationCompetitionSummary, now = Date.now()) {
  if (!competition.startTime) {
    return false;
  }

  const start = new Date(competition.startTime).getTime();
  if (Number.isNaN(start)) {
    return false;
  }

  return start > now;
}

function buildRegistrationCards(
  rows: RegistrationDetail[],
): {
  liveCards: MathleteLiveCard[];
  upcomingCards: MathleteUpcomingCard[];
  registrationCards: MathleteRegistrationCard[];
  activityItems: MathleteActivityItem[];
} {
  const now = Date.now();
  const registeredCompetitions = rows
    .filter(
      (row) =>
        row.status === "registered" &&
        row.competition &&
        (row.competition.status === "published" ||
          row.competition.status === "live" ||
          row.competition.status === "paused") &&
        !hasEndedByClock(row.competition, now),
    )
    .map((row) => ({
      registration: row,
      competition: row.competition as RegistrationCompetitionSummary,
    }));

  const liveCards = registeredCompetitions
    .filter(({ competition }) => competition.status === "live" || competition.status === "paused")
    .map(({ competition }) => ({
      id: competition.id,
      title: competition.name || "Untitled competition",
      mode: formatMode(competition),
      enrolled: "Registered",
      action: competition.status === "paused" ? "View Details" : "Enter Arena",
      href: `/mathlete/competition/${competition.id}`,
    }));

  const upcomingCards = registeredCompetitions
    .filter(({ competition }) => competition.status === "published" && isUpcomingByClock(competition, now))
    .map(({ competition }) => ({
      id: competition.id,
      title: competition.name || "Untitled competition",
      type: formatMode(competition),
      dateLabel: formatCompactDate(competition.startTime),
      timestamp: competition.startTime,
      countdown: buildCountdown(competition.startTime, now),
      href: `/mathlete/competition/${competition.id}`,
    }));

  const registrationCards = registeredCompetitions.map(({ competition, registration }) => ({
    id: registration.id,
    title: competition.name || "Untitled competition",
    status: registration.status ?? "registered",
    format: formatMode(competition),
    dateLabel: formatCompactDate(competition.startTime ?? competition.registrationStart),
    registeredLabel: `Registered ${formatRelativeTimestamp(registration.registered_at)}`,
    href: `/mathlete/competition/${competition.id}`,
  }));

  const activityItems = registeredCompetitions.slice(0, 5).map(({ competition, registration }) => ({
    id: registration.id,
    message: `Your registration for ${competition.name || "this competition"} is active.`,
    timestampLabel: formatRelativeTimestamp(registration.registered_at),
  }));

  return { liveCards, upcomingCards, registrationCards, activityItems };
}

export default async function MathletePage() {
  const { userEmail, profile } = await getWorkspaceContext();
  const fallbackName = userEmail?.split("@")[0] ?? "Mathlete";
  const displayName =
    profile?.full_name?.trim()?.split(/\s+/)[0] ||
    fallbackName.charAt(0).toUpperCase() + fallbackName.slice(1);

  await runDueScheduledCompetitionLifecycleSafely();

  const registrationCards = buildRegistrationCards(
    await listMyRegistrationDetails({ statuses: ["registered"], limit: 25 }),
  );

  return (
    <>
      <UpcomingCompetitionRefresh upcomingCards={registrationCards.upcomingCards} />
      <MathleteDashboardOverview
        displayName={displayName}
        profileComplete={Boolean(profile?.school && profile?.grade_level)}
        liveCards={registrationCards.liveCards}
        upcomingCards={registrationCards.upcomingCards}
        registrationCards={registrationCards.registrationCards}
        activityItems={registrationCards.activityItems}
      />
    </>
  );
}
