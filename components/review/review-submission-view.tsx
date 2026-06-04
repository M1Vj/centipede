"use client";

import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";
import type {
  AttemptGradingMode,
  ReviewSubmissionAttempt,
  ReviewSubmissionPageData,
  ReviewSubmissionProblem,
} from "@/lib/submission/types";

type ReviewSubmissionViewProps = {
  data: ReviewSubmissionPageData;
};

type SubmitResponse = {
  data?: {
    attempt?: ReviewSubmissionAttempt;
    attemptsRemaining?: number;
  };
  message?: string;
};

const statusTone = {
  blank: "border-slate-200 bg-slate-50 text-slate-500",
  filled: "border-[#1a1e2e] bg-[#1a1e2e] text-white",
  solved: "border-[#f49700]/40 bg-[#fff7e8] text-[#b86f00]",
  reset: "border-slate-200 bg-white text-slate-400",
};

function formatStatusLabel(status: ReviewSubmissionProblem["statusFlag"]) {
  if (status === "blank") {
    return "Blank";
  }

  if (status === "filled") {
    return "Filled";
  }

  if (status === "solved") {
    return "Solved";
  }

  return "Reset";
}

function getPolicyCopy(mode: AttemptGradingMode) {
  if (mode === "latest_score") {
    return "Latest attempt policy uses this attempt as official once submitted.";
  }

  if (mode === "average_score") {
    return "Average score policy combines this attempt with other graded attempts.";
  }

  return "Highest score policy keeps your best graded attempt as official.";
}

function answerPreview(problem: ReviewSubmissionProblem) {
  if (problem.statusFlag === "blank" || problem.statusFlag === "reset") {
    return "No answer saved";
  }

  return problem.answerLatex || problem.answerTextNormalized || "Saved answer";
}

