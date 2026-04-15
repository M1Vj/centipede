import { notFound } from "next/navigation";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { loadCompetitionEditWorkspaceData } from "../_data";

interface PageProps {
  params: Promise<{ competitionId: string }>;
}

export default async function OrganizerCompetitionDetailPage({ params }: PageProps) {
  await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;

  const workspaceData = await loadCompetitionEditWorkspaceData(competitionId);
  if (!workspaceData.competition) {
    notFound();
  }

  return (
    <section className="shell py-12 space-y-6">
      <div className="space-y-2">
        <ProgressLink href="/organizer/competition" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Back to competitions
        </ProgressLink>
        <h1 className="text-3xl font-semibold tracking-tight">Competition detail</h1>
        <p className="text-sm text-muted-foreground">
          Edit draft state, manage publish safety, and apply trusted lifecycle actions.
        </p>
      </div>

      <CompetitionWizard
        mode="edit"
        competitionId={competitionId}
        initialState={workspaceData.formState}
        initialCompetition={workspaceData.competition}
        availableProblems={workspaceData.problems}
      />
    </section>
  );
}
