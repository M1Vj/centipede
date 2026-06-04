"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Download, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { TabSwitchWarningObserver } from "@/components/arena/tab-switch-warning-observer";
import { TabSwitchWarningOverlay } from "@/components/arena/tab-switch-warning-overlay";
import { MathliveField } from "@/components/math-editor/mathlive-field";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createIdempotencyToken } from "@/components/competitions/utils";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  formatTimerText,
  getTimerAnnouncementText,
  isTerminalAttemptStatus,
  resolvePersistedAnswerStatusFlag,
} from "@/lib/arena/helpers";
import type {
  AnswerStatusFlag,
  ArenaAttemptAnswer,
  ArenaPageData,
  ArenaProblem,
  SaveArenaAnswerInput,
} from "@/lib/arena/types";

type ArenaExperienceProps = {
  initialData: ArenaPageData;
};

type RequestState = "idle" | "pending" | "error";

type PendingSave = {
  clientUpdatedAt: string;
  value: string;
  statusFlag: AnswerStatusFlag;
  timeoutId: number;
};

type RuntimeAnswer = ArenaAttemptAnswer & {
  localValue: string;
};

type ApplyPageDataOptions = {
  preservePending?: boolean;
  resetRequest?: boolean;
};

type FlushSaveOptions = {
  keepalive?: boolean;
};

type SubmitAttemptResponse = {
  data?: {
    attempt?: {
      id: string;
    };
  };
  message?: string;
};

function formatOptionMarker(index: number) {
  return String.fromCharCode(65 + index);
}

function getProblemStatusClassName(status: AnswerStatusFlag) {
  if (status === "solved") {
    return "border-[#f49700] bg-[#f49700] text-white";
  }

  if (status === "filled") {
    return "border-[#1A1E2E] bg-[#1A1E2E] text-white";
  }

  if (status === "reset") {
    return "border-slate-200 bg-slate-50 text-slate-400";
  }

  return "border-slate-100 bg-slate-50 text-slate-400";
}

function formatStatusLabel(status: AnswerStatusFlag) {
  switch (status) {
    case "solved":
      return "Solved";
    case "filled":
      return "Filled";
    case "reset":
      return "Reset";
    default:
      return "Blank";
  }
}

function getBadgeStatusClassName(status: AnswerStatusFlag) {
  if (status === "solved") {
    return "border-[#fef3c7]/70 bg-[#fffbeb] text-[#f49700]";
  }

  if (status === "filled") {
    return "border-[#1A1E2E] bg-[#1A1E2E] text-white";
  }

  return "border-slate-100 bg-slate-50 text-slate-400";
}

function formatCompetitionWindow(label: string, value: string | null) {
  if (!value) {
    return `${label}: Flexible`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return `${label}: ${value}`;
  }

  return `${label}: ${date.toLocaleString()}`;
}

function getAttemptTerminalNotice(status: string | null | undefined) {
  switch (status) {
    case "auto_submitted":
      return {
        tone: "warning" as const,
        title: "Attempt auto-submitted",
        message: "This attempt was submitted automatically.",
      };
    case "disqualified":
      return {
        tone: "destructive" as const,
        title: "Attempt disqualified",
        message: "This attempt is no longer editable.",
      };
    case "submitted":
      return {
        tone: "default" as const,
        title: "Attempt submitted",
        message: "This attempt has already been submitted and is no longer editable.",
      };
    default:
      return null;
  }
}

function getInitialAnswerValue(problem: ArenaProblem, answer: ArenaAttemptAnswer | undefined) {
  if (!answer) {
    return "";
  }

  if (problem.type === "numeric" || problem.type === "identification") {
    return answer.answerLatex;
  }

  return answer.answerTextNormalized;
}

async function readJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T;
  return payload;
}

function getFinalSubmissionPath(competitionId: string, attemptId: string) {
  return `/mathlete/competition/${competitionId}/review?attemptId=${attemptId}`;
}

