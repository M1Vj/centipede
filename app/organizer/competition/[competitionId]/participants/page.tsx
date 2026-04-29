import { notFound } from "next/navigation";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  loadOrganizerCompetitionForManagement,
} from "../../_data";
import { startDueScheduledCompetitionsSafely } from "@/lib/competition/scheduled-start";
import { listOrganizerCompetitionRegistrations } from "@/lib/registrations/api";

interface PageProps {
  params: Promise<{ competitionId: string }>;
}

export default async function OrganizerCompetitionParticipantsPage({ params }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;
  await startDueScheduledCompetitionsSafely();
  const competition = await loadOrganizerCompetitionForManagement(
    competitionId,
    profile?.id ?? "",
  );

  if (!competition) {
    notFound();
  }

  const registrations = await listOrganizerCompetitionRegistrations({ competitionId });

  return (
    <div className="w-full px-4">
      <div className="mx-auto mt-12 w-full max-w-[1100px] pb-12">
        <CompetitionParticipantsPanel
          competition={competition}
          registrations={registrations}
        />
      </div>
    </div>
  );
}
