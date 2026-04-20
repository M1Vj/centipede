import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { loadCompetitionCreateWorkspaceData } from "../_data";

export default async function OrganizerCompetitionCreatePage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  const workspaceData = await loadCompetitionCreateWorkspaceData();

  return (
    <section className="shell py-12 space-y-6">
      <div className="space-y-2">
        <ProgressLink href="/organizer/competition" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Back to competitions
        </ProgressLink>
        <h1 className="text-3xl font-semibold tracking-tight">Create competition draft</h1>
        <p className="text-sm text-muted-foreground">
          Build competition draft in one pass, then continue editing from the detail wizard.
        </p>
      </div>

      <CompetitionWizard
        mode="create"
        initialState={createDefaultCompetitionDraftState()}
        availableProblems={workspaceData.problems}
      />
    </section>
  );
}
