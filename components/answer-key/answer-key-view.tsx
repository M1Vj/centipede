"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Flag, XCircle } from "lucide-react";
import { KatexPreview } from "@/components/math-editor/katex-preview";
import { DisputeDialog } from "@/components/submission/dispute-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import type { AnswerKeyPageData } from "@/lib/submission/types";

type AnswerKeyViewProps = {
  data: AnswerKeyPageData;
};

function getResultBadge(problem: AnswerKeyPageData["problems"][number], hasAttempt: boolean) {
  if (!hasAttempt) {
    return {
      label: "No attempt",
      className: "border-slate-200 bg-slate-50 text-slate-500",
      icon: null,
    };
  }

  if (problem.isCorrect === true) {
    return {
      label: "Correct",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    };
  }

  if (problem.isCorrect === false) {
    return {
      label: "Wrong",
      className: "border-rose-200 bg-rose-50 text-rose-700",
      icon: XCircle,
    };
  }

  return {
    label: "Not graded",
    className: "border-slate-200 bg-slate-50 text-slate-500",
    icon: null,
  };
}

export function AnswerKeyView({ data }: AnswerKeyViewProps) {
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [submittedDisputes, setSubmittedDisputes] = useState<Set<string>>(new Set());
  const activeProblem = data.problems.find((problem) => problem.competitionProblemId === activeProblemId) ?? null;
  const locked = !data.canViewAnswerKey || data.problems.length === 0;

  if (locked) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Answer key is not visible for this competition. Visibility follows organizer answer-key policy, not leaderboard publication.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 text-[#1a1e2e] sm:px-6 lg:px-8">
      <header className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-46px_rgba(26,30,46,0.44)] sm:p-7">
        <ProgressLink
          href={`/mathlete/competition/${data.competition.id}/review`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500 hover:text-[#1a1e2e]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to review
        </ProgressLink>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#f49700]">
              Answer key
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-normal sm:text-4xl">
              {data.competition.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Snapshot answers and explanations are frozen from published competition problems.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              {data.attempt ? `Attempt ${data.attempt.attemptNo}` : "Registered participant"}
            </p>
            <p className="mt-1 text-2xl font-black">
              {data.attempt ? (data.attempt.finalScore === null ? "Graded" : `${data.attempt.finalScore} pts`) : "No attempt"}
            </p>
          </div>
        </div>
      </header>

      <div className="space-y-5">
        {data.problems.map((problem) => {
          const activeDispute =
            submittedDisputes.has(problem.competitionProblemId) ||
            problem.existingDisputeStatus === "open" ||
            problem.existingDisputeStatus === "reviewing";
          const isCorrect = problem.isCorrect === true;
          const canDisputeProblem = data.canDispute && !isCorrect;
          const resultBadge = getResultBadge(problem, Boolean(data.attempt));
          const ResultIcon = resultBadge.icon;

          return (
            <article
              key={problem.competitionProblemId}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_18px_54px_-44px_rgba(26,30,46,0.38)] sm:p-6"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">Problem {problem.orderIndex}</Badge>
                    <Badge variant="outline">{problem.points ?? 0} points</Badge>
                    <Badge className={`gap-1 border ${resultBadge.className}`}>
                      {ResultIcon ? <ResultIcon className="h-3.5 w-3.5" /> : null}
                      {resultBadge.label}
                    </Badge>
                    {data.attempt ? (
                      <Badge variant="outline">
                        {problem.pointsAwarded ?? 0}/{problem.points ?? 0} awarded
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <KatexPreview
                      latex={problem.contentLatex}
                      label="Problem prompt"
                      fallbackText="Problem statement unavailable."
                    />
                  </div>
                </div>
                {data.canDispute ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 rounded-xl border-slate-200"
                    disabled={!canDisputeProblem || activeDispute}
                    onClick={() => setActiveProblemId(problem.competitionProblemId)}
                  >
                    <Flag className="h-4 w-4" />
                    {isCorrect
                      ? "Correct - no dispute"
                      : activeDispute
                        ? "Dispute open"
                        : `Dispute problem ${problem.orderIndex}`}
                  </Button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-[#f49700]/30 bg-[#fff7e8] p-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[#8a5400]">
                    Accepted answers
                  </h2>
                  <div className="mt-3 space-y-2">
                    {(problem.answerKeyLatex.length ? problem.answerKeyLatex : ["No answer key snapshot"]).map(
                      (answer, index) => (
                        <div
                          key={`${answer}-${index}`}
                          aria-label={`Accepted answer ${index + 1}`}
                          className="rounded-xl border border-[#f49700]/25 bg-white p-3 text-[#1a1e2e]"
                        >
                          <KatexPreview latex={answer} label={null} fallbackText={answer} />
                        </div>
                      ),
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">
                    Explanation
                  </h2>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <KatexPreview
                      latex={problem.explanationLatex}
                      label={null}
                      fallbackText="No explanation snapshot provided."
                    />
                  </div>
                </section>
              </div>

              {activeDispute ? (
                <p className="mt-4 rounded-xl border border-[#f49700]/30 bg-[#fff7e8] p-3 text-sm font-semibold text-[#8a5400]">
                  Dispute submitted for organizer review.
                </p>
              ) : null}
              {problem.existingDisputeResolutionNote ? (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Resolution note
                  </p>
                  <p className="mt-2 text-sm font-medium leading-6 text-slate-700">
                    {problem.existingDisputeResolutionNote}
                  </p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeProblem && data.attempt ? (
        <DisputeDialog
          competitionId={data.competition.id}
          competitionProblemId={activeProblem.competitionProblemId}
          attemptId={data.attempt.id}
          orderIndex={activeProblem.orderIndex}
          open={Boolean(activeProblem)}
          onOpenChange={(open) => {
            if (!open) {
              setActiveProblemId(null);
            }
          }}
          onSubmitted={() =>
            setSubmittedDisputes((current) => new Set(current).add(activeProblem.competitionProblemId))
          }
        />
      ) : null}
    </div>
  );
}
