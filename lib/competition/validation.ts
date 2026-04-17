import {
  createImmutableScoringSnapshot,
} from "@/lib/scoring/snapshot";
import type { ScoringSnapshot } from "@/lib/scoring/types";
import {
  validateScoringRuleInput,
  type ScoringValidationResult,
} from "@/lib/scoring/validation";
import {
  ANSWER_KEY_VISIBILITY_VALUES,
  REGISTRATION_TIMING_MODES,
  type CompetitionRegistrationTimingMode,
  type CompetitionAnswerKeyVisibility,
  type CompetitionDraftFormState,
  type CompetitionDraftInput,
  type CompetitionDraftMutationPayload,
  type CompetitionFormat,
  type CompetitionValidationError,
  type CompetitionValidationResult,
} from "./types";

function ok<T>(value: T): CompetitionValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: CompetitionValidationError[]): CompetitionValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function normalizeNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function parseDateTimeLocalValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function countWords(value: string): number {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).filter(Boolean).length;
}

function dedupeStrings(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((entry) => {
    if (typeof entry !== "string") {
      return;
    }

    const normalized = entry.trim();
    if (!normalized) {
      return;
    }

    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

function normalizeAnswerKeyVisibility(value: unknown): CompetitionAnswerKeyVisibility {
  return ANSWER_KEY_VISIBILITY_VALUES.includes(value as CompetitionAnswerKeyVisibility)
    ? (value as CompetitionAnswerKeyVisibility)
    : "after_end";
}

function normalizeCompetitionFormat(type: unknown): CompetitionFormat {
  return type === "team" ? "team" : "individual";
}

function normalizeRegistrationTimingMode(
  value: unknown,
  competitionType: "open" | "scheduled",
  registrationStart: string | null,
  registrationEnd: string | null,
): CompetitionRegistrationTimingMode {
  if (competitionType !== "scheduled") {
    return "default";
  }

  if (REGISTRATION_TIMING_MODES.includes(value as CompetitionRegistrationTimingMode)) {
    return value as CompetitionRegistrationTimingMode;
  }

  if (registrationStart || registrationEnd) {
    return "manual";
  }

  return "default";
}

export function createDefaultCompetitionDraftState(): CompetitionDraftFormState {
  return {
    name: "",
    description: "",
    instructions: "",
    type: "scheduled",
    format: "individual",
    registrationTimingMode: "default",
    registrationStart: "",
    registrationEnd: "",
    startTime: "",
    endTime: "",
    durationMinutes: 60,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: 3,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "difficulty",
    customPointsByProblemId: {},
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    shuffleQuestions: false,
    shuffleOptions: false,
    logTabSwitch: false,
    offensePenalties: [],
    answerKeyVisibility: "after_end",
    selectedProblemIds: [],
  };
}

export function validateCompetitionDraftInput(
  input: CompetitionDraftInput,
): CompetitionValidationResult<CompetitionDraftMutationPayload> {
  const errors: CompetitionValidationError[] = [];

  const name = normalizeText(input.name);
  const description = normalizeText(input.description);
  const instructions = normalizeText(input.instructions);
  const type = input.type === "open" ? "open" : "scheduled";
  const format = normalizeCompetitionFormat(input.format);
  const registrationStart = parseDateTimeLocalValue(input.registrationStart);
  const registrationEnd = parseDateTimeLocalValue(input.registrationEnd);
  const startTime = parseDateTimeLocalValue(input.startTime);
  const endTime = parseDateTimeLocalValue(input.endTime);
  const registrationTimingMode = normalizeRegistrationTimingMode(
    input.registrationTimingMode,
    type,
    registrationStart,
    registrationEnd,
  );
  const durationMinutes = Math.max(1, normalizeInteger(input.durationMinutes, 60));
  const attemptsAllowed = Math.max(1, normalizeInteger(input.attemptsAllowed, 1));
  const maxParticipants = normalizeNullableInteger(input.maxParticipants);
  const participantsPerTeam = normalizeNullableInteger(input.participantsPerTeam);
  const maxTeams = normalizeNullableInteger(input.maxTeams);
  const answerKeyVisibility = normalizeAnswerKeyVisibility(input.answerKeyVisibility);
  const selectedProblemIds = dedupeStrings(input.selectedProblemIds);

  if (!name) {
    errors.push({
      field: "name",
      reason: "Competition name is required.",
    });
  }

  if (!description) {
    errors.push({
      field: "description",
      reason: "Competition description is required.",
    });
  } else if (countWords(description) > 500) {
    errors.push({
      field: "description",
      reason: "Competition description must not exceed 500 words.",
    });
  }

  if (!instructions) {
    errors.push({
      field: "instructions",
      reason: "Rules and instructions are required.",
    });
  }

  if (type === "scheduled") {
    if (!startTime) {
      errors.push({
        field: "startTime",
        reason: "Scheduled competitions require a competition start time.",
      });
    }

    if (registrationTimingMode === "manual") {
      if (!registrationStart) {
        errors.push({
          field: "registrationStart",
          reason: "Manual registration requires a registration start time.",
        });
      }

      if (!registrationEnd) {
        errors.push({
          field: "registrationEnd",
          reason: "Manual registration requires a registration end time.",
        });
      }
    }

    if (format === "team") {
      if (participantsPerTeam === null || participantsPerTeam < 2 || participantsPerTeam > 5) {
        errors.push({
          field: "participantsPerTeam",
          reason: "Scheduled team competitions require 2 to 5 participants per team.",
        });
      }

      if (maxTeams === null || maxTeams < 3 || maxTeams > 50) {
        errors.push({
          field: "maxTeams",
          reason: "Scheduled team competitions require 3 to 50 teams.",
        });
      }

      if (maxParticipants !== null) {
        errors.push({
          field: "maxParticipants",
          reason: "Scheduled team competitions do not use a single participant cap.",
        });
      }
    } else {
      if (maxParticipants === null || maxParticipants < 3 || maxParticipants > 100) {
        errors.push({
          field: "maxParticipants",
          reason: "Individual competitions require a participant cap between 3 and 100.",
        });
      }

      if (participantsPerTeam !== null) {
        errors.push({
          field: "participantsPerTeam",
          reason: "Individual competitions do not use team capacity settings.",
        });
      }

      if (maxTeams !== null) {
        errors.push({
          field: "maxTeams",
          reason: "Individual competitions do not use team capacity settings.",
        });
      }
    }

    if (registrationTimingMode === "manual" && registrationStart && registrationEnd) {
      const registrationStartTime = new Date(registrationStart).getTime();
      const registrationEndTime = new Date(registrationEnd).getTime();
      const competitionStartTime = startTime ? new Date(startTime).getTime() : Number.NaN;

      if (registrationStartTime >= registrationEndTime) {
        errors.push({
          field: "registrationEnd",
          reason: "Registration end must be later than registration start.",
        });
      }

      if (Number.isFinite(competitionStartTime) && registrationEndTime > competitionStartTime) {
        errors.push({
          field: "registrationEnd",
          reason: "Registration must close at or before competition start.",
        });
      }
    }
  } else {
    if (format !== "individual") {
      errors.push({
        field: "format",
        reason: "Open competitions must use individual format.",
      });
    }

    if (registrationStart || registrationEnd || startTime || endTime) {
      errors.push({
        field: "registrationStart",
        reason: "Open competitions do not use registration windows or a scheduled start time.",
      });
    }

    if (maxParticipants === null || maxParticipants < 3 || maxParticipants > 100) {
      errors.push({
        field: "maxParticipants",
        reason: "Open competitions require a participant cap between 3 and 100.",
      });
    }
  }

  if (type === "scheduled" && attemptsAllowed !== 1) {
    errors.push({
      field: "attemptsAllowed",
      reason: "Scheduled competitions allow exactly one attempt.",
    });
  }

  if (type === "open" && (attemptsAllowed < 1 || attemptsAllowed > 3)) {
    errors.push({
      field: "attemptsAllowed",
      reason: "Open competitions allow between one and three attempts.",
    });
  }

  const scoringValidation = validateScoringRuleInput({
    scoringMode: input.scoringMode,
    penaltyMode: input.penaltyMode,
    deductionValue: input.deductionValue,
    tieBreaker: input.tieBreaker,
    multiAttemptGradingMode: input.multiAttemptGradingMode,
    competitionType: type,
    shuffleQuestions: input.shuffleQuestions,
    shuffleOptions: input.shuffleOptions,
    logTabSwitch: input.logTabSwitch,
    offensePenalties: input.offensePenalties,
    customPointsByProblemId: input.customPointsByProblemId,
  });

  if (!scoringValidation.ok || !scoringValidation.value) {
    errors.push(...scoringValidation.errors);
  }

  if (selectedProblemIds.length > 100) {
    errors.push({
      field: "selectedProblemIds",
      reason: "No more than 100 problems can be selected.",
    });
  }

  if (errors.length > 0 || !scoringValidation.ok || !scoringValidation.value) {
    return fail(errors);
  }

  const derivedRegistrationStart =
    type === "scheduled" && registrationTimingMode === "manual" ? registrationStart : null;
  const derivedRegistrationEnd =
    type === "scheduled"
      ? registrationTimingMode === "manual"
        ? registrationEnd
        : startTime
      : null;
  const derivedEndTime =
    type === "scheduled" && startTime
      ? new Date(new Date(startTime).getTime() + durationMinutes * 60_000).toISOString()
      : null;

  return ok({
    name,
    description,
    instructions,
    type,
    format,
    registrationTimingMode,
    registrationStart: derivedRegistrationStart,
    registrationEnd: derivedRegistrationEnd,
    startTime: type === "scheduled" ? startTime : null,
    endTime: derivedEndTime,
    durationMinutes,
    attemptsAllowed,
    multiAttemptGradingMode: scoringValidation.value.multiAttemptGradingMode,
    maxParticipants: format === "individual" ? maxParticipants : null,
    participantsPerTeam: format === "team" ? participantsPerTeam : null,
    maxTeams: format === "team" ? maxTeams : null,
    scoringMode: scoringValidation.value.scoringMode,
    customPointsByProblemId: scoringValidation.value.customPointsByProblemId,
    penaltyMode: scoringValidation.value.penaltyMode,
    deductionValue: scoringValidation.value.deductionValue,
    tieBreaker: scoringValidation.value.tieBreaker,
    shuffleQuestions: scoringValidation.value.shuffleQuestions,
    shuffleOptions: scoringValidation.value.shuffleOptions,
    logTabSwitch: scoringValidation.value.logTabSwitch,
    offensePenalties: scoringValidation.value.offensePenalties,
    answerKeyVisibility,
    selectedProblemIds,
  });
}

export function validateCompetitionPublishReadiness(
  input: CompetitionDraftInput,
): CompetitionValidationResult<CompetitionDraftMutationPayload & { selectedProblemCount: number }> {
  const validation = validateCompetitionDraftInput(input);
  if (!validation.ok || !validation.value) {
    return {
      ok: false,
      value: null,
      errors: validation.errors,
    };
  }

  const selectedProblemCount = validation.value.selectedProblemIds.length;
  if (selectedProblemCount < 10 || selectedProblemCount > 100) {
    return fail([
      {
        field: "selectedProblemIds",
        reason: "Publish requires between 10 and 100 selected problems.",
      },
    ]);
  }

  return ok({
    ...validation.value,
    selectedProblemCount,
  });
}

export function buildCompetitionScoringSnapshot(
  payload: CompetitionDraftMutationPayload,
): ScoringValidationResult<ScoringSnapshot> {
  const scoringValidation = validateScoringRuleInput({
    scoringMode: payload.scoringMode,
    penaltyMode: payload.penaltyMode,
    deductionValue: payload.deductionValue,
    tieBreaker: payload.tieBreaker,
    multiAttemptGradingMode: payload.multiAttemptGradingMode,
    competitionType: payload.type,
    shuffleQuestions: payload.shuffleQuestions,
    shuffleOptions: payload.shuffleOptions,
    logTabSwitch: payload.logTabSwitch,
    offensePenalties: payload.offensePenalties,
    customPointsByProblemId: payload.customPointsByProblemId,
  });

  if (!scoringValidation.ok || !scoringValidation.value) {
    return {
      ok: false,
      value: null,
      errors: scoringValidation.errors,
    };
  }

  return {
    ok: true,
    value: createImmutableScoringSnapshot(scoringValidation.value),
    errors: [],
  };
}