export function ReviewSubmissionView({ data }: ReviewSubmissionViewProps) {
  const router = useRouter();
  const [attempt, setAttempt] = useState(data.attempt);
  const [attemptsRemaining, setAttemptsRemaining] = useState(data.attemptsRemaining);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const isTerminal = attempt.status !== "in_progress";
  const policyCopy = getPolicyCopy(data.competition.multiAttemptGradingMode);

  const unresolvedCount = useMemo(
    () => data.summaryCounts.blank + data.summaryCounts.reset,
    [data.summaryCounts.blank, data.summaryCounts.reset],
  );

  async function submitAttempt() {
    if (pending || submittedRef.current || isTerminal) {
      return;
    }

    submittedRef.current = true;
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/mathlete/competition/${data.competition.id}/submit`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          attemptId: attempt.id,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as SubmitResponse;

      if (!response.ok) {
        submittedRef.current = false;
        setError(payload.message ?? "Submit failed. Try again once connection is stable.");
        return;
      }

      if (payload.data?.attempt) {
        setAttempt(payload.data.attempt);
      } else {
        setAttempt((current) => ({
          ...current,
          status: "submitted",
          submittedAt: new Date().toISOString(),
        }));
      }

      if (typeof payload.data?.attemptsRemaining === "number") {
        setAttemptsRemaining(payload.data.attemptsRemaining);
      }

      setDialogOpen(false);
      router.refresh();
    } catch {
      submittedRef.current = false;
      setError("Submit failed. Check connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 text-[#1a1e2e] sm:px-6 lg:px-8">
      <header className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(26,30,46,0.44)] sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <ProgressLink
              href={`/mathlete/competition/${data.competition.id}`}
              className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-[#1a1e2e]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to arena
            </ProgressLink>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f49700]">
                Final review
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">
                {data.competition.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review saved answers before final submit. Submission locks this attempt and starts grading.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:flex">
            {[
              ["Total", data.summaryCounts.total],
              ["Blank", data.summaryCounts.blank],
              ["Filled", data.summaryCounts.filled],
              ["Solved", data.summaryCounts.solved],
              ["Reset", data.summaryCounts.reset],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center sm:min-w-24"
              >
                <p className="text-2xl font-black leading-none">{value}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {isTerminal ? (
        <section className="rounded-[1.5rem] border border-[#f49700]/30 bg-[#fff7e8] p-5 text-[#1a1e2e] sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-1 h-6 w-6 text-[#f49700]" />
              <div>
                <h2 className="text-2xl font-black tracking-normal">
                  {attempt.finalScore === null ? "Submitted" : `Score ${attempt.finalScore}`}
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#8a5400]">{policyCopy}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              {data.competition.type === "open" && attemptsRemaining > 0 ? (
                <ProgressLink
                  href={`/mathlete/competition/${data.competition.id}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#f49700] px-4 text-sm font-bold text-white hover:bg-[#df8800]"
                >
                  <RotateCcw className="h-4 w-4" />
                  Attempt Again
                </ProgressLink>
              ) : null}
              <ProgressLink
                href={`/mathlete/competition/${data.competition.id}/answer-key`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-[#1a1e2e] hover:bg-slate-50"
              >
                <FileCheck2 className="h-4 w-4" />
                View answer key
              </ProgressLink>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_24px_70px_-50px_rgba(26,30,46,0.42)]">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-xl font-black tracking-normal">Saved answers</h2>
            <p className="mt-1 text-sm text-slate-500">
              Statuses come from persisted attempt answer rows.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {data.problems.map((problem) => (
              <article
                key={problem.competitionProblemId}
                id={`problem-${problem.competitionProblemId}`}
                className="grid gap-4 p-5 sm:p-6 md:grid-cols-[96px_minmax(0,1fr)_minmax(180px,0.38fr)]"
              >
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Problem
                  </p>
                  <p className="mt-1 text-3xl font-black">{problem.orderIndex}</p>
                  <Badge className={cn("mt-3 capitalize", statusTone[problem.statusFlag])}>
                    {formatStatusLabel(problem.statusFlag)}
                  </Badge>
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <KatexPreview
                    latex={problem.contentLatex}
                    label="Problem prompt"
                    fallbackText="Problem statement unavailable."
                  />
                </div>
                <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                    Your answer
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-700">
                    {answerPreview(problem)}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    {problem.points ?? 0} points
                  </p>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_54px_-42px_rgba(26,30,46,0.4)]">
            <h2 className="text-sm font-black uppercase tracking-[0.18em]">Problem jump links</h2>
            <nav aria-label="Problem jump links" className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-5">
              {data.problems.map((problem) => (
                <ProgressLink
                  key={problem.competitionProblemId}
                  href={`/mathlete/competition/${data.competition.id}#problem-${problem.competitionProblemId}`}
                  className={cn(
                    "flex aspect-square items-center justify-center rounded-lg border text-sm font-black transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]",
                    statusTone[problem.statusFlag],
                  )}
                  aria-label={`Problem ${problem.orderIndex} ${problem.statusFlag}`}
                >
                  {problem.orderIndex}
                </ProgressLink>
              ))}
            </nav>
          </section>

          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-black uppercase tracking-[0.18em]">Submit policy</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{policyCopy}</p>
            {unresolvedCount > 0 ? (
              <p className="mt-3 rounded-xl border border-[#f49700]/30 bg-[#fff7e8] p-3 text-sm font-semibold leading-6 text-[#8a5400]">
                {unresolvedCount} blank/reset item{unresolvedCount === 1 ? "" : "s"} remain.
              </p>
            ) : null}
            <Button
              type="button"
              className="mt-5 h-auto w-full rounded-xl bg-[#f49700] py-4 font-black uppercase tracking-[0.14em] text-white hover:bg-[#df8800]"
              disabled={isTerminal || pending}
              pending={pending}
              pendingText="Submitting"
              onClick={() => setDialogOpen(true)}
            >
              <Send className="h-4 w-4" />
              Submit final attempt
            </Button>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Final submit?"
        description="This locks your saved answers for this attempt. Duplicate clicks are ignored while grading starts."
        confirmLabel="I understand, submit"
        confirmVariant="default"
        pending={pending}
        pendingLabel="Submitting"
        onConfirm={() => void submitAttempt()}
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {unresolvedCount > 0
            ? `${unresolvedCount} blank or reset problem${unresolvedCount === 1 ? "" : "s"} will submit as unanswered.`
            : "All problems have saved answer states."}
        </div>
      </ConfirmDialog>
    </div>
  );
}
