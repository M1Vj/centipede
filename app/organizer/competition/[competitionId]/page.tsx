import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
    <div className="w-full flex justify-center px-4">
      <div className="w-full max-w-[1100px] mt-12 flex flex-col pb-12 font-['Poppins']">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6">
          <ProgressLink
            href="/organizer/competition"
            className="text-slate-400 hover:text-[#f49700] text-[14px] font-bold transition-colors flex items-center gap-1.5 no-underline"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Competitions
          </ProgressLink>
        </div>

        <CompetitionWizard
          key={competitionId}
          mode="edit"
          competitionId={competitionId}
          initialState={workspaceData.formState}
          initialCompetition={workspaceData.competition}
          availableProblems={workspaceData.problems}
        />
      </div>
    </div>
  );
}
