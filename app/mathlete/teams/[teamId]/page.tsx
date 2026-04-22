import { TeamRoster } from "@/components/teams/team-roster";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell pb-16 pt-8 md:pt-10">
      <TeamRoster teamId={teamId} />
    </section>
  );
}
