"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { MathliveField } from "@/components/math-editor/mathlive-field";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressLink } from "@/components/ui/progress-link";
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
    return "border-emerald-400/70 bg-emerald-500/10 text-emerald-900";
  }

  if (status === "filled") {
    return "border-sky-400/70 bg-sky-500/10 text-sky-900";
  }

  if (status === "reset") {
    return "border-amber-400/70 bg-amber-500/10 text-amber-900";
  }

  return "border-border/70 bg-background text-muted-foreground";
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
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);
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
  }, [applyPageData, initialData]);

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

  useEffect(() => {
    if (!pageData.activeAttempt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pageData.activeAttempt]);

  useEffect(() => {
    setTimerAnnouncement(getTimerAnnouncementText(remainingSeconds));
  }, [remainingSeconds]);

  useEffect(() => {
    if (!pageData.activeAttempt) {
      expiryHandledAttemptRef.current = null;
      return;
    }

    if (remainingSeconds > 0) {
      return;
    }

    if (expiryHandledAttemptRef.current === pageData.activeAttempt.id) {
      return;
    }

    expiryHandledAttemptRef.current = pageData.activeAttempt.id;
    void (async () => {
      await flushAllSaves();
      await refreshState({
        preservePending: false,
      });
    })();
  }, [flushAllSaves, pageData.activeAttempt, refreshState, remainingSeconds]);

  useEffect(() => {
    if (!pageData.activeAttempt) {
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
    }, remainingSeconds <= 60 ? 5000 : 10000);
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
  }, [flushAndCloseInterval, pageData.activeAttempt, refreshState, remainingSeconds]);

  useEffect(() => {
    if (!pageData.activeAttempt || pageData.competition.format !== "team") {
      return;
    }

    const client = createBrowserClient();
    const answerChannel = client
      .channel(`arena-answer-sync-${pageData.activeAttempt.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attempt_answers",
          filter: `attempt_id=eq.${pageData.activeAttempt.id}`,
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
      .channel(`arena-attempt-sync-${pageData.activeAttempt.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_attempts",
          filter: `id=eq.${pageData.activeAttempt.id}`,
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
  }, [pageData.activeAttempt, pageData.competition.format, refreshState]);

  async function startOrResumeAttempt() {
    if (!pageData.registration) {
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
        registrationId: pageData.registration.id,
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
        lastSavedAt: payload.data?.lastSavedAt ?? existing.lastSavedAt,
        clientUpdatedAt: pending.clientUpdatedAt,
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
      explicitStatusFlag ?? existing?.statusFlag ?? "blank",
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
    pageData.registration &&
      pageData.registration.status === "registered" &&
      pageData.registration.actorCanStart &&
      pageData.attemptsRemaining > 0,
  );
  const canWrite = Boolean(pageData.registration?.actorCanWrite && pageData.activeAttempt);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ProgressLink
              href="/mathlete"
              className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
            >
              Mathlete
            </ProgressLink>
            <Badge variant="secondary">{pageData.competition.status}</Badge>
            <Badge variant="outline">{pageData.mode.replace("_", " ")}</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {pageData.competition.name}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            {pageData.competition.description || "Competition details and arena controls live here."}
          </p>
        </div>

        {pageData.activeAttempt ? (
          <div className="rounded-3xl border border-border/70 bg-background px-5 py-4 text-right shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Remaining Time
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold text-foreground">
              {formatTimerText(remainingSeconds)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
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
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Pre-entry checks</CardTitle>
            <CardDescription>
              Rules acknowledgement stays on this canonical competition route before runtime begins.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="space-y-5">
              <div className="rounded-3xl border border-border/70 bg-muted/20 p-5">
                <p className="text-sm font-semibold text-foreground">Rules and instructions</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {pageData.competition.instructions || "Read organizer instructions before starting."}
                </p>
              </div>
              <div className="space-y-4 rounded-3xl border border-border/70 bg-background p-5">
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={acknowledgements.rules}
                    onCheckedChange={(checked) =>
                      setAcknowledgements((current) => ({ ...current, rules: checked === true }))
                    }
                  />
                  <span className="text-sm leading-6 text-muted-foreground">
                    I read scoring and submission rules for this competition.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={acknowledgements.device}
                    onCheckedChange={(checked) =>
                      setAcknowledgements((current) => ({ ...current, device: checked === true }))
                    }
                  />
                  <span className="text-sm leading-6 text-muted-foreground">
                    I am responsible for keeping this device awake, connected, and ready before I enter.
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    checked={acknowledgements.stability}
                    onCheckedChange={(checked) =>
                      setAcknowledgements((current) => ({ ...current, stability: checked === true }))
                    }
                  />
                  <span className="text-sm leading-6 text-muted-foreground">
                    I understand reconnecting does not restore lost time because server timer keeps running.
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-4 rounded-3xl border border-border/70 bg-background p-6">
              <div>
                <p className="text-sm font-semibold text-foreground">Entry summary</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Format: {pageData.competition.format}</p>
                  <p>Attempt window: {pageData.competition.durationMinutes} minutes</p>
                  <p>Attempts remaining: {pageData.attemptsRemaining}</p>
                  <p>
                    Registration:
                    {pageData.registration?.teamName
                      ? ` ${pageData.registration.teamName}`
                      : " Individual"}
                  </p>
                </div>
              </div>
              {!pageData.registration?.actorCanStart ? (
                <Alert>
                  <p className="mb-2 text-sm font-semibold text-foreground">Leader action required</p>
                  <AlertDescription>
                    Team attempt writes are leader-only. You can open runtime once leader starts.
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                type="button"
                className="w-full"
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
            </div>
          </CardContent>
        </Card>
      ) : null}

      {pageData.mode === "arena_runtime" && selectedProblem ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4">
            <div className="sticky top-20 z-10 rounded-3xl border border-border/70 bg-background/95 p-4 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    Problem {selectedProblem.orderIndex}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatStatusLabel(selectedAnswer?.statusFlag ?? "blank")} status
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => updateAnswer(selectedProblem, selectedAnswer?.localValue ?? "", "solved")}
                  >
                    Mark solved
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canWrite}
                    onClick={() => updateAnswer(selectedProblem, "", "reset")}
                  >
                    Reset answer
                  </Button>
                  <Button
                    type="button"
                    disabled={!pageData.registration?.actorCanWrite}
                    onClick={() => setSubmitDialogOpen(true)}
                  >
                    Submit now
                  </Button>
                </div>
              </div>
            </div>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Problem statement</CardTitle>
                <CardDescription>
                  Static math rendering uses KaTeX. Answer input stays stable across desktop, tablet, and phone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-3xl border border-border/70 bg-muted/15 p-5">
                  <KatexPreview
                    latex={selectedProblem.contentLatex}
                    className="min-h-24 text-base leading-7"
                    fallbackText="Problem statement unavailable."
                  />
                </div>

                {selectedProblem.type === "mcq" || selectedProblem.type === "tf" ? (
                  <div className="grid gap-3">
                    {selectedProblem.options.map((option) => {
                      const selected = (selectedAnswer?.localValue ?? "") === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={cn(
                            "rounded-3xl border px-4 py-4 text-left transition",
                            selected
                              ? "border-primary bg-primary/10 text-foreground"
                              : "border-border/70 bg-background hover:border-primary/40 hover:bg-muted/20",
                          )}
                          aria-pressed={selected}
                          disabled={!canWrite}
                          onClick={() => updateAnswer(selectedProblem, option.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-sm font-semibold text-muted-foreground">{option.id}</span>
                            <KatexPreview
                              latex={option.label}
                              className="flex-1 text-sm leading-6"
                              fallbackText={option.label}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
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
                )}

                {!pageData.registration?.actorCanWrite ? (
                  <Alert>
                    <p className="mb-2 text-sm font-semibold text-foreground">Read-only runtime</p>
                    <AlertDescription>
                      Team members can observe synced answers, but only active leader can write or submit.
                    </AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Navigator</CardTitle>
                <CardDescription>
                  Keyboard-safe problem jumps. Status badges use persisted arena states only.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
                {pageData.problems.map((problem) => {
                  const answer = answers.get(problem.competitionProblemId);
                  const statusFlag = answer?.statusFlag ?? "blank";

                  return (
                    <button
                      key={problem.competitionProblemId}
                      type="button"
                      onClick={() => {
                        void flushAllSaves();
                        setSelectedProblemId(problem.competitionProblemId);
                      }}
                      className={cn(
                        "rounded-3xl border px-3 py-4 text-left transition",
                        getProblemStatusClassName(statusFlag),
                        selectedProblemId === problem.competitionProblemId
                          ? "ring-2 ring-primary/40"
                          : "hover:border-primary/40",
                      )}
                    >
                      <span className="block text-xs font-semibold uppercase tracking-[0.18em]">
                        Q{problem.orderIndex}
                      </span>
                      <span className="mt-2 block text-sm font-semibold">
                        {formatStatusLabel(statusFlag)}
                      </span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle>Attempt state</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Attempt #{pageData.activeAttempt?.attemptNo}</p>
                <p>Sync: {connectionState}</p>
                <p>
                  Latest save: {selectedAnswer?.lastSavedAt ? new Date(selectedAnswer.lastSavedAt).toLocaleTimeString() : "Pending"}
                </p>
                <p>
                  Deadline: {pageData.activeAttempt?.effectiveAttemptDeadlineAt ? new Date(pageData.activeAttempt.effectiveAttemptDeadlineAt).toLocaleString() : "Unavailable"}
                </p>
              </CardContent>
            </Card>
          </div>

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
    </div>
  );
}
