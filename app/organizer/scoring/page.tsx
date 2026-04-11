import { ScoringContractWorkbench } from "@/components/organizer/scoring-contract-workbench";
import { getWorkspaceContext } from "@/lib/auth/workspace";

export default async function OrganizerScoringPage() {
  await getWorkspaceContext({ requireRole: "organizer" });

  return (
    <section className="shell py-10 md:py-14">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            UR6a
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Scoring Rules Workspace
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground md:text-base">
            Configure scoring presets, penalties, tie-breakers, and open-attempt policies with
            live contract summaries for organizer and participant contexts.
          </p>
        </header>

        <ScoringContractWorkbench />
      </div>
    </section>
  );
}
