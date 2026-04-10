import {
  DIFFICULTY_BASE_POINTS,
  type AttemptGradingMode,
  type AttemptScoreSelection,
  type AttemptScoreSummary,
  type LeaderboardSortableEntry,
  type PenaltyAppliedScore,
  type ScoringMode,
  type TieBreaker,
  type EffectivePointsInput,
} from "./types";

function sanitizeFiniteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function toPlainDecimalString(value: number): string {
  const text = value.toString();
  if (!/[eE]/.test(text)) {
    return text;
  }

  const [coefficient, exponentPart] = text.split(/[eE]/);
  const exponent = Number.parseInt(exponentPart, 10);
  if (!Number.isFinite(exponent)) {
    return text;
  }

  const [integerPart, fractionPart = ""] = coefficient.split(".");
  const normalizedInteger = integerPart.replace(/^[-+]/, "");
  const digits = `${normalizedInteger}${fractionPart}`;
  const decimalIndex = normalizedInteger.length + exponent;

  if (decimalIndex <= 0) {
    return `0.${"0".repeat(-decimalIndex)}${digits}`;
  }

  if (decimalIndex >= digits.length) {
    return `${digits}${"0".repeat(decimalIndex - digits.length)}`;
  }

  return `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
}

function compareNullableTimestampAscending(
  leftTimestamp: string | null,
  rightTimestamp: string | null,
): number {
  if (!leftTimestamp && !rightTimestamp) {
    return 0;
  }

  if (!leftTimestamp) {
    return 1;
  }

  if (!rightTimestamp) {
    return -1;
  }

  const left = Date.parse(leftTimestamp);
  const right = Date.parse(rightTimestamp);

  const leftSafe = Number.isFinite(left) ? left : Number.POSITIVE_INFINITY;
  const rightSafe = Number.isFinite(right) ? right : Number.POSITIVE_INFINITY;

  if (leftSafe < rightSafe) {
    return -1;
  }

  if (leftSafe > rightSafe) {
    return 1;
  }

  return 0;
}

function compareNullableNumberAscending(
  leftValue: number | null,
  rightValue: number | null,
): number {
  if (leftValue === null && rightValue === null) {
    return 0;
  }

  if (leftValue === null) {
    return 1;
  }

  if (rightValue === null) {
    return -1;
  }

  if (leftValue < rightValue) {
    return -1;
  }

  if (leftValue > rightValue) {
    return 1;
  }

  return 0;
}

export function roundHalfAwayFromZero(value: number, decimals: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (Number.isNaN(decimals)) {
    return 0;
  }

  if (!Number.isFinite(decimals) || decimals > 15) {
    return value;
  }

  const precision = Math.max(0, Math.trunc(decimals));
  const absoluteText = toPlainDecimalString(Math.abs(value));
  const [rawIntegerPart, rawFractionPart = ""] = absoluteText.split(".");
  const integerPart = rawIntegerPart.replace(/^0+(?=\d)/, "") || "0";
  const requiredFractionDigits = precision + 1;
  const paddedFraction = rawFractionPart.padEnd(requiredFractionDigits, "0");
  const retainedFraction = paddedFraction.slice(0, precision);
  const nextDigit = Number.parseInt(paddedFraction.charAt(precision) || "0", 10);
  const scale = BigInt(10) ** BigInt(precision);

  let scaled = BigInt(`${integerPart}${retainedFraction}` || "0");
  if (nextDigit >= 5) {
    scaled += BigInt(1);
  }

  const wholePart = scaled / scale;
  const fractionPart = scaled % scale;
  const roundedText =
    precision === 0
      ? wholePart.toString()
      : `${wholePart.toString()}.${fractionPart.toString().padStart(precision, "0")}`;
  const rounded = Number.parseFloat(roundedText);

  return value < 0 ? -rounded : rounded;
}

export function applyPenaltyFloor(
  rawScore: number,
  penaltyTotal: number,
): PenaltyAppliedScore {
  const normalizedRawScore = sanitizeFiniteNumber(rawScore);
  const normalizedPenalty = Math.max(0, sanitizeFiniteNumber(penaltyTotal));
  const finalScore = Math.max(0, normalizedRawScore - normalizedPenalty);

  return {
    rawScore: normalizedRawScore,
    penaltyScore: normalizedPenalty,
    finalScore,
  };
}

export function resolveBaseProblemPoints(
  scoringMode: ScoringMode,
  problemDifficulty: keyof typeof DIFFICULTY_BASE_POINTS,
  customPointsByProblemId: Readonly<Record<string, number>>,
  competitionProblemId: string,
): number {
  if (scoringMode === "custom") {
    const customPoint = customPointsByProblemId[competitionProblemId];
    if (Number.isFinite(customPoint)) {
      return Math.max(0, Math.trunc(customPoint));
    }

    return 0;
  }

  return DIFFICULTY_BASE_POINTS[problemDifficulty];
}

export function resolveEffectiveProblemPoints({
  basePoints,
  activePointsOverride,
}: EffectivePointsInput): number {
  if (activePointsOverride !== null && Number.isFinite(activePointsOverride)) {
    return Math.max(0, Math.trunc(activePointsOverride));
  }

  return Math.max(0, Math.trunc(sanitizeFiniteNumber(basePoints)));
}

function pickHighestScoreAttempt(attempts: readonly AttemptScoreSummary[]): AttemptScoreSummary {
  return [...attempts].sort((left, right) => {
    const byScore = sanitizeFiniteNumber(right.finalScore) - sanitizeFiniteNumber(left.finalScore);
    if (byScore !== 0) {
      return byScore;
    }

    const bySubmission = compareNullableTimestampAscending(
      left.submittedAt,
      right.submittedAt,
    );
    if (bySubmission !== 0) {
      return bySubmission;
    }

    return left.attemptId.localeCompare(right.attemptId);
  })[0];
}

function pickLatestAttempt(attempts: readonly AttemptScoreSummary[]): AttemptScoreSummary {
  return [...attempts].sort((left, right) => {
    const bySubmission = compareNullableTimestampAscending(
      right.submittedAt,
      left.submittedAt,
    );
    if (bySubmission !== 0) {
      return bySubmission;
    }

    return left.attemptId.localeCompare(right.attemptId);
  })[0];
}

function selectAverageScore(
  attempts: readonly AttemptScoreSummary[],
): AttemptScoreSelection {
  const scoreTotal = attempts.reduce(
    (sum, attempt) => sum + sanitizeFiniteNumber(attempt.finalScore),
    0,
  );

  const averageScore = scoreTotal / attempts.length;
  const roundedScore = roundHalfAwayFromZero(averageScore, 2);

  const timeValues = attempts
    .map((attempt) => attempt.totalTimeSeconds)
    .filter((timeValue): timeValue is number => timeValue !== null && Number.isFinite(timeValue));

  const averageTime =
    timeValues.length > 0
      ? roundHalfAwayFromZero(
          timeValues.reduce((sum, value) => sum + value, 0) / timeValues.length,
          2,
        )
      : null;

  const latestAttempt = pickLatestAttempt(attempts);

  return {
    mode: "average_score",
    score: roundedScore,
    tieBreakSubmittedAt: latestAttempt.submittedAt,
    tieBreakTotalTimeSeconds: averageTime,
    sourceAttemptId: latestAttempt.attemptId,
  };
}

export function selectAttemptScoreByMode(
  mode: AttemptGradingMode,
  attempts: readonly AttemptScoreSummary[],
): AttemptScoreSelection | null {
  if (attempts.length === 0) {
    return null;
  }

  if (mode === "average_score") {
    return selectAverageScore(attempts);
  }

  const selectedAttempt =
    mode === "latest_score"
      ? pickLatestAttempt(attempts)
      : pickHighestScoreAttempt(attempts);

  return {
    mode,
    score: sanitizeFiniteNumber(selectedAttempt.finalScore),
    tieBreakSubmittedAt: selectedAttempt.submittedAt,
    tieBreakTotalTimeSeconds: selectedAttempt.totalTimeSeconds,
    sourceAttemptId: selectedAttempt.attemptId,
  };
}

export function compareLeaderboardEntries(
  left: LeaderboardSortableEntry,
  right: LeaderboardSortableEntry,
  tieBreaker: TieBreaker,
): number {
  const byScore = sanitizeFiniteNumber(right.score) - sanitizeFiniteNumber(left.score);
  if (byScore !== 0) {
    return byScore;
  }

  if (tieBreaker === "earliest_final_submission") {
    const bySubmission = compareNullableTimestampAscending(
      left.submittedAt,
      right.submittedAt,
    );
    if (bySubmission !== 0) {
      return bySubmission;
    }
  }

  if (tieBreaker === "lowest_total_time") {
    const byTotalTime = compareNullableNumberAscending(
      left.totalTimeSeconds,
      right.totalTimeSeconds,
    );
    if (byTotalTime !== 0) {
      return byTotalTime;
    }
  }

  const byRegistration = left.registrationId.localeCompare(right.registrationId);
  if (byRegistration !== 0) {
    return byRegistration;
  }

  return (left.attemptId ?? "").localeCompare(right.attemptId ?? "");
}

export function sortLeaderboardEntries(
  entries: readonly LeaderboardSortableEntry[],
  tieBreaker: TieBreaker,
): LeaderboardSortableEntry[] {
  return [...entries].sort((left, right) =>
    compareLeaderboardEntries(left, right, tieBreaker),
  );
}
