import type {
  MathleteActivityItem,
  MathleteLiveCard,
  MathleteRegistrationCard,
  MathleteUpcomingCard,
} from "@/components/mathlete/dashboard-overview";
import type { RegistrationCompetitionSummary, RegistrationDetail } from "@/lib/registrations/types";

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

function formatRelativeTimestamp(dateValue: string | null, now = Date.now()) {
  if (!dateValue) {
    return "Recently";
  }

  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) {
    return "Recently";
  }

  const diffMinutes = Math.max(1, Math.round((now - timestamp) / 60000));
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

function getTimestamp(dateValue: string | null) {
  if (!dateValue) {
    return Number.NaN;
  }

  return new Date(dateValue).getTime();
}

function resolveCompetitionEndTimestamp(competition: RegistrationCompetitionSummary) {
  const explicitEnd = getTimestamp(competition.endTime);
  if (!Number.isNaN(explicitEnd)) {
    return explicitEnd;
  }

  const start = getTimestamp(competition.startTime);
  if (Number.isNaN(start) || !competition.durationMinutes || competition.durationMinutes <= 0) {
    return Number.NaN;
  }

  return start + competition.durationMinutes * 60000;
}

function hasEndedByClock(competition: RegistrationCompetitionSummary, now = Date.now()) {
  const end = resolveCompetitionEndTimestamp(competition);
  return !Number.isNaN(end) && end <= now;
}

function hasStartedByClock(competition: RegistrationCompetitionSummary, now = Date.now()) {
  const start = getTimestamp(competition.startTime);
  return !Number.isNaN(start) && start <= now;
}

function isUpcomingByClock(competition: RegistrationCompetitionSummary, now = Date.now()) {
  const start = getTimestamp(competition.startTime);
  return !Number.isNaN(start) && start > now;
}

function shouldShowAsLive(competition: RegistrationCompetitionSummary, now = Date.now()) {
  if (competition.status === "live" || competition.status === "paused") {
    return true;
  }

  return competition.status === "published" && competition.type === "scheduled" && hasStartedByClock(competition, now);
}

export function buildMathleteDashboardCards(
  rows: RegistrationDetail[],
  now = Date.now(),
): {
  liveCards: MathleteLiveCard[];
  upcomingCards: MathleteUpcomingCard[];
  registrationCards: MathleteRegistrationCard[];
  activityItems: MathleteActivityItem[];
} {
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
    .filter(({ competition }) => shouldShowAsLive(competition, now))
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
    registeredLabel: `Registered ${formatRelativeTimestamp(registration.registered_at, now)}`,
    href: `/mathlete/competition/${competition.id}`,
  }));

  const activityItems = registeredCompetitions.slice(0, 5).map(({ competition, registration }) => ({
    id: registration.id,
    message: `Your registration for ${competition.name || "this competition"} is active.`,
    timestampLabel: formatRelativeTimestamp(registration.registered_at, now),
  }));

  return { liveCards, upcomingCards, registrationCards, activityItems };
}
