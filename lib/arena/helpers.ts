import {
  normalizeAnswerForScoring,
  normalizeLatexText,
  normalizeTrueFalseToken,
} from "@/lib/scoring/normalization";
import type { ProblemType } from "@/lib/problem-bank/types";
import type {
  AnswerStatusFlag,
  ArenaPageMode,
  ArenaProblemOption,
  AttemptStatus,
} from "@/lib/arena/types";
import type { CompetitionStatus } from "@/lib/competition/types";

export function isTerminalAttemptStatus(status: AttemptStatus | null | undefined) {
  return (
    status === "submitted" ||
    status === "auto_submitted" ||
    status === "disqualified" ||
    status === "graded"
  );
}

export function computeRemainingSeconds(
  effectiveAttemptDeadlineAt: string | null | undefined,
  now = new Date(),
) {
  if (!effectiveAttemptDeadlineAt) {
    return 0;
  }

  const deadline = new Date(effectiveAttemptDeadlineAt);
  if (Number.isNaN(deadline.getTime())) {
    return 0;
  }

  return Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / 1000));
}

type DetermineCompetitionPageModeArgs = {
  hasActiveAttempt: boolean;
  hasRegistration: boolean;
  registrationStatus: string | null;
  competitionStatus: CompetitionStatus;
  competitionType: string;
  attemptsRemaining: number;
};

type ResolveEffectiveCompetitionStatusArgs = {
  status: CompetitionStatus;
  type: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  now?: Date;
};

function parseTimestamp(value: string | null | undefined) {
  if (!value) {
    return Number.NaN;
  }

  return new Date(value).getTime();
}

function resolveCompetitionEndTimestamp({
  startTime,
  endTime,
  durationMinutes,
}: {
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
}) {
  const explicitEnd = parseTimestamp(endTime);
  if (!Number.isNaN(explicitEnd)) {
    return explicitEnd;
  }

  const start = parseTimestamp(startTime);
  if (Number.isNaN(start) || durationMinutes <= 0) {
    return Number.NaN;
  }

  return start + durationMinutes * 60000;
}

export function resolveEffectiveCompetitionStatus({
  status,
  type,
  startTime,
  endTime,
  durationMinutes,
  now = new Date(),
}: ResolveEffectiveCompetitionStatusArgs): CompetitionStatus {
  if (status !== "published" || type !== "scheduled") {
    return status;
  }

  const start = parseTimestamp(startTime);
  if (Number.isNaN(start) || start > now.getTime()) {
    return status;
  }

  const end = resolveCompetitionEndTimestamp({ startTime, endTime, durationMinutes });
  if (!Number.isNaN(end) && end <= now.getTime()) {
    return "ended";
  }

  return "live";
}

export function determineCompetitionPageMode({
  hasActiveAttempt,
  hasRegistration,
  registrationStatus,
  competitionStatus,
  competitionType,
  attemptsRemaining,
}: DetermineCompetitionPageModeArgs): ArenaPageMode {
  if (competitionStatus === "ended" || competitionStatus === "archived") {
    return "detail_register";
  }

  if (hasActiveAttempt) {
    return "arena_runtime";
  }

  const registered = hasRegistration && registrationStatus === "registered";
  const canAttemptScheduled = competitionStatus === "live";
  const canAttemptOpen = competitionStatus === "published" || competitionStatus === "live";

  if (competitionType === "open" && canAttemptOpen && attemptsRemaining > 0) {
    return "pre_entry";
  }

  if (registered && attemptsRemaining > 0 && competitionType === "scheduled" && canAttemptScheduled) {
    return "pre_entry";
  }

  return "detail_register";
}

export function parseArenaOptions(value: unknown): ArenaProblemOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" && record.id.trim() ? record.id.trim() : `opt_${index}`;
      const label =
        typeof record.label === "string" && record.label.trim()
          ? record.label.trim()
          : typeof record.value === "string" && record.value.trim()
            ? record.value.trim()
            : "";

      if (!label) {
        return null;
      }

      return { id, label };
    })
    .filter((entry): entry is ArenaProblemOption => entry !== null);
}

export function getDefaultAnswerStatusFlag(problemType: ProblemType, rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return "blank" satisfies AnswerStatusFlag;
  }

  if (problemType === "mcq" || problemType === "tf") {
    return "filled" satisfies AnswerStatusFlag;
  }

  return "filled" satisfies AnswerStatusFlag;
}

export function normalizeArenaAnswerValue(problemType: ProblemType, rawValue: string) {
  const value = rawValue ?? "";

  if (problemType === "mcq") {
    return {
      answerLatex: "",
      answerTextNormalized: normalizeLatexText(value).toLowerCase(),
    };
  }

  if (problemType === "tf") {
    return {
      answerLatex: "",
      answerTextNormalized: normalizeTrueFalseToken(value) ?? normalizeLatexText(value).toLowerCase(),
    };
  }

  const normalized = normalizeAnswerForScoring(problemType, value);
  return {
    answerLatex: value,
    answerTextNormalized: normalized.normalizedText,
  };
}

export function resolvePersistedAnswerStatusFlag(
  problemType: ProblemType,
  rawValue: string,
  explicitStatusFlag: AnswerStatusFlag | null | undefined,
) {
  if (explicitStatusFlag === "reset") {
    return "reset" satisfies AnswerStatusFlag;
  }

  if (explicitStatusFlag === "solved") {
    return rawValue.trim() ? "solved" : "blank";
  }

  if (explicitStatusFlag === "blank") {
    return rawValue.trim() ? getDefaultAnswerStatusFlag(problemType, rawValue) : "blank";
  }

  return getDefaultAnswerStatusFlag(problemType, rawValue);
}

export function getTimerAnnouncementText(remainingSeconds: number) {
  if (remainingSeconds <= 0) {
    return "Time is up.";
  }

  if (remainingSeconds <= 10) {
    return `${remainingSeconds} seconds remaining.`;
  }

  if (remainingSeconds % 60 === 0) {
    const minutes = Math.floor(remainingSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} remaining.`;
  }

  return "";
}

export function formatTimerText(totalSeconds: number) {
  const clamped = Math.max(0, totalSeconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}
