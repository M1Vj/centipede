import { TeamRoster } from "@/components/teams/team-roster";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamDetailPage({
  params,
}: {
  params: { teamId: string };
}) {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="eyebrow">Teams</div>
          <h1 className="text-3xl font-semibold">Team roster</h1>
          <p className="text-sm text-muted-foreground">
            Review roster details, manage members, and send new invites.
          </p>
        </header>

        <TeamRoster teamId={params.teamId} />
      </div>
    </section>
  );
}
