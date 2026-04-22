import { notFound } from "next/navigation";
import { ArenaExperience } from "@/components/arena/arena-experience";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { loadArenaPageData } from "@/lib/arena/server";

export default async function MathleteCompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });

  if (!profile) {
    notFound();
  }

  const data = await loadArenaPageData(competitionId, profile.id);

  if (!data) {
    notFound();
  }

  return <ArenaExperience initialData={data} />;
}
