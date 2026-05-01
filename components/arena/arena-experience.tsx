"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Bookmark, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { AntiCheatObserver, PenaltyApplied } from "@/components/anti-cheat/anti-cheat-observer";
import { WarningOverlay } from "@/components/anti-cheat/warning-overlay";
import { MathliveField } from "@/components/math-editor/mathlive-field";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressLink } from "@/components/ui/progress-link";
import { createIdempotencyToken } from "@/components/competitions/utils";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatTimerText, getTimerAnnouncementText, resolvePersistedAnswerStatusFlag } from "@/lib/arena/helpers";
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

export function ArenaExperience({ initialData }: ArenaExperienceProps) {
  const [pageData, setPageData] = useState(initialData);
  const [selectedProblemId, setSelectedProblemId] = useState(
    initialData.problems[0]?.competitionProblemId ?? "",
  );
  const [activePenalty, setActivePenalty] = useState<PenaltyApplied>(null);
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
  const [withdrawPending, setWithdrawPending] = useState(false);
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
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

  const activeAttemptId = pageData.activeAttempt?.id ?? null;
  const useFinalMinutePolling = remainingSeconds <= 60;

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

  async function submitAttempt() {
    if (!pageData.activeAttempt) {
      return;
    }

    setSubmitPending(true);
    await flushAllSaves();
    const response = await fetch(`/api/mathlete/competition/${pageData.competition.id}/submit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        attemptId: pageData.activeAttempt.id,
      }),
    });
    const payload = await readJson<{ code?: string; message?: string; data?: ArenaPageData }>(response);
    setSubmitPending(false);

    if (!response.ok || !payload.data) {
      setRequestState("error");
      setRequestMessage(payload.message ?? "Submit failed.");
      return;
    }

    setSubmitDialogOpen(false);
    applyPageData(payload.data, {
      preservePending: false,
      resetRequest: true,
    });
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
  const canWrite = Boolean(pageData.registration?.actorCanWrite && pageData.activeAttempt);
  const canWithdraw = Boolean(
    pageData.registration?.status === "registered" && !pageData.activeAttempt && !pageData.latestAttempt,
  );
  const selectedProblemIndex = selectedProblem
    ? pageData.problems.findIndex((problem) => problem.competitionProblemId === selectedProblem.competitionProblemId)
    : -1;
  const blankCount = pageData.problems.filter((problem) => {
    const statusFlag = answers.get(problem.competitionProblemId)?.statusFlag ?? "blank";
    return statusFlag === "blank" || statusFlag === "reset";
  }).length;
  const filledCount = pageData.problems.filter(
    (problem) => (answers.get(problem.competitionProblemId)?.statusFlag ?? "blank") === "filled",
  ).length;
  const solvedCount = pageData.problems.filter(
    (problem) => (answers.get(problem.competitionProblemId)?.statusFlag ?? "blank") === "solved",
  ).length;
  const selectedStatus = selectedAnswer?.statusFlag ?? "blank";
  const selectedProblemTitle = selectedProblem
    ? `Problem #${selectedProblem.orderIndex}`
    : "Problem";
  const entryLabel = pageData.registration?.teamName
    ? pageData.registration.teamName
    : pageData.registration
      ? "Individual"
      : "Open access";

  return (
    <div className="min-h-screen bg-[#fafafb] px-4 py-6 font-['Poppins'] text-[#1a1e2e] sm:px-6 lg:px-10">
      <AntiCheatObserver
        attemptId={pageData.activeAttempt?.id ?? ""}
        isActive={!!pageData.activeAttempt && pageData.activeAttempt.status === "in_progress"}
        onPenalty={(penalty) => {
          if (penalty && penalty !== "none") {
            setActivePenalty(penalty);
            if (penalty === "auto_submit" || penalty === "disqualified") {
              setPageData((prev) => ({
                ...prev,
                activeAttempt: prev.activeAttempt
                  ? { ...prev.activeAttempt, status: penalty === "auto_submit" ? "auto_submitted" : "disqualified" }
                  : null,
              }));
            }
          }
        }}
      />
      <WarningOverlay
        penalty={activePenalty === "none" ? null : activePenalty}
        onAcknowledge={() => setActivePenalty(null)}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProgressLink
              href="/mathlete"
              className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 transition hover:text-[#1a1e2e]"
            >
              Mathlete
            </ProgressLink>
            <Badge variant="secondary">{pageData.competition.status}</Badge>
            <Badge variant="outline">{pageData.mode.replace("_", " ")}</Badge>
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

      {requestMessage ? (
        <Alert variant={requestState === "error" ? "destructive" : "default"}>
          <p className="mb-2 text-sm font-semibold text-foreground">
            {requestState === "error" ? "Action blocked" : "Arena update"}
          </p>
          <AlertDescription>{requestMessage}</AlertDescription>
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
                    <p className="mt-2 text-amber-700">
                      Only active team leader can start or submit team attempts.
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
                <p className="mb-2 text-sm font-semibold text-foreground">Leader action required</p>
                <AlertDescription>
                  Team attempt writes are leader-only. You can open runtime once leader starts.
                </AlertDescription>
              </Alert>
            ) : null}

            <Button
              type="button"
              className="mt-auto h-auto w-full rounded-xl bg-[#f49700] py-5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-[#f49700]/25 hover:bg-[#e08900]"
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
        <div className="mt-6 flex flex-col justify-center gap-8 lg:flex-row">
          <main className="flex w-full max-w-[860px] flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(26,30,46,0.45)] ring-1 ring-slate-100 sm:p-8 lg:p-10">
            <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  {pageData.competition.name}
                </p>
                <h2 className="max-w-[560px] text-3xl font-black leading-tight tracking-tight text-[#1a1e2e] md:text-4xl">
                  {selectedProblemTitle}
                </h2>
              </div>
              <div className="flex flex-wrap gap-3 sm:justify-end">
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
                    Points
                  </span>
                  <span className="text-[13px] font-black text-[#1a1e2e]">
                    {selectedProblem.points ?? "-"}
                  </span>
                </div>
                <div className={cn("flex min-w-[78px] flex-col items-center justify-center rounded-xl border p-3", getBadgeStatusClassName(selectedStatus))}>
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
                {selectedProblem.options.map((option) => {
                  const selected = (selectedAnswer?.localValue ?? "") === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={cn(
                        "flex w-full items-start gap-4 rounded-2xl border-2 p-5 text-left transition",
                        selected
                          ? "border-[#f49700] bg-[#f49700]/5 text-[#1a1e2e]"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
                      )}
                      aria-pressed={selected}
                      disabled={!canWrite}
                      onClick={() => updateAnswer(selectedProblem, option.id)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-black",
                          selected ? "border-[#f49700]" : "border-slate-300",
                        )}
                      >
                        {selected ? <span className="h-3 w-3 rounded-full bg-[#f49700]" /> : null}
                      </span>
                      <span className="flex min-w-0 flex-1 items-start gap-3 text-base md:text-lg">
                        <span className="shrink-0 font-black opacity-60">{option.id}.</span>
                        <KatexPreview
                          latex={option.label}
                          className={cn("min-w-0 flex-1 leading-6", selected ? "font-bold" : "")}
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
                  showPreviewToggle
                />
              </div>
            )}

            {!pageData.registration?.actorCanWrite ? (
              <Alert className="mb-6">
                <p className="mb-2 text-sm font-semibold text-foreground">Read-only runtime</p>
                <AlertDescription>
                  Team members can observe synced answers, but only active leader can write or submit.
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
              </div>
            </div>
          </main>

          <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-[380px]">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_42px_-34px_rgba(26,30,46,0.42)] ring-1 ring-slate-100">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h3 className="text-sm font-black uppercase tracking-wider text-[#1a1e2e]">
                  Progress Overview
                </h3>
                <div className="flex items-center gap-2 rounded-full bg-[#f49700]/10 px-3 py-1.5 text-sm font-black text-[#f49700]">
                  <Clock className="h-4 w-4" />
                  {formatTimerText(remainingSeconds)}
                </div>
              </div>
              <span className="sr-only" aria-live="polite">
                {timerAnnouncement}
              </span>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 py-4">
                  <span className="mb-1 text-2xl font-black leading-none text-slate-400">
                    {blankCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Blank
                  </span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-[#1A1E2E] bg-[#1A1E2E] py-4 shadow-sm shadow-[#1A1E2E]/20">
                  <span className="mb-1 text-2xl font-black leading-none text-white">
                    {filledCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/80">
                    Filled
                  </span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-[#fef3c7]/50 bg-[#fffbeb] py-4">
                  <span className="mb-1 text-2xl font-black leading-none text-[#f49700]">
                    {solvedCount}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#f49700]/70">
                    Solved
                  </span>
                </div>
              </div>
            </section>

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
                        isCurrent ? "border-2 border-[#f49700] shadow-md shadow-[#f49700]/30" : "border-transparent",
                      )}
                    >
                      {problem.orderIndex}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[0_14px_36px_-34px_rgba(26,30,46,0.38)] ring-1 ring-slate-100">
              <div className="grid gap-2">
                <p>
                  <span className="font-bold text-[#1a1e2e]">Attempt:</span>{" "}
                  #{pageData.activeAttempt?.attemptNo}
                </p>
                <p>
                  <span className="font-bold text-[#1a1e2e]">Sync:</span> {connectionState}
                </p>
                <p>
                  <span className="font-bold text-[#1a1e2e]">Latest save:</span>{" "}
                  {selectedAnswer?.lastSavedAt ? new Date(selectedAnswer.lastSavedAt).toLocaleTimeString() : "Pending"}
                </p>
              </div>
            </section>

            <Button
              type="button"
              className="mt-auto h-auto w-full rounded-xl bg-[#f49700] py-5 text-sm font-black uppercase tracking-[0.18em] text-white shadow-xl shadow-[#f49700]/30 hover:bg-[#e08900]"
              disabled={!pageData.registration?.actorCanWrite}
              onClick={() => setSubmitDialogOpen(true)}
            >
              Review & Submit
            </Button>
          </aside>

          <ConfirmDialog
            open={submitDialogOpen}
            onOpenChange={setSubmitDialogOpen}
            title="Submit attempt now?"
            description="This finishes the current attempt immediately. Review flow will be expanded in branch 13, but direct submit is available now for controlled completion."
            confirmLabel="Submit attempt"
            confirmVariant="default"
            onConfirm={() => void submitAttempt()}
            pending={submitPending}
            pendingLabel="Submitting"
          />
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
