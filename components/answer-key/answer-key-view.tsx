"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft, Flag } from "lucide-react";
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

export function AnswerKeyView({ data }: AnswerKeyViewProps) {
  const [activeProblemId, setActiveProblemId] = useState<string | null>(null);
  const [submittedDisputes, setSubmittedDisputes] = useState<Set<string>>(new Set());
  const activeProblem = data.problems.find((problem) => problem.competitionProblemId === activeProblemId) ?? null;
  const locked = !data.canViewAnswerKey || data.competition.answerKeyVisibility === "hidden" || data.problems.length === 0;

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
          const hasSubmittedDispute =
            submittedDisputes.has(problem.competitionProblemId) || Boolean(problem.existingDisputeStatus);

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
                  </div>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <KatexPreview latex={problem.contentLatex} fallbackText="Problem statement unavailable." />
                  </div>
                </div>
                {data.canDispute ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 rounded-xl border-slate-200"
                    disabled={hasSubmittedDispute}
                    onClick={() => setActiveProblemId(problem.competitionProblemId)}
                  >
                    <Flag className="h-4 w-4" />
                    {hasSubmittedDispute ? "Dispute open" : `Dispute problem ${problem.orderIndex}`}
                  </Button>
                ) : null}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-emerald-900">
                    Accepted answers
                  </h2>
                  <div className="mt-3 space-y-2">
                    {(problem.answerKeyLatex.length ? problem.answerKeyLatex : ["No answer key snapshot"]).map(
                      (answer, index) => (
                        <div
                          key={`${answer}-${index}`}
                          aria-label={`Accepted answer ${index + 1}`}
                          className="rounded-xl border border-emerald-200 bg-white p-3 text-emerald-950"
                        >
                          <KatexPreview latex={answer} fallbackText={answer} />
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
                      fallbackText="No explanation snapshot provided."
                    />
                  </div>
                </section>
              </div>

              {hasSubmittedDispute ? (
                <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  Dispute submitted for organizer review.
                </p>
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
