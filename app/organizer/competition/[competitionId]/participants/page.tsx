import { notFound } from "next/navigation";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import { loadMonitoringData } from "@/components/monitoring/server-data";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { OffenseLogsPanel } from "@/components/anti-cheat/offense-logs-panel";
import { getCompetitionOffenses } from "@/lib/anti-cheat/queries";
import {
  loadOrganizerCompetitionForManagement,
} from "../../_data";
import { listOrganizerCompetitionRegistrations } from "@/lib/registrations/api";

interface PageProps {
  params: Promise<{ competitionId: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

export default async function OrganizerCompetitionParticipantsPage({ params, searchParams }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;
  const query = await searchParams;
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
  const monitoring = await loadMonitoringData(competitionId, registrations);

  return (
    <div className="w-full px-4">
      <div className="mx-auto mt-12 w-full max-w-[1100px] flex flex-col gap-6 pb-12">
        <OffenseLogsPanel logs={offenseLogs} />
        <CompetitionParticipantsPanel
          competition={competition}
          registrations={registrations}
          activeAttempts={monitoring.activeAttempts}
          events={monitoring.events}
          initialTab={query?.tab}
          routePath={`/organizer/competition/${competitionId}/participants`}
          mode="organizer"
        />
      </div>
    </div>
  );
}
