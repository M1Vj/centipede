import { TeamList } from "@/components/teams/team-list";
import { TeamsPageShell } from "@/components/teams/teams-page-shell";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <TeamsPageShell
      badge="My Teams"
      title="Build squads. Protect chemistry. Stay competition ready."
      description="Manage your teams, move fast on invites, and keep every roster aligned with the Mathlete workspace direction from Figma."
      actions={(
        <>
          <Button asChild className="h-12 rounded-full bg-[#f49700] px-6 text-sm font-bold text-white shadow-[0_18px_36px_-24px_rgba(244,151,0,0.8)] hover:bg-[#e68b00]">
            <ProgressLink href="/mathlete/teams/create">Create New Team</ProgressLink>
          </Button>
          <Button asChild variant="outline" className="h-12 rounded-full border-slate-200 bg-white px-6 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
            <ProgressLink href="/mathlete/teams/join">Join via code</ProgressLink>
          </Button>
          <Button asChild variant="ghost" className="h-12 rounded-full px-5 text-sm font-semibold text-slate-500 hover:bg-white/60 hover:text-slate-800">
            <ProgressLink href="/mathlete/teams/invites">Pending invites</ProgressLink>
          </Button>
        </>
      )}
    >
      <TeamList />
    </TeamsPageShell>
  );
}
