import { TeamJoinForm } from "@/components/teams/team-join-form";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsJoinPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell py-14 md:py-20">
      <div className="space-y-8">
        <header className="space-y-3">
          <div className="eyebrow">Teams</div>
          <h1 className="text-3xl font-semibold">Join a team</h1>
          <p className="text-sm text-muted-foreground">
            Enter the team code provided by your leader to join their roster.
          </p>
        </header>

        <div>
          <Button asChild variant="outline">
            <ProgressLink href="/mathlete/teams">Back to teams</ProgressLink>
          </Button>
        </div>

        <div className="max-w-2xl">
          <TeamJoinForm />
        </div>
      </div>
    </section>
  );
}
