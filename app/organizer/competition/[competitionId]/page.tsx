import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerSecondaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { loadCompetitionEditWorkspaceData } from "../_data";

interface PageProps {
  params: Promise<{ competitionId: string }>;
}

export default async function OrganizerCompetitionDetailPage({ params }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;

  const workspaceData = await loadCompetitionEditWorkspaceData(
    competitionId,
    profile?.id ?? "",
  );
  if (!workspaceData.competition) {
    notFound();
  }

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        breadcrumbs={[
          { label: "Competitions", href: "/organizer/competition" },
          { label: workspaceData.competition.name || "Competition" },
        ]}
        eyebrow="Competition Wizard"
        title={workspaceData.competition.name || "Competition detail"}
        description="Update draft state, verify publish readiness, and run trusted lifecycle actions for this competition."
        actions={
          <ProgressLink href="/organizer/competition" className={organizerSecondaryActionClass}>
            <ArrowLeft className="size-4" />
            Back to competitions
          </ProgressLink>
        }
      />

      <div className="mx-auto w-full max-w-[1120px] space-y-5">
        <OrganizerWorkspacePanel className="border-[#f2d8ac] bg-white/95 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f59f0a]">Competition review</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                {workspaceData.competition.name || "Competition Review"}
              </h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">99%</p>
              <p className="text-sm text-slate-500">Ready for publish checks.</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[96%] rounded-full bg-[#f59f0a] shadow-[0_0_18px_rgba(245,159,10,0.35)]" />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="capitalize">
              {workspaceData.competition.status}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {workspaceData.competition.type}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {workspaceData.competition.format}
            </Badge>
            <span className="text-xs text-slate-500">
              Revision {workspaceData.competition.draftRevision} | Updated {new Date(workspaceData.competition.updatedAt).toLocaleString()}
            </span>
          </div>
        </OrganizerWorkspacePanel>

        <OrganizerWorkspacePanel className="border-[#f2d8ac] bg-white/95 p-3 md:p-4">
          <CompetitionWizard
            mode="edit"
            competitionId={competitionId}
            initialState={workspaceData.formState}
            initialCompetition={workspaceData.competition}
            availableProblems={workspaceData.problems}
          />
        </OrganizerWorkspacePanel>
      </div>
    </OrganizerWorkspaceShell>
  );
}
