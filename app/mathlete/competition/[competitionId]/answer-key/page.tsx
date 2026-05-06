import { notFound } from "next/navigation";
import { AnswerKeyView } from "@/components/answer-key/answer-key-view";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { loadAnswerKeyPageData } from "@/lib/submission/server";

export default async function AnswerKeyPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });
  const { competitionId } = await params;

  if (!profile) {
    notFound();
  }

  const data = await loadAnswerKeyPageData(competitionId, profile.id);
  if (!data) {
    notFound();
  }

  return (
    <AnswerKeyView
      data={{
        competition: {
          id: data.competition.id,
          name: data.competition.name,
          answerKeyVisibility: data.competition.answerKeyVisibility,
          status: data.competition.status,
        },
        attempt: {
          id: data.attempt?.id ?? "",
          attemptNo: data.attempt?.attemptNo ?? 0,
          finalScore: data.attempt?.finalScore ?? null,
        },
        canViewAnswerKey: data.visibility.allowed,
        canDispute: data.visibility.allowed && Boolean(data.attempt),
        problems: data.problems.map((problem) => ({
          competitionProblemId: problem.competitionProblemId,
          orderIndex: problem.orderIndex,
          points: problem.points,
          type: problem.type,
          contentLatex: problem.contentLatex,
          explanationLatex: problem.explanationLatex,
          answerKeyLatex: problem.answerKeyLatex,
          existingDisputeStatus: problem.existingDisputeStatus,
        })),
      }}
    />
  );
}
