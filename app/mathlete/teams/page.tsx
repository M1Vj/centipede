import { TeamList } from "@/components/teams/team-list";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function MathleteTeamsPage() {
  await getWorkspaceContext({ requireRole: "mathlete" });

  return (
    <section className="shell pb-16 pt-8 md:pt-10">
      <div className="space-y-8">
        <div className="space-y-5">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f49700]">
              My Teams
            </p>
            <h1 className="text-4xl font-black tracking-[-0.06em] text-[#1a1e2e] md:text-5xl">
              Join, Create, and Manage Teams
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
              Create a new team, join with a code, or review pending invites from one clean workspace.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild className="h-12 rounded-full bg-[#f49700] px-6 text-sm font-bold text-white shadow-[0_18px_36px_-24px_rgba(244,151,0,0.8)] hover:bg-[#e68b00]">
              <ProgressLink href="/mathlete/teams/create">Create New Team</ProgressLink>
            </Button>
            <Button asChild variant="outline" className="h-12 rounded-full border-slate-200 bg-white px-6 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
              <ProgressLink href="/mathlete/teams/join">Join via code</ProgressLink>
            </Button>
            <Button asChild variant="ghost" className="h-12 rounded-full px-5 text-sm font-semibold text-slate-500 hover:bg-white/60 hover:text-slate-800">
              <ProgressLink href="/mathlete/teams/invites">Pending invites</ProgressLink>
            </Button>
          </div>
        </div>

        <TeamList />
      </div>
    </section>
  );
}
