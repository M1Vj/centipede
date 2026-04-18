import { ArrowLeft } from "lucide-react";
import {
  OrganizerWorkspaceHeader,
  OrganizerWorkspacePanel,
  OrganizerWorkspaceShell,
  organizerSecondaryActionClass,
} from "@/components/organizer/workspace-patterns";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { loadCompetitionCreateWorkspaceData } from "../_data";

export default async function OrganizerCompetitionCreatePage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  const workspaceData = await loadCompetitionCreateWorkspaceData();

  return (
    <OrganizerWorkspaceShell className="space-y-6">
      <OrganizerWorkspaceHeader
        breadcrumbs={[
          { label: "Competitions", href: "/organizer/competition" },
          { label: "Create draft" },
        ]}
        eyebrow="Competition Wizard"
        title="Create competition draft"
        description="Build a new draft, configure schedule and format, then continue to problem selection and scoring policies."
        actions={
          <ProgressLink href="/organizer/competition" className={organizerSecondaryActionClass}>
            <ArrowLeft className="size-4" />
            Back to competitions
          </ProgressLink>
        }
      />

      <div className="mx-auto w-full max-w-[980px] space-y-5">
        <OrganizerWorkspacePanel className="border-[#f2d8ac] bg-white/95 p-5 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#f59f0a]">Step flow</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">Competition Format and Schedule</h2>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold text-slate-900">40%</p>
              <p className="text-sm text-slate-500">Completed once schedule is valid.</p>
            </div>
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/5 rounded-full bg-[#f59f0a] shadow-[0_0_18px_rgba(245,159,10,0.35)]" />
          </div>
          <p className="mt-4 text-sm text-slate-500">
            Define competition identity, timing, and publish-safe rules before moving deeper into problem selection.
          </p>
        </OrganizerWorkspacePanel>

        <OrganizerWorkspacePanel className="border-[#f2d8ac] bg-white/95 p-3 md:p-4">
          <CompetitionWizard
            mode="create"
            initialState={createDefaultCompetitionDraftState()}
            availableProblems={workspaceData.problems}
          />
        </OrganizerWorkspacePanel>
      </div>
    </OrganizerWorkspaceShell>
  );
}
