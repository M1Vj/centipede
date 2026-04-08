"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ProblemDifficulty, ProblemOption, ProblemType } from "@/lib/problem-bank/types";

export interface ProblemFormDraftState {
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tagsInput: string;
  contentLatex: string;
  explanationLatex: string;
  authoringNotes: string;
  imagePath: string | null;
  imageUrl: string | null;
  mcqOptions: ProblemOption[];
  tfOptions: ProblemOption[];
  correctOptionIds: string[];
  trueFalseAcceptedAnswer: "true" | "false";
  acceptedAnswerEntries: string[];
}

const DRAFT_KEY_PREFIX = "problem-draft";
const DEBOUNCE_MS = 800;

function buildStorageKey(bankId: string, problemId: string | null): string {
  return `${DRAFT_KEY_PREFIX}:${bankId}:${problemId ?? "new"}`;
}

function readDraft(key: string): ProblemFormDraftState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed !== "object" || parsed === null || typeof parsed.type !== "string") {
      return null;
    }

    return parsed as unknown as ProblemFormDraftState;
  } catch {
    return null;
  }
}

function writeDraft(key: string, state: ProblemFormDraftState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // Storage quota exceeded or unavailable — silently ignore.
  }
}

function removeDraft(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore removal failures.
  }
}

interface UseProblemFormDraftOptions {
  bankId: string;
  problemId: string | null;
}

interface UseProblemFormDraftReturn {
  loadDraft: () => ProblemFormDraftState | null;
  saveDraft: (state: ProblemFormDraftState) => void;
  clearDraft: () => void;
  scheduleSave: (state: ProblemFormDraftState) => void;
}

export function useProblemFormDraft({
  bankId,
  problemId,
}: UseProblemFormDraftOptions): UseProblemFormDraftReturn {
  const key = buildStorageKey(bankId, problemId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const loadDraft = useCallback((): ProblemFormDraftState | null => {
    return readDraft(key);
  }, [key]);

  const saveDraft = useCallback(
    (state: ProblemFormDraftState): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      writeDraft(key, state);
    },
    [key],
  );

  const clearDraft = useCallback((): void => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    removeDraft(key);
  }, [key]);

  const scheduleSave = useCallback(
    (state: ProblemFormDraftState): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        writeDraft(key, state);
        timerRef.current = null;
      }, DEBOUNCE_MS);
    },
    [key],
  );

  return { loadDraft, saveDraft, clearDraft, scheduleSave };
}
