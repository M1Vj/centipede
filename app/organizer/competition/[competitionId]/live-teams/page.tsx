import { notFound } from "next/navigation";
import { TeamLiveMonitoringPanel } from "@/components/organizer/team-live-monitoring-panel";
import { buildTeamLiveMonitoringRows } from "@/components/monitoring/team-live-monitoring";
import { loadMonitoringData } from "@/components/monitoring/server-data";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { listOrganizerCompetitionRegistrations } from "@/lib/registrations/api";
import { loadOrganizerCompetitionForManagement } from "../../_data";

interface PageProps {
  params: Promise<{ competitionId: string }>;
}

export default async function OrganizerCompetitionLiveTeamsPage({ params }: PageProps) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;
  const competition = await loadOrganizerCompetitionForManagement(
    competitionId,
    profile?.id ?? "",
  );

  if (!competition || competition.format !== "team" || competition.status !== "live") {
    notFound();
  }

  const registrations = await listOrganizerCompetitionRegistrations({ competitionId });
  const monitoring = await loadMonitoringData(competitionId, registrations);
  const rows = buildTeamLiveMonitoringRows({
    registrations,
    activeAttempts: monitoring.activeAttempts,
    finishedAttempts: monitoring.finishedAttempts,
  });

  return (
    <div className="w-full px-4">
      <div className="mx-auto mt-12 w-full max-w-[1180px] flex flex-col gap-6 pb-12">
        <TeamLiveMonitoringPanel competition={competition} rows={rows} />
      </div>
    </div>
  );
}
