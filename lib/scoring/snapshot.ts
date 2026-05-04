import type { ScoringSnapshot, ScoringRuleConfig } from "./types";
import {
  type ScoringRuleInput,
  type ScoringValidationResult,
  validateScoringRuleInput,
} from "./validation";

const REQUIRED_SNAPSHOT_KEYS = [
  "scoringMode",
  "penaltyMode",
  "deductionValue",
  "tieBreaker",
  "multiAttemptGradingMode",
  "shuffleQuestions",
  "shuffleOptions",
  "logTabSwitch",
  "offensePenalties",
  "safeExamBrowserMode",
  "safeExamBrowserConfigKeyHashes",
  "customPointsByProblemId",
] as const;

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.getOwnPropertyNames(value).forEach((propertyName) => {
    const propertyValue = (value as Record<string, unknown>)[propertyName];
    if (typeof propertyValue === "object" && propertyValue !== null) {
      deepFreeze(propertyValue);
    }
  });

  return Object.freeze(value);
}

function sortCustomPoints(
  customPointsByProblemId: Readonly<Record<string, number>>,
): Record<string, number> {
  const result: Record<string, number> = {};
  Object.keys(customPointsByProblemId)
    .sort((left, right) => left.localeCompare(right))
    .forEach((problemId) => {
      result[problemId] = customPointsByProblemId[problemId];
    });

  return result;
}

export function createImmutableScoringSnapshot(
  config: ScoringRuleConfig,
): ScoringSnapshot {
  const offensePenalties = [...config.offensePenalties]
    .map((rule) => ({ ...rule }))
    .sort((left, right) => left.threshold - right.threshold);

  const snapshot: ScoringSnapshot = {
    scoringMode: config.scoringMode,
    penaltyMode: config.penaltyMode,
    deductionValue: config.deductionValue,
    tieBreaker: config.tieBreaker,
    multiAttemptGradingMode: config.multiAttemptGradingMode,
    shuffleQuestions: config.shuffleQuestions,
    shuffleOptions: config.shuffleOptions,
    logTabSwitch: config.logTabSwitch,
    offensePenalties,
    safeExamBrowserMode: config.safeExamBrowserMode,
    safeExamBrowserConfigKeyHashes: [...config.safeExamBrowserConfigKeyHashes].sort((left, right) =>
      left.localeCompare(right),
    ),
    customPointsByProblemId: sortCustomPoints(config.customPointsByProblemId),
  };

  return deepFreeze(snapshot);
}

function toScoringRuleInput(value: unknown): ScoringRuleInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const record = value as Record<string, unknown>;
  return {
    scoringMode: record.scoringMode,
    penaltyMode: record.penaltyMode,
    deductionValue: record.deductionValue,
    tieBreaker: record.tieBreaker,
    multiAttemptGradingMode: record.multiAttemptGradingMode,
    shuffleQuestions: record.shuffleQuestions,
    shuffleOptions: record.shuffleOptions,
    logTabSwitch: record.logTabSwitch,
    offensePenalties: record.offensePenalties,
    safeExamBrowserMode: record.safeExamBrowserMode,
    safeExamBrowserConfigKeyHashes: record.safeExamBrowserConfigKeyHashes,
    customPointsByProblemId: record.customPointsByProblemId,
  };
}

function hasSnapshotContractKeys(value: unknown): value is ScoringSnapshot {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return REQUIRED_SNAPSHOT_KEYS.every((key) => key in record);
}

function getMissingSnapshotKeys(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [...REQUIRED_SNAPSHOT_KEYS];
  }

  const record = value as Record<string, unknown>;
  return REQUIRED_SNAPSHOT_KEYS.filter((key) => !(key in record));
}

export function parseScoringSnapshotPayload(
  payload: unknown,
): ScoringValidationResult<ScoringSnapshot> {
  if (!hasSnapshotContractKeys(payload)) {
    const missingKeys = getMissingSnapshotKeys(payload);
    return {
      ok: false,
      value: null,
      errors: [
        {
          field: "snapshot",
          reason: `Snapshot payload is missing required keys: ${missingKeys.join(", ")}.`,
        },
      ],
    };
  }

  const validation = validateScoringRuleInput(toScoringRuleInput(payload));
  if (!validation.ok || validation.value === null) {
    return {
      ok: false,
      value: null,
      errors: validation.errors,
    };
  }

  return {
    ok: true,
    value: createImmutableScoringSnapshot(validation.value),
    errors: [],
  };
}

function isFrozenScoringSnapshot(snapshot: ScoringSnapshot): boolean {
  const seen = new WeakSet<object>();

  const isDeepFrozen = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) {
      return true;
    }

    if (seen.has(value)) {
      return true;
    }

    if (!Object.isFrozen(value)) {
      return false;
    }

    seen.add(value);

    return Object.getOwnPropertyNames(value).every((propertyName) => {
      const propertyValue = (value as Record<string, unknown>)[propertyName];
      return isDeepFrozen(propertyValue);
    });
  };

  return isDeepFrozen(snapshot);
}

export function isScoringSnapshot(value: unknown): value is ScoringSnapshot {
  if (!hasSnapshotContractKeys(value)) {
    return false;
  }

  const parsed = parseScoringSnapshotPayload(value);
  if (!parsed.ok || parsed.value === null) {
    return false;
  }

  return isFrozenScoringSnapshot(value);
}

export function assertSnapshotIsImmutable(snapshot: ScoringSnapshot): boolean {
  return isFrozenScoringSnapshot(snapshot);
}
