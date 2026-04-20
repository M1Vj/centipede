import { TeamList } from "@/components/teams/team-list";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="eyebrow">Teams</div>
          <h1 className="text-3xl font-semibold">My teams</h1>
          <p className="text-sm text-muted-foreground">
            Manage your rosters, invites, and team registrations in one place.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild>
            <ProgressLink href="/mathlete/teams/create">Create team</ProgressLink>
          </Button>
          <Button asChild variant="outline">
            <ProgressLink href="/mathlete/teams/join">Join with code</ProgressLink>
          </Button>
          <Button asChild variant="ghost">
            <ProgressLink href="/mathlete/teams/invites">Pending invites</ProgressLink>
          </Button>
        </div>

        <TeamList />
      </div>
    </section>
  );
}
