import { notFound } from "next/navigation";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { OffenseLogsPanel } from "@/components/anti-cheat/offense-logs-panel";
import { getCompetitionOffenses } from "@/lib/anti-cheat/queries";
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

  const [registrations, offenseLogs] = await Promise.all([
    listOrganizerCompetitionRegistrations({ competitionId }),
    getCompetitionOffenses(competitionId, profile?.id ?? ""),
  ]);

  return (
    <div className="w-full px-4">
      <div className="mx-auto mt-12 w-full max-w-[1100px] flex flex-col gap-6 pb-12">
        <OffenseLogsPanel logs={offenseLogs} />
        <CompetitionParticipantsPanel
          competition={competition}
          registrations={registrations}
        />
      </div>
    </div>
  );
}
