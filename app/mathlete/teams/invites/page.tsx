import { TeamInvitesList } from "@/components/teams/team-invites-list";
import { TeamsPageShell } from "@/components/teams/teams-page-shell";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsInvitesPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <TeamsPageShell
      badge="Invitations"
      title="Review invites before your next math brawl."
      description="Accept or decline team requests from one clean inbox while keeping route behavior exactly as it works today."
      actions={
        <div>
          <Button asChild variant="outline" className="h-12 rounded-full border-slate-200 bg-white px-6 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
            <ProgressLink href="/mathlete/teams">Back to teams</ProgressLink>
          </Button>
        </div>
      }
    >
      <TeamInvitesList />
    </TeamsPageShell>
  );
}
