import { describe, it, expect } from "vitest";
import { parseNumericLatex, areNumericAnswersEquivalent, normalizeAnswerForScoring } from "../../lib/scoring/normalization";
import { applyPenaltyFloor, roundHalfAwayFromZero, selectAttemptScoreByMode, resolveBaseProblemPoints, resolveEffectiveProblemPoints } from "../../lib/scoring/policies";
import { parseGradeAttemptRpcRow } from "../../lib/scoring/rpc-contracts";

describe("Security Fuzz Tests for Scoring Contracts", () => {
  describe("Normalization & Math Fuzzing", () => {
    it("should handle huge numbers and edge cases defensively", () => {
      expect(areNumericAnswersEquivalent(Number.MAX_VALUE, Number.MAX_VALUE)).toBe(true);
      expect(areNumericAnswersEquivalent(Infinity, Infinity)).toBe(false); 
      expect(areNumericAnswersEquivalent(NaN, NaN)).toBe(false);
      
      expect(parseNumericLatex("1e1000")).toBe(null); 
      expect(parseNumericLatex("\\frac{1}{0}")).toBe(null);
      expect(parseNumericLatex("\\frac{Infinity}{1}")).toBe(null);
    });

    it("should handle Infinity as tolerance in areNumericAnswersEquivalent", () => {
      expect(areNumericAnswersEquivalent(10, 20, Infinity)).toBe(false);
      expect(areNumericAnswersEquivalent(10, 20, NaN)).toBe(false);
    });
    
    it("normalizeAnswerForScoring should handle malicious prototype injection", () => {
      const malicious = Object.create(null);
      malicious.toString = () => "true";
      expect(normalizeAnswerForScoring("tf", malicious as unknown as string).normalizedTrueFalse).toBeNull();
    });
  });

  describe("Policies - Penalties and Rounding", () => {
    it("should correctly handle NaN or Infinity in penalty floors", () => {
      expect(applyPenaltyFloor(10, NaN).finalScore).toBe(10);
      expect(applyPenaltyFloor(10, Infinity).finalScore).toBe(10);
      expect(applyPenaltyFloor(10, -Infinity).finalScore).toBe(10);
      expect(applyPenaltyFloor(NaN, 5).finalScore).toBe(0);
    });

    it("should not allow huge negative penalties to inflate scores", () => {
      const result = applyPenaltyFloor(10, -5000);
      expect(result.penaltyScore).toBe(0);
      expect(result.finalScore).toBe(10);
      expect(applyPenaltyFloor(-10, 5).finalScore).toBe(0);
    });

    it("should safely round half away from zero with NaN and Infinity", () => {
      expect(roundHalfAwayFromZero(NaN, 2)).toBe(0);
      expect(roundHalfAwayFromZero(Infinity, 2)).toBe(0);
      expect(roundHalfAwayFromZero(-Infinity, 2)).toBe(0);

      // Huge decimals length protection
      expect(roundHalfAwayFromZero(123.456, Infinity)).toBe(123.456);
      expect(roundHalfAwayFromZero(123.456, NaN)).toBe(0);
      expect(roundHalfAwayFromZero(123.456, -10)).toBe(123);
    });

    it("should handle NaN/Infinity in attempt selections", () => {
      const result = selectAttemptScoreByMode("average_score", [
        { attemptId: "1", finalScore: 10, submittedAt: null, totalTimeSeconds: null },
        { attemptId: "2", finalScore: NaN, submittedAt: null, totalTimeSeconds: null },
        { attemptId: "3", finalScore: Infinity, submittedAt: null, totalTimeSeconds: null },
      ]);
      
      expect(result).toBeDefined();
      expect(Number.isFinite(result?.score)).toBe(true);
    });

    it("should safely limit base problem points from malicious infinity", () => {
      expect(resolveBaseProblemPoints("custom", "easy", { "C1": Infinity }, "C1")).toBe(0);
      expect(resolveBaseProblemPoints("custom", "easy", { "C1": NaN }, "C1")).toBe(0);
    });

    it("should safely limit effective points from malicious infinity", () => {
      expect(resolveEffectiveProblemPoints({ basePoints: NaN, activePointsOverride: Number.MAX_VALUE })).toBe(Number.MAX_VALUE);
      expect(resolveEffectiveProblemPoints({ basePoints: 10, activePointsOverride: Infinity })).toBe(10);
    });
  });

  describe("RPC Contracts - Validation Fuzzing", () => {
    it("should protect against __proto__ pollution", () => {
      const maliciousRow = JSON.parse('{"__proto__": {"admin": true}, "attempt_id": "123e4567-e89b-12d3-a456-426614174000", "competition_id": "123e4567-e89b-12d3-a456-426614174001", "machine_code": "ok", "raw_score": 10, "penalty_score": 0, "final_score": 10, "graded_at": "2024-01-01"}');
      const parsed = parseGradeAttemptRpcRow(maliciousRow);
      expect(parsed).not.toBeNull();
    });

    it("should safely reject boolean conversions or unpredicted types", () => {
      const fakeRow = {
        attempt_id: "123e4567-e89b-12d3-a456-426614174000",
        competition_id: "123e4567-e89b-12d3-a456-426614174001",
        machine_code: "ok",
        raw_score: true,
        penalty_score: "1e1000",
        final_score: NaN,
        graded_at: "2024-01-01"
      };

      const parsed = parseGradeAttemptRpcRow(fakeRow);
      expect(parsed).toBeNull();
    });
    
    it("should ensure numbers parsed via strings are strictly finite", () => {
      const fakeRow = {
        attempt_id: "123e4567-e89b-12d3-a456-426614174000",
        competition_id: "123e4567-e89b-12d3-a456-426614174001",
        machine_code: "ok",
        raw_score: "100",
        penalty_score: "0",
        final_score: "Infinity", 
        graded_at: "2024-01-01"
      };
      const parsed = parseGradeAttemptRpcRow(fakeRow);
      expect(parsed).toBeNull();
    });
  });
});