export function ArenaExperience({ initialData }: ArenaExperienceProps) {
  const [pageData, setPageData] = useState(initialData);
  const [selectedProblemId, setSelectedProblemId] = useState(
    initialData.problems[0]?.competitionProblemId ?? "",
  );
  const [tabSwitchWarningOpen, setTabSwitchWarningOpen] = useState(false);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [acknowledgements, setAcknowledgements] = useState({
    rules: false,
    device: false,
    stability: false,
  });
  const pendingSavesRef = useRef<Map<string, PendingSave>>(new Map());
  const answersRef = useRef<Map<string, RuntimeAnswer>>(new Map());
  const [answersState, setAnswersState] = useState<Map<string, RuntimeAnswer>>(new Map());
  const [remainingSeconds, setRemainingSeconds] = useState(
    initialData.activeAttempt?.remainingSeconds ?? 0,
  );
  const [connectionState, setConnectionState] = useState<"live" | "syncing" | "offline">("live");
  const [timerAnnouncement, setTimerAnnouncement] = useState("");
  const expiryHandledAttemptRef = useRef<string | null>(null);
  const competitionEndHandledAttemptRef = useRef<string | null>(null);
  const [competitionEndFinalization, setCompetitionEndFinalization] = useState<
    "idle" | "submitting" | "submitted" | "error"
  >("idle");
  const router = useRouter();

  function clearPendingSaves() {
    for (const pending of pendingSavesRef.current.values()) {
      window.clearTimeout(pending.timeoutId);
    }
    pendingSavesRef.current.clear();
  }

  function buildRuntimeAnswers(data: ArenaPageData) {
    const nextAnswers = new Map<string, RuntimeAnswer>();

    for (const problem of data.problems) {
      const answer = data.activeAttempt?.answers.find(
        (entry) => entry.competitionProblemId === problem.competitionProblemId,
      );
      nextAnswers.set(problem.competitionProblemId, {
        id: answer?.id ?? `blank-${problem.competitionProblemId}`,
        attemptId: answer?.attemptId ?? data.activeAttempt?.id ?? "",
        competitionProblemId: problem.competitionProblemId,
        answerLatex: answer?.answerLatex ?? "",
        answerTextNormalized: answer?.answerTextNormalized ?? "",
        statusFlag: answer?.statusFlag ?? "blank",
        lastSavedAt: answer?.lastSavedAt ?? "",
        clientUpdatedAt: answer?.clientUpdatedAt ?? "",
        localValue: getInitialAnswerValue(problem, answer),
      });
    }

    return nextAnswers;
  }

  const applyPageData = useEffectEvent((data: ArenaPageData, options: ApplyPageDataOptions = {}) => {
    const preservePending = Boolean(options.preservePending && data.activeAttempt);
    const nextAnswers = buildRuntimeAnswers(data);

    if (!preservePending) {
      clearPendingSaves();
    } else {
      for (const [problemId, pending] of pendingSavesRef.current.entries()) {
        const existing = nextAnswers.get(problemId);
        const problem = data.problems.find((entry) => entry.competitionProblemId === problemId);
        if (!existing || !problem) {
          continue;
        }

        nextAnswers.set(problemId, {
          ...existing,
          answerLatex:
            problem.type === "numeric" || problem.type === "identification"
              ? pending.value
              : existing.answerLatex,
          answerTextNormalized:
            problem.type === "numeric" || problem.type === "identification"
              ? existing.answerTextNormalized
              : pending.value,
          statusFlag: pending.statusFlag,
          clientUpdatedAt: pending.clientUpdatedAt,
          localValue: pending.value,
        });
      }
    }

    answersRef.current = nextAnswers;
    setAnswersState(new Map(nextAnswers));
    setPageData(data);
    setSelectedProblemId((current) =>
      data.problems.some((problem) => problem.competitionProblemId === current)
        ? current
        : data.problems[0]?.competitionProblemId ?? "",
    );
    setRemainingSeconds(data.activeAttempt?.remainingSeconds ?? 0);

    if (options.resetRequest) {
      setRequestState("idle");
      setRequestMessage(null);
    }
  });

  useEffect(() => {
    applyPageData(initialData, {
      preservePending: false,
      resetRequest: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent callback intentionally excluded; adding it replays stale initialData.
  }, [initialData]);

  const refreshState = useEffectEvent(async (options?: ApplyPageDataOptions) => {
    setConnectionState("syncing");
    const response = await fetch(
      `/api/mathlete/competition/${pageData.competition.id}/state`,
      {
        method: "GET",
        cache: "no-store",
      },
    );

    if (!response.ok) {
      setConnectionState("offline");
      return;
    }

    const payload = await readJson<{ data: ArenaPageData }>(response);
    applyPageData(payload.data, {
      preservePending: options?.preservePending ?? true,
    });
    setConnectionState("live");
  });

  const closeInterval = useEffectEvent(async () => {
    if (!pageData.activeAttempt) {
      return;
    }

    await fetch(`/api/mathlete/competition/${pageData.competition.id}/close`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attemptId: pageData.activeAttempt.id,
      }),
      keepalive: true,
    });
  });

  const flushAllSaves = useEffectEvent(async (options?: FlushSaveOptions) => {
    const saves = Array.from(pendingSavesRef.current.keys());
    for (const problemId of saves) {
      await flushSave(problemId, options);
    }
  });

  const flushAndCloseInterval = useEffectEvent(async () => {
    await flushAllSaves({
      keepalive: true,
    });
    await closeInterval();
  });

  const finalizeEndedCompetition = useEffectEvent(async () => {
    const attemptId = pageData.activeAttempt?.id;
    if (!attemptId) {
      return;
    }

    setCompetitionEndFinalization("submitting");
    setRequestState("pending");
    setRequestMessage(null);

    try {
      await flushAllSaves();

      const response = await fetch(`/api/mathlete/competition/${pageData.competition.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId,
        }),
      });
      const payload = await readJson<SubmitAttemptResponse>(response);

      if (!response.ok) {
        setCompetitionEndFinalization("error");
        setRequestState("error");
        setRequestMessage(payload.message ?? "Competition ended, but automatic submission failed.");
        return;
      }

      const submittedAttemptId = payload.data?.attempt?.id ?? attemptId;
      setCompetitionEndFinalization("submitted");
      setRequestState("idle");
      setRequestMessage(null);
      router.push(getFinalSubmissionPath(pageData.competition.id, submittedAttemptId));
    } catch {
      setCompetitionEndFinalization("error");
      setRequestState("error");
      setRequestMessage("Competition ended, but automatic submission failed. Check connection and try again.");
    }
  });

  const activeAttemptId = pageData.activeAttempt?.id ?? null;
  const competitionHasEnded =
    pageData.competition.status === "ended" || pageData.competition.status === "archived";
  const latestAttempt = pageData.latestAttempt;
  const shouldOpenFinalSubmissionPage =
    !activeAttemptId &&
    latestAttempt?.status !== "disqualified" &&
    isTerminalAttemptStatus(latestAttempt?.status) &&
    (competitionHasEnded || latestAttempt?.status === "auto_submitted");
  const useFinalMinutePolling = remainingSeconds <= 60;

  useEffect(() => {
    if (!latestAttempt || !shouldOpenFinalSubmissionPage) {
      return;
    }

    router.replace(getFinalSubmissionPath(pageData.competition.id, latestAttempt.id));
  }, [
    latestAttempt,
    pageData.competition.id,
    router,
    shouldOpenFinalSubmissionPage,
  ]);

  useEffect(() => {
    if (!activeAttemptId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeAttemptId]);

  useEffect(() => {
    setTimerAnnouncement(getTimerAnnouncementText(remainingSeconds));
  }, [remainingSeconds]);

  useEffect(() => {
    if (!activeAttemptId) {
      expiryHandledAttemptRef.current = null;
      return;
    }

    if (remainingSeconds > 0) {
      return;
    }

    if (expiryHandledAttemptRef.current === activeAttemptId) {
      return;
    }

    expiryHandledAttemptRef.current = activeAttemptId;
    void (async () => {
      await flushAllSaves();
      await refreshState({
        preservePending: false,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent callbacks read latest state without deps.
  }, [activeAttemptId, remainingSeconds]);

  useEffect(() => {
    if (!activeAttemptId || !competitionHasEnded) {
      if (!activeAttemptId) {
        competitionEndHandledAttemptRef.current = null;
        setCompetitionEndFinalization("idle");
      }
      return;
    }

    if (competitionEndHandledAttemptRef.current === activeAttemptId) {
      return;
    }

    competitionEndHandledAttemptRef.current = activeAttemptId;
    void finalizeEndedCompetition();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent callback reads latest state without restarting finalization.
  }, [activeAttemptId, competitionHasEnded]);

  useEffect(() => {
    if (!activeAttemptId) {
      return;
    }

    const refresh = () => {
      void refreshState();
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        setConnectionState("syncing");
        void refreshState();
      } else {
        void flushAndCloseInterval();
      }
    };

    const offlineHandler = () => setConnectionState("offline");
    const onlineHandler = () => {
      setConnectionState("syncing");
      void refreshState();
    };

    const pollIntervalId = window.setInterval(() => {
      void refreshState();
    }, useFinalMinutePolling ? 5000 : 10000);
    const pagehideHandler = () => {
      void flushAndCloseInterval();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("pagehide", pagehideHandler);
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      window.clearInterval(pollIntervalId);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
      window.removeEventListener("pagehide", pagehideHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent callbacks excluded so interval does not reset every render.
  }, [activeAttemptId, useFinalMinutePolling]);

  useEffect(() => {
    if (!activeAttemptId || pageData.competition.format !== "team") {
      return;
    }

    const client = createBrowserClient();
    const answerChannel = client
      .channel(`arena-answer-sync-${activeAttemptId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attempt_answers",
          filter: `attempt_id=eq.${activeAttemptId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          const problemId = typeof next.competition_problem_id === "string" ? next.competition_problem_id : "";
          if (!problemId) {
            return;
          }

          const existing = answersRef.current.get(problemId);
          const nextAnswer: RuntimeAnswer = {
            id: typeof next.id === "string" ? next.id : existing?.id ?? `blank-${problemId}`,
            attemptId:
              typeof next.attempt_id === "string" ? next.attempt_id : existing?.attemptId ?? "",
            competitionProblemId: problemId,
            answerLatex:
              typeof next.answer_latex === "string" ? next.answer_latex : existing?.answerLatex ?? "",
            answerTextNormalized:
              typeof next.answer_text_normalized === "string"
                ? next.answer_text_normalized
                : existing?.answerTextNormalized ?? "",
            statusFlag:
              typeof next.status_flag === "string"
                ? (next.status_flag as AnswerStatusFlag)
                : existing?.statusFlag ?? "blank",
            lastSavedAt:
              typeof next.last_saved_at === "string" ? next.last_saved_at : existing?.lastSavedAt ?? "",
            clientUpdatedAt:
              typeof next.client_updated_at === "string"
                ? next.client_updated_at
                : existing?.clientUpdatedAt ?? "",
            localValue:
              existing?.localValue ??
              (typeof next.answer_latex === "string"
                ? next.answer_latex
                : typeof next.answer_text_normalized === "string"
                  ? next.answer_text_normalized
                  : ""),
          };

          const cloned = new Map(answersRef.current);
          cloned.set(problemId, nextAnswer);
          answersRef.current = cloned;
          setAnswersState(new Map(cloned));
        },
      )
      .subscribe();

    const attemptChannel = client
      .channel(`arena-attempt-sync-${activeAttemptId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_attempts",
          filter: `id=eq.${activeAttemptId}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          if (typeof next.status === "string" && next.status !== "in_progress") {
            void refreshState();
          }
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(answerChannel);
      void client.removeChannel(attemptChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- useEffectEvent callback excluded; channel lifetime follows attempt id only.
  }, [activeAttemptId, pageData.competition.format]);

  async function startOrResumeAttempt() {
    const isOpenDirectEntry = pageData.competition.type === "open";
    if (!pageData.registration && !isOpenDirectEntry) {
      return;
    }

    setRequestState("pending");
    setRequestMessage(null);

    const endpoint = pageData.activeAttempt ? "resume" : "start";
    const response = await fetch(`/api/mathlete/competition/${pageData.competition.id}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        registrationId: pageData.registration?.id ?? null,
        attemptId: pageData.activeAttempt?.id ?? null,
      }),
    });

    const payload = await readJson<{ code?: string; message?: string; data?: ArenaPageData }>(response);
    if (!response.ok || !payload.data) {
      setRequestState("error");
      setRequestMessage(payload.message ?? "Attempt start failed.");
      return;
    }

    applyPageData(payload.data, {
      preservePending: false,
      resetRequest: true,
    });
  }

  async function openReviewPage() {
    if (!pageData.activeAttempt) {
      return;
    }

    await flushAllSaves();
    router.push(`/mathlete/competition/${pageData.competition.id}/review?attemptId=${pageData.activeAttempt.id}`);
  }

  async function withdrawRegistration() {
    if (!pageData.registration || pageData.activeAttempt || pageData.latestAttempt || withdrawPending) {
      return;
    }

    setWithdrawPending(true);
    setRequestState("pending");
    setRequestMessage(null);

    try {
      const response = await fetch("/api/mathlete/competition/withdraw", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          registrationId: pageData.registration.id,
          competitionId: pageData.competition.id,
          statusReason: pageData.registration.teamId ? "team_withdrew" : "participant_withdrew",
          requestIdempotencyToken: createIdempotencyToken(),
        }),
      });

      const payload = await readJson<{ tone?: string; message?: string }>(response);
      const message = payload.message ?? "Withdrawal failed.";

      if (!response.ok || payload.tone === "error") {
        setRequestState("error");
        setRequestMessage(message);
        return;
      }

      setWithdrawDialogOpen(false);
      setRequestState("idle");
      setRequestMessage(message);
      await refreshState({
        preservePending: false,
        resetRequest: false,
      });
      router.refresh();
    } catch {
      setRequestState("error");
      setRequestMessage("Withdrawal failed.");
    } finally {
      setWithdrawPending(false);
    }
  }

  async function flushSave(problemId: string, options?: FlushSaveOptions) {
    const pending = pendingSavesRef.current.get(problemId);
    if (!pending || !pageData.activeAttempt) {
      return;
    }

    window.clearTimeout(pending.timeoutId);
    pendingSavesRef.current.delete(problemId);
    const problem = pageData.problems.find((entry) => entry.competitionProblemId === problemId);
    if (!problem) {
      return;
    }

    const response = await fetch(`/api/mathlete/competition/${pageData.competition.id}/answer`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attemptId: pageData.activeAttempt.id,
        competitionProblemId: problemId,
        problemType: problem.type,
        rawValue: pending.value,
        statusFlag: pending.statusFlag,
        clientUpdatedAt: pending.clientUpdatedAt,
      } satisfies Omit<SaveArenaAnswerInput, "actorUserId">),
      keepalive: options?.keepalive,
    });

    const payload = await readJson<{
      code?: string;
      message?: string;
      machineCode?: string;
      data?: { lastSavedAt?: string | null };
    }>(response);

    if (!response.ok || payload.machineCode === "answer_write_conflict") {
      await refreshState({
        preservePending: false,
      });
      return;
    }

    const nextAnswers = new Map(answersRef.current);
    const existing = nextAnswers.get(problemId);
    if (existing) {
      nextAnswers.set(problemId, {
        ...existing,
        answerLatex:
          problem.type === "numeric" || problem.type === "identification"
            ? pending.value
            : existing.answerLatex,
        answerTextNormalized:
          problem.type === "numeric" || problem.type === "identification"
            ? existing.answerTextNormalized
            : pending.value,
        statusFlag: pending.statusFlag,
        lastSavedAt: payload.data?.lastSavedAt ?? existing.lastSavedAt,
        clientUpdatedAt: pending.clientUpdatedAt,
        localValue: pending.value,
      });
      answersRef.current = nextAnswers;
      setAnswersState(new Map(nextAnswers));
    }
  }

  function queueSave(problem: ArenaProblem, value: string, statusFlag: AnswerStatusFlag) {
    const current = pendingSavesRef.current.get(problem.competitionProblemId);
    if (current) {
      window.clearTimeout(current.timeoutId);
    }

    const clientUpdatedAt = new Date().toISOString();
    const timeoutId = window.setTimeout(() => {
      void flushSave(problem.competitionProblemId);
    }, 600);

    pendingSavesRef.current.set(problem.competitionProblemId, {
      clientUpdatedAt,
      value,
      statusFlag,
      timeoutId,
    });
  }

  function updateAnswer(problem: ArenaProblem, value: string, explicitStatusFlag?: AnswerStatusFlag) {
    const existing = answersRef.current.get(problem.competitionProblemId);
    const nextStatusFlag = resolvePersistedAnswerStatusFlag(
      problem.type,
      value,
      explicitStatusFlag,
    );
    const nextAnswers = new Map(answersRef.current);
    nextAnswers.set(problem.competitionProblemId, {
      id: existing?.id ?? `blank-${problem.competitionProblemId}`,
      attemptId: existing?.attemptId ?? pageData.activeAttempt?.id ?? "",
      competitionProblemId: problem.competitionProblemId,
      answerLatex: problem.type === "numeric" || problem.type === "identification" ? value : "",
      answerTextNormalized:
        problem.type === "numeric" || problem.type === "identification" ? existing?.answerTextNormalized ?? "" : value,
      statusFlag: nextStatusFlag,
      lastSavedAt: existing?.lastSavedAt ?? "",
      clientUpdatedAt: existing?.clientUpdatedAt ?? "",
      localValue: value,
    });

    answersRef.current = nextAnswers;
    setAnswersState(new Map(nextAnswers));
    queueSave(problem, value, nextStatusFlag);
  }

  const answers = answersState;
  const selectedProblem =
    pageData.problems.find((problem) => problem.competitionProblemId === selectedProblemId) ??
    pageData.problems[0] ??
    null;
  const selectedAnswer = selectedProblem
    ? answers.get(selectedProblem.competitionProblemId)
    : undefined;
  const canStart = Boolean(
    pageData.attemptsRemaining > 0 &&
      ((pageData.registration?.status === "registered" && pageData.registration.actorCanStart) ||
        (pageData.competition.type === "open" && !pageData.registration)),
  );
  const safeExamBrowserRequired = pageData.competition.safeExamBrowserMode === "required";
  const safeExamBrowserConfigHref = `/api/mathlete/competition/${pageData.competition.id}/safe-exam-browser-config`;
  const canWrite = Boolean(
    pageData.registration?.actorCanWrite &&
      pageData.activeAttempt &&
      !competitionHasEnded &&
      competitionEndFinalization === "idle",
  );
  const canWithdraw = Boolean(
    pageData.registration?.status === "registered" && !pageData.activeAttempt && !pageData.latestAttempt,
  );
  const selectedProblemIndex = selectedProblem
    ? pageData.problems.findIndex((problem) => problem.competitionProblemId === selectedProblem.competitionProblemId)
    : -1;
  const selectedStatus = selectedAnswer?.statusFlag ?? "blank";
  const terminalAttemptNotice = getAttemptTerminalNotice(pageData.latestAttempt?.status);
  const selectedProblemTitle = selectedProblem
    ? `Problem #${selectedProblem.orderIndex}`
    : "Problem";
  const entryLabel = pageData.registration?.teamName
    ? pageData.registration.teamName
    : pageData.registration
      ? "Individual"
      : "Open access";

  return (
    <div
      className={cn(
        "min-h-screen bg-[#fafafb] px-4 py-6 font-['Poppins'] text-[#1a1e2e] sm:px-6 lg:px-10",
        pageData.mode === "arena_runtime" ? "arena-runtime-focus" : "",
      )}
    >
      <TabSwitchWarningObserver
        isActive={!!pageData.activeAttempt && pageData.activeAttempt.status === "in_progress"}
        onWarning={() => setTabSwitchWarningOpen(true)}
      />
      <TabSwitchWarningOverlay
        open={tabSwitchWarningOpen}
        onAcknowledge={() => setTabSwitchWarningOpen(false)}
      />
      {pageData.mode !== "arena_runtime" ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Mathlete
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {pageData.competition.status}
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-foreground">
                {pageData.mode.replace("_", " ")}
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-[#1a1e2e]">
              {pageData.competition.name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              {pageData.competition.description || "Competition details and arena controls live here."}
            </p>
          </div>

          {pageData.activeAttempt ? (
            <div className="rounded-3xl border border-slate-100 bg-white px-5 py-4 text-right shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                Remaining Time
              </p>
              <p className="mt-2 font-mono text-3xl font-black text-[#1a1e2e]">
                {formatTimerText(remainingSeconds)}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Sync: {connectionState}
              </p>
              <span className="sr-only" aria-live="polite">
                {timerAnnouncement}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {requestMessage ? (
        <Alert variant={requestState === "error" ? "destructive" : "default"}>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {requestState === "error" ? "Action blocked" : "Arena update"}
          </p>
          <AlertDescription>{requestMessage}</AlertDescription>
        </Alert>
      ) : null}

      {competitionHasEnded && pageData.activeAttempt ? (
        <Alert className="mt-4 border-2 border-[#f49700]/40 bg-[#fff7e8] text-[#8a5400]" role="status">
          <p className="mb-2 text-sm font-black">Competition ended</p>
          <AlertDescription>
            {competitionEndFinalization === "error"
              ? "Your work is locked. Automatic submission could not complete, so keep this page open and check your connection."
              : competitionEndFinalization === "submitted"
                ? "Your attempt was submitted. Redirecting to the final submission page."
                : "Your work is locked. Saving pending answers, submitting your attempt, and opening the final submission page."}
          </AlertDescription>
        </Alert>
      ) : null}

      {terminalAttemptNotice ? (
        <Alert
          variant={terminalAttemptNotice.tone === "destructive" ? "destructive" : "default"}
          className={cn(
            "mt-4 border-2",
            terminalAttemptNotice.tone === "warning"
              ? "border-[#f49700]/40 bg-[#fff7e8] text-[#8a5400]"
              : "",
          )}
          role="alert"
        >
          <p className="mb-2 text-sm font-black">{terminalAttemptNotice.title}</p>
          <AlertDescription>{terminalAttemptNotice.message}</AlertDescription>
        </Alert>
      ) : null}

      {pageData.mode === "detail_register" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Arena unavailable</CardTitle>
              <CardDescription>
                Branch 11 owns only pre-entry and runtime. Detail/register stays out of this branch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 text-sm text-muted-foreground">
                <p>Arena runtime stays locked until server promotes this route into pre-entry or active attempt.</p>
                <p>{formatCompetitionWindow("Starts", pageData.competition.startTime)}</p>
                <p>{formatCompetitionWindow("Ends", pageData.competition.endTime)}</p>
              </div>

              <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-semibold text-foreground">Fail-closed behavior</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Registration controls are intentionally absent here. If registration is missing,
                  this branch does not recreate branch-10 detail flow.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle>Entry status</CardTitle>
              <CardDescription>
                Register first, then this same route upgrades into pre-entry or arena runtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pageData.registration ? (
                <div className="rounded-3xl border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">
                    Registered
                    {pageData.registration.teamName ? ` as ${pageData.registration.teamName}` : ""}
                  </p>
                  <p className="mt-2">
                    Current status: {pageData.registration.status}
                    {pageData.latestAttempt ? `, latest attempt ${pageData.latestAttempt.status}` : ""}.
                  </p>
                  {!pageData.registration.actorCanStart ? (
                    <p className="mt-2 text-[#8a5400]">
                      Only active members of the registered team can start or submit team attempts.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {!pageData.registration && pageData.canRegister ? (
                <p className="text-sm text-muted-foreground">
                  Registration flow is not rendered by this branch. Arena stays closed until server
                  returns pre-entry or runtime mode.
                </p>
              ) : null}

              {!pageData.registration && !pageData.canRegister ? (
                <p className="text-sm text-muted-foreground">
                  Arena entry is unavailable until registration and lifecycle gates allow it.
                </p>
              ) : null}

            </CardContent>
          </Card>
        </div>
      ) : null}

      {pageData.mode === "pre_entry" ? (
        <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#f49700]">
              Arena pre-entry
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-[#1a1e2e]">
              Rules and instructions acknowledgement
            </h2>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-500">
              {pageData.competition.instructions || "Read organizer instructions before starting."}
            </p>

            <div className="mt-8 space-y-4">
              {safeExamBrowserRequired ? (
                <div className="rounded-2xl border border-[#f49700]/30 bg-[#fff7e8] p-5 text-[#8a5400]">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-black">Safe Exam Browser required</p>
                      <p className="text-sm font-medium leading-6">
                        Download the quiz config, open it with Safe Exam Browser, then start the competition from inside SEB.
                      </p>
                      <a
                        href={safeExamBrowserConfigHref}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#10182b] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white hover:bg-[#1f2a44]"
                      >
                        <Download className="h-4 w-4" />
                        Download SEB config
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}

              <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:border-slate-200">
                <Checkbox
                  checked={acknowledgements.rules}
                  onCheckedChange={(checked) =>
                    setAcknowledgements((current) => ({ ...current, rules: checked === true }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm font-semibold leading-6 text-slate-700">
                  I read scoring and submission rules for this competition.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:border-slate-200">
                <Checkbox
                  checked={acknowledgements.device}
                  onCheckedChange={(checked) =>
                    setAcknowledgements((current) => ({ ...current, device: checked === true }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm font-semibold leading-6 text-slate-700">
                  I am responsible for keeping this device awake, connected, and ready before I enter.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-5 transition hover:border-slate-200">
                <Checkbox
                  checked={acknowledgements.stability}
                  onCheckedChange={(checked) =>
                    setAcknowledgements((current) => ({ ...current, stability: checked === true }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm font-semibold leading-6 text-slate-700">
                  I understand reconnecting does not restore lost time because server timer keeps running.
                </span>
              </label>
            </div>
          </div>

          <aside className="flex flex-col gap-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-400">
                Entry summary
              </p>
              <div className="mt-5 divide-y divide-slate-100 rounded-2xl border border-slate-100">
                {[
                  ["Format", pageData.competition.format],
                  ["Attempt window", `${pageData.competition.durationMinutes} minutes`],
                  ["Attempts remaining", pageData.attemptsRemaining.toString()],
                  ["Entry", entryLabel],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {label}
                    </span>
                    <span className="text-right text-sm font-black capitalize text-[#1a1e2e]">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {pageData.registration && !pageData.registration.actorCanStart ? (
              <Alert>
                <p className="mb-2 text-sm font-semibold text-foreground">Team membership required</p>
                <AlertDescription>
                  You must be an active member of the registered team to open the runtime.
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              className="mt-auto h-auto w-full rounded-xl bg-[#f49700] py-5 text-sm font-black uppercase tracking-[0.18em] text-white hover:bg-[#e08900]"
              onClick={() => void startOrResumeAttempt()}
              pending={requestState === "pending"}
              pendingText="Opening arena"
              disabled={
                requestState === "pending" ||
                !canStart ||
                !acknowledgements.rules ||
                !acknowledgements.device ||
                !acknowledgements.stability
              }
            >
              Start competition
            </Button>
            {canWithdraw ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto w-full rounded-xl border-2 border-slate-200 py-3 font-bold text-[#1a1e2e] hover:bg-slate-50"
                onClick={() => setWithdrawDialogOpen(true)}
                disabled={requestState === "pending"}
              >
                Withdraw registration
              </Button>
            ) : null}
          </aside>
        </section>
      ) : null}

      {pageData.mode === "arena_runtime" && selectedProblem ? (
        <div className="flex min-h-screen flex-col justify-center gap-6 py-4 sm:py-6 lg:flex-row">
          <main className="flex w-full max-w-[960px] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(26,30,46,0.45)] ring-1 ring-slate-100 sm:p-8 lg:p-10">
            <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <h2 className="max-w-[560px] text-3xl font-black leading-tight tracking-tight text-[#1a1e2e] md:text-4xl">
                  {selectedProblemTitle}
                </h2>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                <div className="flex min-w-[78px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Difficulty
                  </span>
                  <span className="text-[13px] font-black uppercase text-[#f49700]">
                    {selectedProblem.difficulty ?? "Average"}
                  </span>
                </div>
                <div className="flex min-w-[78px] flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Score Weight
                  </span>
                  <span className="text-[13px] font-black text-[#1a1e2e]">
                    {selectedProblem.points ?? "-"}
                  </span>
                </div>
                <div className={cn("col-span-2 flex min-w-[78px] flex-col items-center justify-center rounded-xl border p-3", getBadgeStatusClassName(selectedStatus))}>
                  <span className="mb-1 text-[9px] font-bold uppercase tracking-wider opacity-70">
                    Status
                  </span>
                  <span className="text-[13px] font-black uppercase">
                    {formatStatusLabel(selectedStatus)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-8 rounded-[20px] border border-slate-200 bg-slate-50 p-5 text-slate-700 shadow-inner shadow-slate-200/50">
              <KatexPreview
                latex={selectedProblem.contentLatex}
                className="min-h-24 text-base leading-7 md:text-lg"
                label={null}
                variant="arena"
                fallbackText="Problem statement unavailable."
              />
            </div>

            {selectedProblem.imagePath ? (
              <div className="mb-8 flex min-h-[220px] items-center justify-center overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50 p-6 shadow-inner shadow-slate-200/50">
                {/* eslint-disable-next-line @next/next/no-img-element -- problem images may be Supabase/public asset paths outside Next image config. */}
                <img
                  src={selectedProblem.imagePath}
                  alt={`${selectedProblemTitle} reference`}
                  className="max-h-[320px] w-auto max-w-full object-contain"
                />
              </div>
            ) : null}

            {selectedProblem.type === "mcq" || selectedProblem.type === "tf" ? (
              <div className="mb-10 grid gap-4">
                {selectedProblem.options.map((option, optionIndex) => {
                  const selected = (selectedAnswer?.localValue ?? "") === option.id;
                  const optionMarker = formatOptionMarker(optionIndex);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-4 rounded-[20px] border-2 p-5 text-left transition",
                        selected
                          ? "border-[#f49700] bg-[#fff7e8] text-[#1a1e2e] shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:border-[#f49700]/40 hover:bg-slate-50",
                      )}
                      aria-pressed={selected}
                      aria-label={`Option ${optionMarker}`}
                      disabled={!canWrite}
                      onClick={() => updateAnswer(selectedProblem, option.id)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black",
                          selected
                            ? "border-[#f49700] bg-[#f49700] text-white"
                            : "border-slate-300 bg-white text-slate-500",
                        )}
                      >
                        {optionMarker}
                      </span>
                      <span className="min-w-0 flex-1 text-base md:text-lg">
                        <KatexPreview
                          latex={option.label}
                          label={null}
                          variant="choice"
                          className={cn("min-w-0 leading-6", selected ? "font-bold" : "")}
                          fallbackText={option.label}
                        />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mb-10">
                <MathliveField
                  id={`arena-answer-${selectedProblem.competitionProblemId}`}
                  label="Your answer"
                  value={selectedAnswer?.localValue ?? ""}
                  disabled={!canWrite}
                  preferredInitialMode={selectedProblem.type === "identification" ? "text" : "math"}
                  onChange={(nextValue) => updateAnswer(selectedProblem, nextValue)}
                  description="Answers autosave after a short idle window and on visibility changes."
                  previewLabel="Answer preview"
                  showPreviewToggle
                  variant="arena"
                />
              </div>
            )}

            {!pageData.registration?.actorCanWrite ? (
              <Alert className="mb-6">
                <p className="mb-2 text-sm font-semibold text-foreground">Read-only runtime</p>
                <AlertDescription>
                  You must be an active member of the registered team to write or submit.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-auto flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-6 sm:flex-row">
              <button
                type="button"
                onClick={() => updateAnswer(selectedProblem, selectedAnswer?.localValue ?? "", selectedStatus === "solved" ? "filled" : "solved")}
                disabled={!canWrite}
                className={cn(
                  "flex items-center gap-2 text-sm font-bold transition disabled:opacity-50",
                  selectedStatus === "solved" ? "text-[#f49700]" : "text-slate-400 hover:text-slate-600",
                )}
              >
                <Bookmark className="h-5 w-5" fill={selectedStatus === "solved" ? "currentColor" : "none"} />
                Mark as Solved
              </button>

              <div className="flex w-full gap-4 sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-1 rounded-xl border-2 border-slate-300 bg-white px-5 py-3 font-bold text-[#1a1e2e] shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:text-[#1a1e2e] sm:flex-none"
                  disabled={selectedProblemIndex <= 0}
                  onClick={() => {
                    const previousProblem = pageData.problems[selectedProblemIndex - 1];
                    if (!previousProblem) {
                      return;
                    }
                    void flushAllSaves();
                    setSelectedProblemId(previousProblem.competitionProblemId);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous Problem
                </Button>
                <Button
                  type="button"
                  className="h-auto flex-1 rounded-xl bg-[#1a1e2e] px-6 py-3 font-bold text-white shadow-lg shadow-[#1a1e2e]/20 hover:bg-[#0f121a] sm:flex-none"
                  disabled={selectedProblemIndex < 0 || selectedProblemIndex >= pageData.problems.length - 1}
                  onClick={() => {
                    const nextProblem = pageData.problems[selectedProblemIndex + 1];
                    if (!nextProblem) {
                      return;
                    }
                    void flushAllSaves();
                    setSelectedProblemId(nextProblem.competitionProblemId);
                  }}
                >
                  Next Problem
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  className="h-auto flex-1 rounded-xl bg-[#f49700] px-6 py-3 font-bold text-white shadow-lg shadow-[#f49700]/20 hover:bg-[#e08900] sm:flex-none"
                  disabled={!pageData.registration?.actorCanWrite}
                  onClick={() => void openReviewPage()}
                >
                  Review & Submit
                </Button>
              </div>
            </div>
          </main>

          <aside className="w-full shrink-0 lg:w-[340px]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-34px_rgba(26,30,46,0.42)] ring-1 ring-slate-100">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-[#1a1e2e]">
                  Question Grid
                </h3>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-500">
                  Set 1 of 1
                </span>
              </div>

              <div className="grid grid-cols-6 gap-2">
                {pageData.problems.map((problem) => {
                  const answer = answers.get(problem.competitionProblemId);
                  const statusFlag = answer?.statusFlag ?? "blank";
                  const isCurrent = selectedProblemId === problem.competitionProblemId;

                  return (
                    <button
                      key={problem.competitionProblemId}
                      type="button"
                      aria-label={`Q${problem.orderIndex} ${formatStatusLabel(statusFlag)}`}
                      onClick={() => {
                        void flushAllSaves();
                        setSelectedProblemId(problem.competitionProblemId);
                      }}
                      className={cn(
                        "flex aspect-square w-full items-center justify-center rounded-lg border text-[13px] font-bold transition hover:scale-105",
                        getProblemStatusClassName(statusFlag),
                        isCurrent ? "border-2 border-[#f49700]" : "border-transparent",
                      )}
                    >
                      {problem.orderIndex}
                    </button>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      <ConfirmDialog
        open={withdrawDialogOpen}
        onOpenChange={setWithdrawDialogOpen}
        title="Withdraw registration?"
        description="This cancels your registration for this competition. You can register again while the registration window remains open."
        confirmLabel="Withdraw"
        confirmVariant="destructive"
        onConfirm={() => void withdrawRegistration()}
        pending={withdrawPending}
        pendingLabel="Withdrawing"
      />
    </div>
  );
}
