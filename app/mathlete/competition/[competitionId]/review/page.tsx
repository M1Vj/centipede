import { notFound } from "next/navigation";
import { ReviewSubmissionView } from "@/components/review/review-submission-view";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { loadReviewSubmissionPageData } from "@/lib/submission/server";

export default async function ReviewSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ competitionId: string }>;
  searchParams: Promise<{ attemptId?: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });
  const { competitionId } = await params;
  const { attemptId } = await searchParams;

  if (!profile) {
    notFound();
  }

  const data = await loadReviewSubmissionPageData(competitionId, profile.id, attemptId);
  if (!data) {
    notFound();
  }

  return <ReviewSubmissionView data={data} />;
}
