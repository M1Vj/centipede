import { TeamInvitesList } from "@/components/teams/team-invites-list";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsInvitesPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="eyebrow">Teams</div>
          <h1 className="text-3xl font-semibold">Pending invites</h1>
          <p className="text-sm text-muted-foreground">
            Review incoming team invitations and respond when you are ready.
          </p>
        </header>

        <div>
          <Button asChild variant="outline">
            <ProgressLink href="/mathlete/teams">Back to teams</ProgressLink>
          </Button>
        </div>

        <TeamInvitesList />
      </div>
    </section>
  );
}
